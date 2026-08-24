'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { CoachFormattedReply } from '@/components/coach-formatted-reply'
import { CollapsibleTriggerEnd } from '@/components/collapsible-ui'
import { KiBrandChip } from '@/components/ki-brand'
import {
  PageChrome,
  PageHero,
  pageSectionHeaderClass,
  pageSectionPanelClass,
  pageSectionShellClass,
  pageSectionTitleClass,
} from '@/components/page-shell'
import {
  MODEBERATER_MAX_KLEIDUNG_FOTOS,
  MODEBERATER_MAX_PERSON_FOTOS,
  coachImageDataUrl,
  compressImageFileForCoach,
} from '@/lib/finance-coach-images'
import { appInputClass, appLabelClass, appSecondaryBtnClass } from '@/lib/app-ui'
import { KI_ASSISTANT_BUBBLE, KI_PANEL_OUTER } from '@/lib/ki-ui'
import {
  MODE_ANLASS_OPTIONEN,
  MODE_ERSCHEINUNG,
  MODE_PERSON_FOTO_LABELS,
  MODE_STIL_OPTIONEN,
  kleidungHatInhalt,
  ladeModeChat,
  ladeModeStandVollstaendig,
  leererModeStand,
  loescheModeChat,
  modeFotoSignatur,
  profilHatDaten,
  speichereModeChat,
  speichereModeStandVollstaendig,
  standFuerKi,
  type ModeChatTurn,
  type ModeKleidungItem,
  type ModePersonFoto,
  type ModeProfil,
} from '@/lib/modeberater/mode-profil'

const DEFAULT_FRAGE =
  'Bitte berate mich: Was steht mir? Bewerte die hochgeladene Kleidung und schlage passende Teile im Budget vor.'

const ACCEPT_BILD =
  'image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif'

function neuesId(): string {
  return crypto.randomUUID()
}

function parseZahl(s: string): string {
  return s.replace(/[^\d.,]/g, '')
}

export function ModeBerater() {
  const [stand, setStand] = useState(leererModeStand)
  const [geladen, setGeladen] = useState(false)
  const [kiConfigured, setKiConfigured] = useState<boolean | null>(null)
  const [freeTierKey, setFreeTierKey] = useState<boolean | null>(null)
  const [kiHostedNote, setKiHostedNote] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ModeChatTurn[]>([])
  const [webSucheAn, setWebSucheAn] = useState(false)
  const [forceFotos, setForceFotos] = useState(false)
  const [profilOffen, setProfilOffen] = useState(true)
  const [fotosOffen, setFotosOffen] = useState(true)
  const [kleidungOffen, setKleidungOffen] = useState(true)
  const endRef = useRef<HTMLDivElement | null>(null)
  const personGalerieRef = useRef<HTMLInputElement | null>(null)
  const personKameraRef = useRef<HTMLInputElement | null>(null)
  const kleidungGalerieRef = useRef<HTMLInputElement | null>(null)
  const kleidungKameraRef = useRef<HTMLInputElement | null>(null)
  const kleidungFotoZiel = useRef<string | null>(null)
  const [fotosSchonGesendet, setFotosSchonGesendet] = useState(false)
  const [letzteFotoSig, setLetzteFotoSig] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const s = await ladeModeStandVollstaendig()
      const chat = ladeModeChat()
      if (cancelled) return
      setStand(s)
      setMessages(chat)
      const leer = !profilHatDaten(s.profil) && s.personFotos.length === 0 && s.kleidung.length === 0
      setProfilOffen(leer)
      setFotosOffen(leer)
      setKleidungOffen(leer)
      setGeladen(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!geladen) return
    const t = window.setTimeout(() => {
      void speichereModeStandVollstaendig(stand).then((ok) => {
        if (!ok) toast.error('Profil/Fotos konnten nicht gespeichert werden.')
      })
    }, 350)
    return () => window.clearTimeout(t)
  }, [stand, geladen])

  useEffect(() => {
    if (!geladen) return
    speichereModeChat(messages)
  }, [messages, geladen])

  useEffect(() => {
    let cancelled = false
    void fetch('/api/modeberater')
      .then((r) => r.json())
      .then((d: { configured?: boolean; freeTierKey?: boolean; hostedNote?: string }) => {
        if (cancelled) return
        setKiConfigured(d.configured === true)
        setFreeTierKey(d.freeTierKey === true)
        setKiHostedNote(typeof d.hostedNote === 'string' && d.hostedNote.trim() ? d.hostedNote.trim() : null)
      })
      .catch(() => {
        if (!cancelled) setKiConfigured(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const profil = stand.profil
  const setProfil = useCallback((patch: Partial<ModeProfil>) => {
    setStand((s) => ({ ...s, profil: { ...s.profil, ...patch } }))
  }, [])

  const kleidungAktiv = useMemo(() => stand.kleidung.filter(kleidungHatInhalt), [stand.kleidung])
  const fotoSig = modeFotoSignatur(stand)
  const fotosGeaendert = fotoSig !== letzteFotoSig
  const wuerdeFotosSenden = forceFotos || !fotosSchonGesendet || fotosGeaendert

  const sende = useCallback(
    async (textRoh?: string) => {
      const text = (textRoh ?? input).trim() || DEFAULT_FRAGE
      if (loading || kiConfigured !== true) return

      const sig = modeFotoSignatur(stand)
      const mitFotos = forceFotos || !fotosSchonGesendet || sig !== letzteFotoSig
      const webSuche = webSucheAn || /alternativ/i.test(text)

      setInput('')
      setLoading(true)
      const userTurn: ModeChatTurn = { role: 'user', content: text }
      const next = [...messages, userTurn]
      setMessages(next)

      try {
        const res = await fetch('/api/modeberater', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: next,
            stand: standFuerKi(stand, mitFotos),
            webSuche,
            mitFotos,
          }),
        })
        const data = (await res.json()) as { reply?: string; error?: string }
        if (!res.ok || !data.reply) {
          throw new Error(data.error || 'Keine Antwort.')
        }
        setFotosSchonGesendet(true)
        setLetzteFotoSig(sig)
        setForceFotos(false)
        setMessages([...next, { role: 'assistant', content: data.reply }])
      } catch (e) {
        setMessages(next)
        toast.error(e instanceof Error ? e.message : 'KI-Anfrage fehlgeschlagen.')
      } finally {
        setLoading(false)
      }
    },
    [input, loading, kiConfigured, messages, stand, webSucheAn, forceFotos, fotosSchonGesendet, letzteFotoSig],
  )

  async function nimmPersonFotos(files: FileList | null) {
    if (!files?.length) return
    const next: ModePersonFoto[] = [...stand.personFotos]
    for (const file of [...files]) {
      if (next.length >= MODEBERATER_MAX_PERSON_FOTOS) {
        toast.error(`Maximal ${MODEBERATER_MAX_PERSON_FOTOS} Fotos von dir.`)
        break
      }
      try {
        const part = await compressImageFileForCoach(file, { maxEdge: 1024, quality: 0.72 })
        next.push({
          id: neuesId(),
          label: next.length === 0 ? 'Ganzkörper' : 'Sonstiges',
          mimeType: part.mimeType,
          base64: part.base64,
        })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Foto konnte nicht gelesen werden.')
      }
    }
    setStand((s) => ({ ...s, personFotos: next }))
  }

  async function nimmKleidungFoto(id: string, files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    const mitFoto = stand.kleidung.filter((k) => k.foto?.base64).length
    const ziel = stand.kleidung.find((k) => k.id === id)
    if (!ziel?.foto?.base64 && mitFoto >= MODEBERATER_MAX_KLEIDUNG_FOTOS) {
      toast.error(`Maximal ${MODEBERATER_MAX_KLEIDUNG_FOTOS} Kleidungsfotos.`)
      return
    }
    try {
      const part = await compressImageFileForCoach(file, { maxEdge: 1024, quality: 0.72 })
      setStand((s) => ({
        ...s,
        kleidung: s.kleidung.map((k) =>
          k.id === id ? { ...k, foto: { mimeType: part.mimeType, base64: part.base64 } } : k,
        ),
      }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Foto konnte nicht gelesen werden.')
    }
  }

  function neueKleidung() {
    const item: ModeKleidungItem = {
      id: neuesId(),
      notiz: '',
      url: '',
      preisEur: '',
      foto: null,
    }
    setStand((s) => ({ ...s, kleidung: [...s.kleidung, item].slice(0, 8) }))
    setKleidungOffen(true)
  }

  function patchKleidung(id: string, patch: Partial<ModeKleidungItem>) {
    setStand((s) => ({
      ...s,
      kleidung: s.kleidung.map((k) => (k.id === id ? { ...k, ...patch } : k)),
    }))
  }

  function oeffneKleidungFoto(id: string, kamera: boolean) {
    kleidungFotoZiel.current = id
    if (kamera) kleidungKameraRef.current?.click()
    else kleidungGalerieRef.current?.click()
  }

  const kiBereit = kiConfigured === true
  const profilKurz = profilKurztext(profil)
  const budgetKurz =
    profil.budgetMin || profil.budgetMax
      ? `${profil.budgetMin || '…'}–${profil.budgetMax || '…'} €`
      : ''

  return (
    <PageChrome density="compact" className="max-w-6xl">
      <PageHero
        density="compact"
        eyebrow="Mode"
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            Modeberater
            <KiBrandChip />
          </span>
        }
        description="Profil und Fotos einmal anlegen, dann beraten lassen. Folgefragen ohne neue Bilder — spart das kostenlose Kontingent."
      />

      <div className="flex flex-col-reverse gap-4 lg:grid lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-3">
          <Klapp
            title="Dein Profil"
            summary={[profilKurz, budgetKurz].filter(Boolean).join(' · ') || 'Maße, Stil, Budget'}
            open={profilOffen}
            onToggle={() => setProfilOffen((v) => !v)}
          >
            <ProfilFelder profil={profil} setProfil={setProfil} />
          </Klapp>

          <Klapp
            title="Fotos von dir"
            summary={
              stand.personFotos.length
                ? `${stand.personFotos.length} Foto${stand.personFotos.length === 1 ? '' : 's'}`
                : 'Ganzkörper hilft am meisten'
            }
            open={fotosOffen}
            onToggle={() => setFotosOffen((v) => !v)}
          >
            <p className="mb-3 text-[12px] leading-relaxed text-[var(--app-text-muted)]">
              Tageslicht, möglichst ganz. Kamera liefert JPEG — besser als HEIC aus der Mediathek.
            </p>
            <input
              ref={personGalerieRef}
              type="file"
              accept={ACCEPT_BILD}
              multiple
              className="hidden"
              onChange={(e) => {
                void nimmPersonFotos(e.target.files)
                e.target.value = ''
              }}
            />
            <input
              ref={personKameraRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => {
                void nimmPersonFotos(e.target.files)
                e.target.value = ''
              }}
            />
            <div className="flex flex-wrap gap-3">
              {stand.personFotos.map((f) => (
                <div key={f.id} className="w-[7.25rem] space-y-1.5">
                  <div className="relative h-32 overflow-hidden rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)]">
                    {f.base64 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coachImageDataUrl(f)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-[11px] text-[var(--app-text-muted)]">
                        …
                      </span>
                    )}
                    <button
                      type="button"
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-xs font-black text-white"
                      aria-label="Foto entfernen"
                      onClick={() =>
                        setStand((s) => ({ ...s, personFotos: s.personFotos.filter((x) => x.id !== f.id) }))
                      }
                    >
                      ×
                    </button>
                  </div>
                  <select
                    className={`${appInputClass} py-1.5 text-[11px]`}
                    value={f.label}
                    onChange={(e) =>
                      setStand((s) => ({
                        ...s,
                        personFotos: s.personFotos.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)),
                      }))
                    }
                  >
                    {MODE_PERSON_FOTO_LABELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {stand.personFotos.length < MODEBERATER_MAX_PERSON_FOTOS ? (
                <div className="flex h-32 w-[7.25rem] flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => personKameraRef.current?.click()}
                    className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-amber-700/55 text-[11px] font-semibold text-amber-200/90 hover:bg-amber-950/20"
                  >
                    Kamera
                  </button>
                  <button
                    type="button"
                    onClick={() => personGalerieRef.current?.click()}
                    className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--app-border-strong)] text-[11px] font-semibold text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)]"
                  >
                    Galerie
                  </button>
                </div>
              ) : null}
            </div>
          </Klapp>

          <Klapp
            title="Kleidung im Blick"
            summary={
              kleidungAktiv.length
                ? `${kleidungAktiv.length} Teil${kleidungAktiv.length === 1 ? '' : 'e'}`
                : 'Foto oder Shop-Link'
            }
            open={kleidungOffen}
            onToggle={() => setKleidungOffen((v) => !v)}
          >
            <input
              ref={kleidungGalerieRef}
              type="file"
              accept={ACCEPT_BILD}
              className="hidden"
              onChange={(e) => {
                const id = kleidungFotoZiel.current
                kleidungFotoZiel.current = null
                if (id) void nimmKleidungFoto(id, e.target.files)
                e.target.value = ''
              }}
            />
            <input
              ref={kleidungKameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const id = kleidungFotoZiel.current
                kleidungFotoZiel.current = null
                if (id) void nimmKleidungFoto(id, e.target.files)
                e.target.value = ''
              }}
            />
            <div className="space-y-3">
              {stand.kleidung.map((k, idx) => (
                <div
                  key={k.id}
                  className="space-y-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3"
                >
                  <div className="flex gap-3">
                    <div className="w-20 shrink-0 space-y-1">
                      <button
                        type="button"
                        onClick={() => oeffneKleidungFoto(k.id, false)}
                        className="relative h-24 w-20 overflow-hidden rounded-lg border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface)]"
                      >
                        {k.foto?.base64 ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={coachImageDataUrl(k.foto)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full items-center justify-center text-[11px] text-[var(--app-text-muted)]">
                            Foto
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-md border border-[var(--app-border-strong)] py-0.5 text-[10px] font-semibold text-[var(--app-text-muted)]"
                        onClick={() => oeffneKleidungFoto(k.id, true)}
                      >
                        Kamera
                      </button>
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <Feld label={`Teil ${idx + 1}`}>
                        <input
                          className={appInputClass}
                          value={k.notiz}
                          onChange={(e) => patchKleidung(k.id, { notiz: e.target.value })}
                          placeholder="oliv Overshirt …"
                        />
                      </Feld>
                      <div className="grid grid-cols-[1fr_5.5rem] gap-2">
                        <Feld label="Link">
                          <input
                            className={appInputClass}
                            value={k.url}
                            onChange={(e) => patchKleidung(k.id, { url: e.target.value })}
                            placeholder="https://…"
                            inputMode="url"
                          />
                        </Feld>
                        <Feld label="€">
                          <input
                            className={appInputClass}
                            inputMode="decimal"
                            value={k.preisEur}
                            onChange={(e) => patchKleidung(k.id, { preisEur: parseZahl(e.target.value) })}
                            placeholder="89"
                          />
                        </Feld>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-rose-300 hover:underline"
                    onClick={() => setStand((s) => ({ ...s, kleidung: s.kleidung.filter((x) => x.id !== k.id) }))}
                  >
                    Entfernen
                  </button>
                </div>
              ))}
            </div>
            {stand.kleidung.length < 8 ? (
              <button type="button" className={`${appSecondaryBtnClass} mt-3`} onClick={() => neueKleidung()}>
                + Teil / Link
              </button>
            ) : null}
          </Klapp>
        </div>

        <section
          className={`${pageSectionShellClass} ${KI_PANEL_OUTER} lg:sticky lg:top-[calc(var(--app-nav-offset)+0.5rem)] lg:max-h-[calc(100dvh-var(--app-nav-offset)-1rem)] lg:overflow-y-auto`}
          aria-labelledby="mode-chat-titel"
        >
          <div className={pageSectionHeaderClass}>
            <h2 id="mode-chat-titel" className={`${pageSectionTitleClass} inline-flex items-center gap-2`}>
              Beratung
              <KiBrandChip decorative={false} />
            </h2>
          </div>
          <div className={`${pageSectionPanelClass} space-y-3`}>
            {kiConfigured === false ? (
              <p className="rounded-xl border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
                {kiHostedNote ||
                  'KI ist noch nicht eingerichtet. In .env.local GEMINI_API_KEY_FREE setzen und den Dev-Server neu starten.'}
              </p>
            ) : null}
            {kiConfigured === true && freeTierKey === false ? (
              <p className="text-xs text-[var(--app-text-muted)]">
                Fürs kostenlose Kontingent{' '}
                <code className="rounded bg-[var(--app-surface-muted)] px-1">GEMINI_API_KEY_FREE</code> setzen.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Chip
                disabled={!kiBereit || loading}
                onClick={() => void sende('Steht mir die hochgeladene Kleidung? Bitte ehrlich bewerten.')}
              >
                Steht mir das?
              </Chip>
              <Chip
                disabled={!kiBereit || loading}
                onClick={() => void sende('Welche Farben und Schnitte stehen mir — anhand der Fotos und des Profils?')}
              >
                Farben & Schnitte
              </Chip>
              <Chip
                disabled={!kiBereit || loading}
                onClick={() =>
                  void sende('Bitte Outfit-Ideen für den angegebenen Anlass im Budget. Konkrete Teile, keine Floskeln.')
                }
              >
                Outfit im Budget
              </Chip>
              <Chip
                disabled={!kiBereit || loading}
                onClick={() =>
                  void sende(
                    'Schlage 3 konkrete Alternativen in der Preisklasse vor, die mir besser stehen könnten als die Kandidaten.',
                  )
                }
              >
                Alternativen
              </Chip>
            </div>

            <div className="flex flex-col gap-1.5 text-xs text-[var(--app-text-muted)]">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={webSucheAn} onChange={(e) => setWebSucheAn(e.target.checked)} />
                Websuche für Shops / Alternativen
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={wuerdeFotosSenden}
                  disabled={!fotosSchonGesendet || fotosGeaendert}
                  onChange={(e) => setForceFotos(e.target.checked)}
                />
                Fotos mitsenden
                <span className="text-[10px] opacity-80">
                  {!fotosSchonGesendet
                    ? '(erste Frage)'
                    : fotosGeaendert
                      ? '(Fotos/Links geändert)'
                      : wuerdeFotosSenden
                        ? '(diesmal ja)'
                        : '(Folgefrage ohne Bilder)'}
                </span>
              </label>
            </div>

            <div className="max-h-[22rem] space-y-3 overflow-y-auto rounded-xl border border-violet-500/20 bg-[var(--app-surface-muted)] p-3 lg:max-h-[min(28rem,calc(100dvh-22rem))]">
              {messages.length === 0 && !loading ? (
                <p className="text-sm italic text-[var(--app-text-muted)]">
                  Noch keine Beratung. Kurz Profil/Fotos, dann „Beraten“.
                  {kleidungAktiv.length ? ` ${kleidungAktiv.length} Kandidat(en) bereit.` : ''}
                </p>
              ) : null}
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <div
                    key={i}
                    className="ml-8 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-[13px] text-[var(--app-text)]"
                  >
                    {m.content}
                  </div>
                ) : (
                  <div key={i} className={`${KI_ASSISTANT_BUBBLE} px-3 py-2.5`}>
                    <CoachFormattedReply content={m.content} accent="violet" />
                  </div>
                ),
              )}
              {loading ? (
                <div className="flex items-center gap-2 rounded-lg border border-violet-500/35 bg-violet-950/40 px-3 py-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400/60 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-400" />
                  </span>
                  <span className="text-xs font-semibold text-violet-200/95">
                    {wuerdeFotosSenden ? 'Schaut sich die Fotos an …' : 'Stylist denkt nach …'}
                  </span>
                </div>
              ) : null}
              <div ref={endRef} />
            </div>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (kiBereit) void sende()
                }
              }}
              rows={3}
              disabled={kiConfigured === false}
              placeholder={
                kiConfigured === false
                  ? 'Zuerst GEMINI_API_KEY_FREE in .env.local …'
                  : 'Frage oder Shop-Link einfügen …'
              }
              className="w-full resize-y rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] p-3 text-sm text-[var(--app-text)] outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-50"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setMessages([])
                  loescheModeChat()
                  setFotosSchonGesendet(false)
                  setLetzteFotoSig('')
                  toast('Chat geleert — nächste Frage schickt wieder Fotos.')
                }}
                className="rounded-xl border border-[var(--app-border-strong)] px-3 py-2 text-xs font-bold text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)]"
              >
                Verlauf leeren
              </button>
              <button
                type="button"
                disabled={loading || !kiBereit}
                onClick={() => void sende()}
                className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-black text-white hover:bg-amber-500 disabled:opacity-40"
              >
                {loading ? '…' : 'Beraten'}
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-[var(--app-text-muted)]">
              Chat und Profil bleiben in diesem Browser. Fotos liegen in IndexedDB, nicht in der Omnia-Cloud.
            </p>
          </div>
        </section>
      </div>
    </PageChrome>
  )
}

function profilKurztext(p: ModeProfil): string {
  const teile: string[] = []
  if (p.erscheinung === 'maennlich') teile.push('männlich')
  if (p.erscheinung === 'weiblich') teile.push('weiblich')
  if (p.alter) teile.push(`${p.alter} J.`)
  if (p.groesseCm) teile.push(`${p.groesseCm} cm`)
  if (p.anlass) teile.push(p.anlass)
  if (p.stile.length) teile.push(p.stile.slice(0, 2).join(', '))
  return teile.join(' · ')
}

function Klapp({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string
  summary?: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section className={pageSectionShellClass}>
      <button
        type="button"
        className={`${pageSectionHeaderClass} flex w-full items-center justify-between gap-3 text-left`}
        onClick={onToggle}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h2 className={pageSectionTitleClass}>{title}</h2>
          {summary ? <p className="mt-0.5 truncate text-[11px] text-[var(--app-text-muted)]">{summary}</p> : null}
        </div>
        <CollapsibleTriggerEnd open={open} tone="amber" size="sm" />
      </button>
      {open ? <div className={`${pageSectionPanelClass} space-y-3`}>{children}</div> : null}
    </section>
  )
}

function ProfilFelder({
  profil,
  setProfil,
}: {
  profil: ModeProfil
  setProfil: (patch: Partial<ModeProfil>) => void
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Feld label="Erscheinung">
          <select
            className={appInputClass}
            value={profil.erscheinung}
            onChange={(e) => setProfil({ erscheinung: e.target.value })}
          >
            {MODE_ERSCHEINUNG.map((o) => (
              <option key={o.id || 'leer'} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </Feld>
        <Feld label="Alter">
          <input
            className={appInputClass}
            inputMode="numeric"
            value={profil.alter}
            onChange={(e) => setProfil({ alter: parseZahl(e.target.value) })}
            placeholder="34"
          />
        </Feld>
        <Feld label="Größe (cm)">
          <input
            className={appInputClass}
            inputMode="numeric"
            value={profil.groesseCm}
            onChange={(e) => setProfil({ groesseCm: parseZahl(e.target.value) })}
            placeholder="178"
          />
        </Feld>
        <Feld label="Gewicht (optional)">
          <input
            className={appInputClass}
            inputMode="decimal"
            value={profil.gewichtKg}
            onChange={(e) => setProfil({ gewichtKg: parseZahl(e.target.value) })}
            placeholder="kg"
          />
        </Feld>
        <Feld label="Oberteil">
          <input
            className={appInputClass}
            value={profil.groesseOberteil}
            onChange={(e) => setProfil({ groesseOberteil: e.target.value })}
            placeholder="M / 50"
          />
        </Feld>
        <Feld label="Hose">
          <input
            className={appInputClass}
            value={profil.groesseHose}
            onChange={(e) => setProfil({ groesseHose: e.target.value })}
            placeholder="32/32"
          />
        </Feld>
        <Feld label="Schuhe">
          <input
            className={appInputClass}
            value={profil.groesseSchuhe}
            onChange={(e) => setProfil({ groesseSchuhe: e.target.value })}
            placeholder="43"
          />
        </Feld>
        <Feld label="Körpertyp">
          <input
            className={appInputClass}
            value={profil.koerpertyp}
            onChange={(e) => setProfil({ koerpertyp: e.target.value })}
            placeholder="athletisch …"
          />
        </Feld>
        <Feld label="Hautton">
          <input
            className={appInputClass}
            value={profil.hautton}
            onChange={(e) => setProfil({ hautton: e.target.value })}
          />
        </Feld>
        <Feld label="Haar">
          <input
            className={appInputClass}
            value={profil.haarfarbe}
            onChange={(e) => setProfil({ haarfarbe: e.target.value })}
          />
        </Feld>
        <Feld label="Bart">
          <input
            className={appInputClass}
            value={profil.bart}
            onChange={(e) => setProfil({ bart: e.target.value })}
          />
        </Feld>
        <Feld label="Augen">
          <input
            className={appInputClass}
            value={profil.augenfarbe}
            onChange={(e) => setProfil({ augenfarbe: e.target.value })}
          />
        </Feld>
      </div>
      <div>
        <p className={appLabelClass}>Stil</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {MODE_STIL_OPTIONEN.map((stil) => {
            const an = profil.stile.includes(stil)
            return (
              <button
                key={stil}
                type="button"
                onClick={() =>
                  setProfil({
                    stile: an ? profil.stile.filter((x) => x !== stil) : [...profil.stile, stil].slice(0, 6),
                  })
                }
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  an
                    ? 'border-amber-500/70 bg-amber-950/40 text-amber-100'
                    : 'border-[var(--app-border-strong)] text-[var(--app-text-muted)]'
                }`}
              >
                {stil}
              </button>
            )
          })}
        </div>
      </div>
      <Feld label="Farben mag ich">
        <input
          className={appInputClass}
          value={profil.farbenMag}
          onChange={(e) => setProfil({ farbenMag: e.target.value })}
        />
      </Feld>
      <Feld label="Eher nicht">
        <input
          className={appInputClass}
          value={profil.farbenNicht}
          onChange={(e) => setProfil({ farbenNicht: e.target.value })}
        />
      </Feld>
      <Feld label="Anlass">
        <select className={appInputClass} value={profil.anlass} onChange={(e) => setProfil({ anlass: e.target.value })}>
          <option value="">Egal</option>
          {MODE_ANLASS_OPTIONEN.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </Feld>
      <div className="grid grid-cols-2 gap-2">
        <Feld label="Budget von €">
          <input
            className={appInputClass}
            inputMode="decimal"
            value={profil.budgetMin}
            onChange={(e) => setProfil({ budgetMin: parseZahl(e.target.value) })}
          />
        </Feld>
        <Feld label="bis €">
          <input
            className={appInputClass}
            inputMode="decimal"
            value={profil.budgetMax}
            onChange={(e) => setProfil({ budgetMax: parseZahl(e.target.value) })}
          />
        </Feld>
      </div>
      <Feld label="Sonst noch">
        <textarea
          className={`${appInputClass} min-h-[3.5rem] resize-y`}
          value={profil.notizen}
          onChange={(e) => setProfil({ notizen: e.target.value })}
          placeholder="oft Jeans + Sneaker …"
        />
      </Feld>
    </div>
  )
}

function Feld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className={`${appLabelClass} mb-1.5 block`}>{label}</span>
      {children}
    </label>
  )
}

function Chip({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-hover)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--app-text)] disabled:opacity-40"
    >
      {children}
    </button>
  )
}

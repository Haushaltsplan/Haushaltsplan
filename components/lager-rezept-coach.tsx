'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { CollapsibleRowHeaderEnd, LABEL_EINKLAPPEN } from '@/components/collapsible-ui'
import {
  COACH_MAX_IMAGES_PER_SEND,
  coachImageDataUrl,
  compressImageFileForCoach,
  type CoachImagePart,
} from '@/lib/finance-coach-images'
import { appModalBackdropClassName, appModalPanelClassName } from '@/lib/app-modal-overlay'
import { buildMehrKochanleitungPrompt } from '@/lib/rezept-kochanleitung-prompt'
import { normalisiereRezeptKategorie } from '@/lib/lager-rezept-katalog-kategorie'
import { supabase } from '@/lib/supabase'
import { CoachFormattedReply, formatInlineMarkdown } from '@/components/coach-formatted-reply'
import { KiBrandChip } from '@/components/ki-brand'
import { KI_ASSISTANT_BUBBLE, KI_INNER_WELL, KI_PANEL_OUTER } from '@/lib/ki-ui'
import {
  normalisiereKcalGesamt,
  parseRezeptCoachAntwortJson,
  skaliereRezeptAufPortionen,
  type RezeptCoachAntwort,
  type RezeptGericht,
} from '@/lib/rezept-coach-types'
import { fehlendeFuerEinkauf, zutatenZumAusbuchen, zutatLagerStatus } from '@/lib/rezept-lager-abgleich'
import { merkeFuerEinkauf, merkeNameFuerEinkauf } from '@/lib/einkaufsliste-merker'

export type LagerRezeptArtikelZeile = { id?: string; name: string; menge: number; einheit: string }

type ChatTurn = {
  role: 'user' | 'assistant'
  content: string
  images?: CoachImagePart[]
  /** Strukturierte Rezeptdaten (wenn die API sie liefert). */
  structured?: RezeptCoachAntwort
}

function stripEarlierUserImagesForApi(msgs: ChatTurn[]): ChatTurn[] {
  let lastUser = -1
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'user') {
      lastUser = i
      break
    }
  }
  return msgs.map((m, i) =>
    m.role === 'user' && m.images?.length && i !== lastUser ? { role: 'user', content: m.content } : m,
  )
}

type Props = {
  artikel: LagerRezeptArtikelZeile[]
  /** Nach erfolgreichem Ausbuchen z. B. `ladeDaten()` aufrufen. */
  onLagerAktualisiert?: () => void
  /** Nach Speichern/Löschen im Rezeptkatalog — Liste neu laden. */
  onKatalogGeaendert?: () => void
}

const MD_STRONG = 'font-semibold text-[var(--app-text)]'

function toDatetimeLocalValue(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function portionenAnzeigeText(n: number): string {
  const r = Math.round(n * 2) / 2
  if (r % 1 === 0) return String(r)
  return String(r)
}

export function RezeptStructuredCards({
  data,
  artikel,
  buchungKey,
  onBuchen,
  onMehrAnleitung,
  kiBusy,
  anzeigeNur,
  onImKatalogSpeichern,
  speichernKatalogKey,
}: {
  data: RezeptCoachAntwort
  artikel: LagerRezeptArtikelZeile[]
  buchungKey: string | null
  onBuchen: (gericht: RezeptGericht, actionKey: string) => void
  onMehrAnleitung: (gericht: RezeptGericht) => void
  kiBusy: boolean
  /** Nur Lesen (Katalog): keine Schaltflächen oben. */
  anzeigeNur?: boolean
  onImKatalogSpeichern?: (gericht: RezeptGericht, actionKey: string) => void
  speichernKatalogKey?: string | null
}) {
  const [portionenZiel, setPortionenZiel] = useState<Record<string, number>>({})

  return (
    <div className="space-y-4">
      {data.einleitung?.trim() ? (
        <p className="text-[13px] leading-relaxed text-[var(--app-text)]">{formatInlineMarkdown(data.einleitung.trim(), MD_STRONG)}</p>
      ) : null}
      {(data.rezepte || []).map((g, idx) => {
        const actionKey = `${g.titel}#${idx}`
        const basisPortionen = Number.isFinite(g.portionen) && g.portionen >= 0.5 ? g.portionen : 1
        const zielPortionen = portionenZiel[actionKey] ?? basisPortionen
        const anzeige = skaliereRezeptAufPortionen(g, basisPortionen, zielPortionen)
        const ausbuchZeilen = zutatenZumAusbuchen(anzeige, artikel)
        const fehlend = fehlendeFuerEinkauf(anzeige, artikel)
        const fehlendAnzahl = fehlend.produktIds.length + fehlend.namen.length
        const kannBuchen = ausbuchZeilen.length > 0
        let bestandOk = true
        for (const z of anzeige.zutaten || []) {
          const st = zutatLagerStatus(z, artikel)
          if (st.gematcht && !st.ausreichend) bestandOk = false
        }
        const buchenDisabled = kiBusy || !kannBuchen || !bestandOk || buchungKey !== null
        const kcalGes = normalisiereKcalGesamt(anzeige.geschaetzte_kcal_gesamt)
        const kategorieAnzeige = normalisiereRezeptKategorie(anzeige.kategorie ?? null)
        return (
          <div
            key={actionKey}
            className="rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] p-3 shadow-inner shadow-black/15"
          >
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--app-border)] pb-2">
              <div className="min-w-0">
                <h4 className="text-[15px] font-bold tracking-tight text-teal-200">{anzeige.titel}</h4>
                <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
                  {Math.abs(zielPortionen - basisPortionen) > 1e-4 ? (
                    <>
                      Zutaten für {portionenAnzeigeText(zielPortionen)} Personen · Rezept ursprünglich für{' '}
                      {portionenAnzeigeText(basisPortionen)}
                    </>
                  ) : (
                    <>Ca. {portionenAnzeigeText(basisPortionen)} Portion(en)</>
                  )}
                </p>
                {kcalGes != null ? (
                  <p className="mt-1 text-[11px] font-semibold text-amber-100/85">
                    Geschätzt ca. {kcalGes} kcal fürs gesamte Gericht (alle Portionen)
                  </p>
                ) : null}
                {kategorieAnzeige ? (
                  <p className="mt-1 text-[11px] font-semibold text-[var(--app-text-muted)]">Kategorie: {kategorieAnzeige}</p>
                ) : null}
              </div>
              {anzeigeNur ? (
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  {fehlendAnzahl > 0 ? (
                    <button
                      type="button"
                      className="rounded-lg border border-amber-600/55 bg-amber-950/40 px-2.5 py-1.5 text-[11px] font-bold text-amber-100 hover:bg-amber-900/35"
                      onClick={() => {
                        for (const id of fehlend.produktIds) merkeFuerEinkauf(id)
                        for (const n of fehlend.namen) merkeNameFuerEinkauf(n)
                        toast.success(
                          `${fehlendAnzahl} fehlende Zutat${fehlendAnzahl === 1 ? '' : 'en'} auf die Einkaufsliste gesetzt.`,
                        )
                      }}
                    >
                      Fehlende auf Einkaufsliste ({fehlendAnzahl})
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-hover)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--app-text)] hover:bg-[var(--app-surface-hover)]"
                    onClick={async () => {
                      const text = buildMehrKochanleitungPrompt(anzeige)
                      try {
                        await navigator.clipboard.writeText(text)
                        toast('Vorlage in die Zwischenablage — im Bereich „KI: Rezepte“ einfügen und senden.', { icon: '📋' })
                      } catch {
                        toast.error('Zwischenablage nicht möglich — Rezept-Coach öffnen und dort nach „ausführlicher“ fragen.')
                      }
                    }}
                  >
                    Detailliertere Anleitung (KI) …
                  </button>
                </div>
              ) : (
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  {fehlendAnzahl > 0 ? (
                    <button
                      type="button"
                      className="rounded-lg border border-amber-600/55 bg-amber-950/40 px-2.5 py-1.5 text-[11px] font-bold text-amber-100 hover:bg-amber-900/35"
                      onClick={() => {
                        for (const id of fehlend.produktIds) merkeFuerEinkauf(id)
                        for (const n of fehlend.namen) merkeNameFuerEinkauf(n)
                        toast.success(
                          `${fehlendAnzahl} fehlende Zutat${fehlendAnzahl === 1 ? '' : 'en'} auf die Einkaufsliste gesetzt.`,
                        )
                      }}
                    >
                      Fehlende auf Einkaufsliste ({fehlendAnzahl})
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={buchenDisabled}
                    onClick={() => onBuchen(anzeige, actionKey)}
                    className="rounded-lg border border-amber-700/55 bg-amber-950/35 px-2.5 py-1.5 text-[11px] font-bold text-amber-100 hover:bg-amber-900/40 disabled:opacity-40"
                  >
                    {buchungKey === actionKey ? 'Buche …' : 'Zutaten aus Vorrat ausbuchen'}
                  </button>
                  <button
                    type="button"
                    disabled={kiBusy}
                    onClick={() => onMehrAnleitung(anzeige)}
                    className="rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-hover)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] disabled:opacity-40"
                  >
                    Anleitung noch feiner
                  </button>
                  {onImKatalogSpeichern ? (
                    <button
                      type="button"
                      disabled={kiBusy || speichernKatalogKey !== null}
                      onClick={() => void onImKatalogSpeichern(anzeige, actionKey)}
                      className="rounded-lg border border-teal-600/55 bg-teal-950/40 px-2.5 py-1.5 text-[11px] font-bold text-teal-100 hover:bg-teal-900/35 disabled:opacity-40"
                    >
                      {speichernKatalogKey === actionKey ? 'Speichere …' : 'Im Katalog speichern'}
                    </button>
                  ) : null}
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)]/35 px-2 py-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--app-text-muted)]">Portionen</span>
              <label className="flex flex-wrap items-center gap-1.5 text-[12px] font-bold text-[var(--app-text)]">
                <span className="text-[var(--app-text-muted)]">Für</span>
                <input
                  type="number"
                  min={0.5}
                  max={99}
                  step={0.5}
                  className="w-16 rounded border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-1.5 py-0.5 text-center text-xs font-black tabular-nums text-teal-100"
                  value={zielPortionen}
                  onChange={(e) => {
                    const v = Number(e.target.value.replace(',', '.'))
                    if (!Number.isFinite(v)) return
                    setPortionenZiel((p) => ({
                      ...p,
                      [actionKey]: Math.min(99, Math.max(0.5, Math.round(v * 2) / 2)),
                    }))
                  }}
                  aria-label="Anzahl Portionen bzw. Personen"
                />
                <span className="text-[var(--app-text-muted)]">Personen</span>
              </label>
              {Math.abs(zielPortionen - basisPortionen) > 1e-4 ? (
                <span className="text-[10px] text-[var(--app-text-muted)]">Zutaten &amp; kcal proportional angepasst</span>
              ) : null}
            </div>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">Zutaten (Mengen)</p>
            <ul className="mt-1.5 list-none space-y-1.5 text-[13px] leading-snug text-[var(--app-text)]">
              {(anzeige.zutaten || []).map((z, zi) => {
                const st = zutatLagerStatus(z, artikel)
                return (
                  <li key={zi} className="flex items-start gap-2 pl-0.5">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                        st.ausreichend
                          ? 'bg-emerald-900/50 text-emerald-300 ring-1 ring-emerald-600/45'
                          : 'bg-[var(--app-surface-hover)] text-[var(--app-text-muted)] ring-1 ring-[var(--app-border-strong)]/80'
                      }`}
                      aria-hidden
                      title={st.ausreichend ? 'Im Lager vorhanden' : 'Nicht oder nicht ausreichend im Lager'}
                    >
                      {st.ausreichend ? '✓' : ''}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold text-[var(--app-text)]">
                        {z.menge} {z.einheit}
                      </span>{' '}
                      {z.name}
                      {st.gematcht && !st.ausreichend ? (
                        <span className="text-rose-400">
                          {' '}
                          — im Lager: {st.bestand} {st.einheit}, benötigt {st.benoetigt}
                        </span>
                      ) : null}
                      {!st.gematcht ? (
                        <span className="text-[var(--app-text-muted)]"> — nicht im Lager</span>
                      ) : st.ausreichend && st.produktName ? (
                        <span className="text-emerald-400/80"> — {st.produktName}</span>
                      ) : null}
                    </span>
                  </li>
                )
              })}
            </ul>
            {anzeige.kochschritte?.length ? (
              <>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">Schritt-für-Schritt</p>
                <p className="mb-2 text-[12px] leading-relaxed text-[var(--app-text-muted)]">
                  <span className="font-semibold text-[var(--app-text-muted)]">Einen Schritt nach dem anderen</span> — nichts
                  überspringen. Wenn etwas unklar ist, unten im Chat nachfragen.
                </p>
                <ol className="mt-1.5 list-outside list-decimal space-y-3 pl-5 text-[14px] leading-relaxed text-[var(--app-text)] marker:font-bold marker:text-teal-400/90">
                  {anzeige.kochschritte.map((s, si) => (
                    <li key={si} className="border-l-2 border-teal-900/50 pl-3">
                      {formatInlineMarkdown(s, MD_STRONG)}
                    </li>
                  ))}
                </ol>
              </>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export function LagerRezeptCoach({ artikel, onLagerAktualisiert, onKatalogGeaendert }: Props) {
  const [open, setOpen] = useState(false)
  const [kiConfigured, setKiConfigured] = useState<boolean | null>(null)
  const [, setKiProvider] = useState<'gemini' | 'openai' | null>(null)
  const [input, setInput] = useState('')
  const [draftImages, setDraftImages] = useState<CoachImagePart[]>([])
  const [loading, setLoading] = useState(false)
  const [buchungKey, setBuchungKey] = useState<string | null>(null)
  const [mahlzeitDialog, setMahlzeitDialog] = useState<null | { gericht: RezeptGericht; actionKey: string }>(null)
  const [gekochtAmInput, setGekochtAmInput] = useState('')
  const [messages, setMessages] = useState<ChatTurn[]>([])
  const [speichernKatalogKey, setSpeichernKatalogKey] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const lagerPayload = useMemo(
    () => ({
      artikel: artikel.map((a) => ({
        id: typeof a.id === 'string' ? a.id : '',
        name: a.name,
        menge: a.menge,
        einheit: a.einheit,
      })),
    }),
    [artikel],
  )

  useEffect(() => {
    if (!open) return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        setKiConfigured(null)
        setKiProvider(null)
      }
    })
    void fetch('/api/finance-coach')
      .then((r) => r.json())
      .then((d: { configured?: boolean; provider?: string }) => {
        if (!cancelled) {
          setKiConfigured(d.configured === true)
          setKiProvider(d.provider === 'gemini' || d.provider === 'openai' ? d.provider : null)
        }
      })
      .catch(() => {
        if (!cancelled) setKiConfigured(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open, loading])

  useEffect(() => {
    if (!mahlzeitDialog) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && buchungKey === null) setMahlzeitDialog(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mahlzeitDialog, buchungKey])

  const oeffneMahlzeitDialog = useCallback((gericht: RezeptGericht, actionKey: string) => {
    const lines = zutatenZumAusbuchen(gericht, artikel)
    if (!lines.length) {
      toast.error('Keine Zutaten mit ausreichendem Bestand zum Ausbuchen.')
      return
    }
    setMahlzeitDialog({ gericht, actionKey })
    setGekochtAmInput(toDatetimeLocalValue())
  }, [artikel])

  const bestaetigeMahlzeitBuchung = useCallback(async () => {
    if (!mahlzeitDialog) return
    const { gericht, actionKey } = mahlzeitDialog
    const lines = zutatenZumAusbuchen(gericht, artikel)
    if (!lines.length) {
      toast.error('Keine Lager-Zutaten zum Ausbuchen.')
      return
    }
    let gekochtIso: string
    try {
      const d = new Date(gekochtAmInput)
      if (!Number.isFinite(d.getTime())) throw new Error('bad')
      gekochtIso = d.toISOString()
    } catch {
      toast.error('Bitte Datum und Uhrzeit prüfen.')
      return
    }

    setBuchungKey(actionKey)
    try {
      const res = await fetch('/api/lager/mahlzeit/buchen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titel: gericht.titel,
          gekocht_am: gekochtIso,
          quelle: 'rezept',
          zeilen: lines.map((z) => ({
            produkt_id: z.produkt_id,
            menge: z.menge,
            notiz: `Rezept: ${gericht.titel}`.slice(0, 500),
          })),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.status === 501) {
        toast.error(
          typeof body.error === 'string'
            ? body.error
            : 'Ausbuchen ist ohne SUPABASE_SERVICE_ROLE_KEY in .env.local nicht möglich.',
        )
        return
      }
      if (!res.ok) {
        toast.error(typeof body.error === 'string' ? body.error : 'Ausbuchen fehlgeschlagen.')
        return
      }
      const k = typeof body.kosten_geschaetzt_eur === 'number' ? body.kosten_geschaetzt_eur : null
      const eur =
        k != null && Number.isFinite(k)
          ? k.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
          : null
      toast.success(
        eur
          ? `Mahlzeit gebucht — geschätzte Zutatenkosten: ${eur}. Rückblick unter „Gekocht & gegessen“.`
          : 'Mahlzeit gebucht — siehe „Gekocht & gegessen“.',
      )
      setMahlzeitDialog(null)
      onLagerAktualisiert?.()
    } catch {
      toast.error('Netzwerkfehler beim Ausbuchen.')
    } finally {
      setBuchungKey(null)
    }
  }, [mahlzeitDialog, gekochtAmInput, onLagerAktualisiert])

  const vorbereiteMehrAnleitung = useCallback((gericht: RezeptGericht) => {
    setInput(buildMehrKochanleitungPrompt(gericht))
    toast('Ausführliche Anleitung eingefügt — bitte „Senden“.', { icon: '✏️' })
  }, [])

  const speichernImKatalog = useCallback(
    async (gericht: RezeptGericht, actionKey: string) => {
      const titel = String(gericht.titel || '').trim()
      if (!titel) {
        toast.error('Rezept ohne Titel kann nicht gespeichert werden.')
        return
      }
      const portionen = Number(gericht.portionen)
      if (!Number.isFinite(portionen) || portionen < 0.5) {
        toast.error('Portionen ungültig.')
        return
      }
      const kcal = normalisiereKcalGesamt(gericht.geschaetzte_kcal_gesamt)
      const kategorie = normalisiereRezeptKategorie(gericht.kategorie)
      setSpeichernKatalogKey(actionKey)
      try {
        const { error } = await supabase.from('lager_rezept_katalog').insert({
          titel,
          portionen: Math.round(portionen * 100) / 100,
          gericht_json: { ...gericht, geschaetzte_kcal_gesamt: kcal, ...(kategorie ? { kategorie } : {}) },
          geschaetzte_kcal_gesamt: kcal,
          kategorie,
        })
        if (error) {
          if (error.message.includes('Could not find') || error.message.includes('schema cache')) {
            toast.error('Tabelle „lager_rezept_katalog“ fehlt — bitte Migration in Supabase ausführen.')
          } else {
            toast.error(error.message)
          }
          return
        }
        toast.success('Rezept im Katalog gespeichert.')
        onKatalogGeaendert?.()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')
      } finally {
        setSpeichernKatalogKey(null)
      }
    },
    [onKatalogGeaendert],
  )

  const send = useCallback(async () => {
    const text = input.trim()
    const hasImg = draftImages.length > 0
    if ((!text && !hasImg) || loading || kiConfigured !== true) return

    const defaultPrompt =
      'Schlag mir bitte 2–3 konkrete Rezepte vor, die vor allem meinen aktuellen Vorrat in der Speisekammer aufbrauchen — mit **exakten Mengen** passend zu meinen Basiseinheiten und einer **sehr langen, idiotensicheren Schritt-für-Schritt-Kochanleitung** (jeder Schritt nur eine Sache, mit Zeiten und Grad wo sinnvoll).'
    const caption = text || (hasImg ? defaultPrompt : '')

    setInput('')
    const attached = hasImg ? draftImages.map((p) => ({ ...p })) : undefined
    setDraftImages([])
    setLoading(true)

    const userTurn: ChatTurn = attached?.length ? { role: 'user', content: caption, images: attached } : { role: 'user', content: caption }
    const next: ChatTurn[] = [...messages, userTurn]
    setMessages(next)
    const payloadMessages = stripEarlierUserImagesForApi(next)

    try {
      const res = await fetch('/api/lager/rezept-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: payloadMessages,
          lager: lagerPayload,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          res.status === 422
            ? typeof data.error === 'string'
              ? data.error
              : 'Die KI-Antwort konnte nicht als Rezept gelesen werden. Bitte erneut senden.'
            : typeof data.error === 'string'
              ? data.error
              : 'KI-Anfrage fehlgeschlagen.'
        toast.error(msg)
        setMessages((p) => p.slice(0, -1))
        return
      }
      if (typeof data.reply !== 'string') {
        toast.error('Unerwartete Antwort.')
        setMessages((p) => p.slice(0, -1))
        return
      }
      const rawStructured = (data as { structured?: unknown }).structured
      let structured: RezeptCoachAntwort | undefined
      if (
        rawStructured &&
        typeof rawStructured === 'object' &&
        Array.isArray((rawStructured as RezeptCoachAntwort).rezepte) &&
        (rawStructured as RezeptCoachAntwort).rezepte!.length > 0
      ) {
        structured = rawStructured as RezeptCoachAntwort
      } else {
        structured = parseRezeptCoachAntwortJson(data.reply) ?? undefined
      }
      setMessages((p) => [...p, { role: 'assistant', content: data.reply, structured }])
    } catch {
      toast.error('Netzwerkfehler.')
      setMessages((p) => p.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }, [draftImages, input, loading, messages, lagerPayload, kiConfigured])

  const mitBestand = artikel.filter((a) => a.menge > 0).length

  return (
    <>
    <div className={`rounded-[2rem] ${KI_PANEL_OUTER}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-violet-950/20 md:px-8"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <KiBrandChip iconSize={14} />
            <h2 className="min-w-0 text-lg font-black text-violet-100">
              Rezepte gegen Lebensmittelverschwendung
            </h2>
          </div>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">{mitBestand} Artikel mit Bestand</p>
        </div>
        <CollapsibleRowHeaderEnd open={open} labels={LABEL_EINKLAPPEN} tone="violet" />
      </button>

      {open && (
        <div className="flex flex-col border-t border-[var(--app-border)] px-4 pb-5 pt-3 md:px-8">
          {kiConfigured === null && (
            <p className="mb-3 shrink-0 rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] p-3 text-xs text-[var(--app-text-muted)]">Konfiguration wird geprüft …</p>
          )}
          {kiConfigured === false && (
            <div className="mb-3 shrink-0 rounded-xl border border-amber-700/60 bg-amber-950/40 p-3 text-xs leading-relaxed text-amber-100">
              <p className="font-bold text-amber-200">KI ist noch nicht eingerichtet</p>
              <p className="mt-2">
                Wie beim Finanz-Coach: <code className="rounded bg-[var(--app-surface-muted)] px-1">GEMINI_API_KEY</code> oder{' '}
                <code className="rounded bg-[var(--app-surface-muted)] px-1">OPENAI_API_KEY</code> in <code className="rounded bg-[var(--app-surface-muted)] px-1">.env.local</code>, dann
                Dev-Server neu starten.
              </p>
            </div>
          )}
          <div className="mb-1 flex shrink-0 items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-text-muted)]">Konversation</span>
            {messages.length > 0 && (
              <span className="text-[10px] tabular-nums text-[var(--app-text-muted)]">
                {messages.length} {messages.length === 1 ? 'Nachricht' : 'Nachrichten'}
              </span>
            )}
          </div>
          <div
            className={`flex min-h-[13rem] max-h-[min(30rem,52vh)] flex-col overflow-hidden rounded-xl ${KI_INNER_WELL}`}
          >
            <div className="app-scroll-panel min-h-0 flex-1 space-y-4 overscroll-contain p-3 md:p-4">
              {messages.length === 0 ? null : null}
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[min(100%,26rem)] rounded-2xl rounded-br-md border border-teal-700/45 bg-teal-950/50 px-3.5 py-2.5 shadow-sm shadow-black/20">
                      <div className="mb-1.5 flex items-center justify-end gap-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-teal-500/90">Du</span>
                      </div>
                      {m.images && m.images.length > 0 && (
                        <div className="mb-2 flex flex-wrap justify-end gap-2">
                          {m.images.map((im, j) => (
                            // eslint-disable-next-line @next/next/no-img-element -- Chat-Thumbnails
                            <img
                              key={j}
                              src={coachImageDataUrl(im)}
                              alt=""
                              className="max-h-32 max-w-[min(100%,11rem)] rounded-lg border border-teal-900/40 object-contain"
                            />
                          ))}
                        </div>
                      )}
                      <p className="text-left text-[13px] leading-relaxed text-teal-50">{m.content}</p>
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex justify-start">
                    <div className={`w-full max-w-full rounded-2xl rounded-bl-md pl-3.5 pr-3 py-3 md:pl-4 md:pr-4 ${KI_ASSISTANT_BUBBLE}`}>
                      <div className="mb-2 flex items-center gap-2 border-b border-violet-800/50 pb-2">
                        <KiBrandChip iconSize={12} decorative={false} />
                        <span className="text-[11px] font-semibold text-violet-200/90">Rezeptvorschläge</span>
                      </div>
                      {m.structured ? (
                        <RezeptStructuredCards
                          data={m.structured}
                          artikel={artikel}
                          buchungKey={buchungKey}
                          onBuchen={(g, key) => oeffneMahlzeitDialog(g, key)}
                          onMehrAnleitung={vorbereiteMehrAnleitung}
                          kiBusy={loading}
                          onImKatalogSpeichern={speichernImKatalog}
                          speichernKatalogKey={speichernKatalogKey}
                        />
                      ) : (
                        <CoachFormattedReply content={m.content} accent="teal" />
                      )}
                    </div>
                  </div>
                ),
              )}
              {loading && (
                <div className="flex items-center gap-2 rounded-lg border border-violet-500/35 bg-violet-950/40 px-3 py-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400/60 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-400" />
                  </span>
                  <span className="text-xs font-semibold text-violet-200/95">Antwort wird erstellt …</span>
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>

          <div className="mt-4 shrink-0 space-y-2 border-t border-[var(--app-border)] pt-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading || kiConfigured !== true}
                onClick={() => setInput('Drei schnelle Reste-Rezepte für heute Abend, bitte mit Portionsangabe.')}
                className="rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-hover)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] disabled:opacity-40"
              >
                3 Reste-Rezepte
              </button>
              <button
                type="button"
                disabled={loading || kiConfigured !== true}
                onClick={() => setInput('Was sollte ich zuerst aufbrauchen, bevor es schlecht wird — und womit kombinieren?')}
                className="rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-hover)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] disabled:opacity-40"
              >
                Zuerst aufbrauchen
              </button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
              multiple
              className="hidden"
              onChange={async (e) => {
                const files = e.target.files
                e.target.value = ''
                if (!files?.length) return
                const next: CoachImagePart[] = [...draftImages]
                for (const file of [...files]) {
                  if (next.length >= COACH_MAX_IMAGES_PER_SEND) {
                    toast.error(`Maximal ${COACH_MAX_IMAGES_PER_SEND} Bilder pro Nachricht.`)
                    break
                  }
                  try {
                    next.push(await compressImageFileForCoach(file))
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Bild konnte nicht verarbeitet werden.')
                  }
                }
                setDraftImages(next)
              }}
            />
            {draftImages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {draftImages.map((im, idx) => (
                  <div key={idx} className="group relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coachImageDataUrl(im)}
                      alt=""
                      className="h-16 w-16 rounded-lg border border-[var(--app-border-strong)] object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setDraftImages((d) => d.filter((_, j) => j !== idx))}
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white hover:bg-rose-500"
                      aria-label="Bild entfernen"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (kiConfigured === true && (input.trim() || draftImages.length > 0)) void send()
                }
              }}
              rows={2}
              disabled={kiConfigured === false}
              placeholder={
                kiConfigured === false
                  ? 'Zuerst KI-Schlüssel in .env.local …'
                  : 'Nachricht …'
              }
              className="w-full resize-none rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] p-3 text-sm text-[var(--app-text)] outline-none focus:ring-2 focus:ring-teal-500/40 disabled:opacity-50"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading || kiConfigured !== true || draftImages.length >= COACH_MAX_IMAGES_PER_SEND}
                onClick={() => fileRef.current?.click()}
                className="rounded-xl border border-sky-700/60 bg-sky-950/50 px-3 py-2 text-xs font-bold text-sky-200 hover:bg-sky-900/40 disabled:opacity-40"
              >
                Foto anhängen
              </button>
              <button
                type="button"
                onClick={() => {
                  setMessages([])
                  setDraftImages([])
                  toast('Chat geleert.')
                }}
                className="rounded-xl border border-[var(--app-border-strong)] px-3 py-2 text-xs font-bold text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)]"
              >
                Verlauf leeren
              </button>
              <button
                type="button"
                disabled={
                  loading || (!input.trim() && draftImages.length === 0) || kiConfigured === false || kiConfigured === null
                }
                onClick={() => void send()}
                className="flex-1 rounded-xl bg-teal-600 py-2 text-sm font-black text-white hover:bg-teal-500 disabled:opacity-40"
              >
                Senden
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    {mahlzeitDialog && (
      <div
        className={appModalBackdropClassName}
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget && buchungKey === null) setMahlzeitDialog(null)
        }}
      >
        <div role="dialog" aria-modal="true" className={`${appModalPanelClassName} p-4 sm:p-5`}>
          <h3 className="text-base font-black text-amber-200">Mahlzeit ausbuchen</h3>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">
            Gericht: <span className="font-semibold text-[var(--app-text)]">{mahlzeitDialog.gericht.titel}</span>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[var(--app-text-muted)]">
            Wann hast du gekocht / gegessen? (erscheint im Rückblick „Gekocht &amp; gegessen“)
          </p>
          <label className="mt-3 block text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">Zeitpunkt</label>
          <input
            type="datetime-local"
            value={gekochtAmInput}
            onChange={(e) => setGekochtAmInput(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text)] outline-none focus:ring-2 focus:ring-amber-500/40"
          />
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={buchungKey !== null}
              onClick={() => setMahlzeitDialog(null)}
              className="rounded-xl border border-[var(--app-border-strong)] px-4 py-2 text-xs font-bold text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] disabled:opacity-40"
            >
              Abbrechen
            </button>
            <button
              type="button"
              disabled={buchungKey !== null}
              onClick={() => void bestaetigeMahlzeitBuchung()}
              className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-black text-white hover:bg-amber-500 disabled:opacity-40"
            >
              {buchungKey !== null ? 'Buche …' : 'Jetzt ausbuchen'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

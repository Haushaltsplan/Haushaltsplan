'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import {
  LONGFORM_SZENEN,
  type LongformAbschnittId,
  type LongformBildKandidat,
  type LongformProjektZustand,
  type LongformSatz,
  type LongformStimmeEinstellungen,
} from '@/lib/youtube/longform/longform-types'
import { LF_FELD, LF_KNOPF, lfApi, type ZustandAntwort } from './longform-api'

const SZENE_LABEL: Record<(typeof LONGFORM_SZENEN)[number], string> = {
  hook_zahl: 'Hook · große Zahl',
  hook_frage: 'Hook · Leitfrage',
  hook_bild: 'Hook · Foto',
  chart_linie: 'Chart · Linie',
  chart_endwert: 'Chart · Endwert',
  chart_drawdown: 'Chart · Einbruch',
  chart_vergleich: 'Chart · S&P-Vergleich',
  moat_geschaeft: 'Moat · Geschäft',
  moat_pfeiler: 'Moat · Pfeiler',
  moat_scorecard: 'Moat · Scorecard',
  moat_finanzen: 'Finanzen',
  moat_segmente: 'Moat · Umsatzmix',
  zahl_reihe: 'Zahlen · Jahresreihe',
  bild: 'Foto / Clip',
  titel_karte: 'Titelkarte',
  abo_karte: 'Like und Abo',
  disclaimer: 'Disclaimer',
  schluss: 'Cheers',
}

const HINWEIS_FARBE: Record<string, string> = {
  zahl_ohne_fakt: 'border-red-500/40 bg-red-500/10 text-red-300',
  fakt_unbekannt: 'border-red-500/40 bg-red-500/10 text-red-300',
  behauptung: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  floskel: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  wiederholung: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
}

/** Eleven v4: nur Stabilität + Ähnlichkeit (Style/Speed gibt es dort nicht). */
const REGLER: { key: keyof LongformStimmeEinstellungen; label: string; min: number; max: number; step: number }[] = [
  { key: 'stability', label: 'Stabilität', min: 0, max: 1, step: 0.05 },
  { key: 'similarity', label: 'Ähnlichkeit', min: 0, max: 1, step: 0.05 },
]

export function StimmRegler({ wert, onChange }: { wert: LongformStimmeEinstellungen; onChange: (w: LongformStimmeEinstellungen) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-[var(--app-text-muted)]">Eleven v4 · niedrigere Stabilität = expressiver</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {REGLER.map((r) => (
          <label key={r.key} className="text-xs text-[var(--app-text-muted)]">
            {r.label} <span className="font-mono">{wert[r.key].toFixed(2)}</span>
            <input
              type="range"
              min={r.min}
              max={r.max}
              step={r.step}
              value={wert[r.key]}
              onChange={(e) => onChange({ ...wert, [r.key]: Number(e.target.value) })}
              className="w-full accent-red-500"
            />
          </label>
        ))}
      </div>
    </div>
  )
}

export function LongformSatzEditor({
  projektId,
  abschnittId,
  satz,
  zustand,
  pixabay,
  onLokal,
  onZustand,
  vorAktion,
}: {
  projektId: string
  abschnittId: LongformAbschnittId
  satz: LongformSatz
  zustand: LongformProjektZustand
  pixabay: boolean
  onLokal: (s: LongformSatz) => void
  onZustand: (z: LongformProjektZustand) => void
  vorAktion: () => Promise<void>
}) {
  const [laeuft, setLaeuft] = useState<string | null>(null)
  const [regler, setRegler] = useState<LongformStimmeEinstellungen | null>(null)
  const [chat, setChat] = useState('')
  const [chatOffen, setChatOffen] = useState(false)
  const [suche, setSuche] = useState(satz.visual.bildWunsch ?? '')
  const [kandidaten, setKandidaten] = useState<LongformBildKandidat[] | null>(null)

  const st = zustand.stimme.saetze[satz.id]
  const take = st?.takes.find((t) => t.id === st.aktiv) ?? null
  const bild = zustand.bilder[satz.id] ?? null
  const mitBild = satz.visual.szene === 'bild' || satz.visual.szene === 'hook_bild'

  async function aktion<T>(name: string, fn: () => Promise<T>) {
    setLaeuft(name)
    try {
      await vorAktion()
      return await fn()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehlgeschlagen')
      return null
    } finally {
      setLaeuft(null)
    }
  }

  const sprechen = () =>
    aktion('stimme', async () => {
      if (regler) {
        await lfApi('/api/youtube/longform/stimme', { json: { id: projektId, aktion: 'einstellungen', satzId: satz.id, einstellungen: regler } })
      }
      const r = await lfApi<ZustandAntwort>('/api/youtube/longform/stimme', {
        json: { id: projektId, aktion: 'sprechen', satzIds: [satz.id], erzwingen: true },
      })
      onZustand(r.zustand)
    })

  const takeWaehlen = (takeId: string) =>
    aktion('take', async () => {
      const r = await lfApi<ZustandAntwort>('/api/youtube/longform/stimme', { json: { id: projektId, aktion: 'take', satzId: satz.id, takeId } })
      onZustand(r.zustand)
    })

  const umschreiben = () =>
    aktion('chat', async () => {
      const r = await lfApi<ZustandAntwort>('/api/youtube/longform/skript', {
        json: { id: projektId, aktion: 'chat', abschnittId, satzId: satz.id, anweisung: chat, denkstufe: zustand.denkstufe },
      })
      setChat('')
      setChatOffen(false)
      onZustand(r.zustand)
    })

  const bilderSuchen = (mitPixabay: boolean) =>
    aktion('suche', async () => {
      const r = await lfApi<{ kandidaten: LongformBildKandidat[] }>('/api/youtube/longform/bilder', {
        json: { id: projektId, aktion: 'suchen', satzId: satz.id, begriff: suche, mitPixabay },
      })
      setKandidaten(r.kandidaten)
      if (!r.kandidaten.length) toast('Keine passenden freien Bilder gefunden.')
    })

  const bildWaehlen = (k: LongformBildKandidat) =>
    aktion('waehlen', async () => {
      const r = await lfApi<ZustandAntwort>('/api/youtube/longform/bilder', { json: { id: projektId, aktion: 'waehlen', satzId: satz.id, kandidat: k } })
      setKandidaten(null)
      onZustand(r.zustand)
    })

  const bildHochladen = (datei: File | undefined) => {
    if (!datei) return
    void aktion('upload', async () => {
      const form = new FormData()
      form.set('id', projektId)
      form.set('satzId', satz.id)
      form.set('datei', datei)
      const r = await lfApi<ZustandAntwort>('/api/youtube/longform/bilder', { method: 'POST', body: form })
      onZustand(r.zustand)
    })
  }

  const logoHochladen = (name: string, datei: File | undefined) => {
    if (!datei) return
    void aktion('logo', async () => {
      const form = new FormData()
      form.set('id', projektId)
      form.set('konkurrent', name)
      form.set('datei', datei)
      const r = await lfApi<ZustandAntwort>('/api/youtube/longform/bilder', { method: 'POST', body: form })
      onZustand(r.zustand)
    })
  }

  return (
    <div className="rounded-xl border border-[var(--app-border)] p-3">
      <textarea
        value={satz.text}
        onChange={(e) => onLokal({ ...satz, text: e.target.value })}
        rows={Math.max(2, Math.ceil(satz.text.length / 110))}
        className={`${LF_FELD} resize-y`}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <select
          value={satz.visual.szene}
          onChange={(e) => onLokal({ ...satz, visual: { ...satz.visual, szene: e.target.value as LongformSatz['visual']['szene'] } })}
          className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-[var(--app-text)]"
        >
          {LONGFORM_SZENEN.map((s) => (
            <option key={s} value={s}>
              {SZENE_LABEL[s]}
            </option>
          ))}
        </select>
        <input
          value={satz.visual.betonung ?? ''}
          onChange={(e) => onLokal({ ...satz, visual: { ...satz.visual, betonung: e.target.value || null } })}
          placeholder="Betontes Wort (Zoom)"
          className="w-40 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-[var(--app-text)]"
        />
        {satz.visual.szene === 'moat_segmente' || satz.visual.szene === 'moat_pfeiler' || satz.visual.szene === 'zahl_reihe' ? (
          <input
            value={satz.visual.fokus ?? ''}
            onChange={(e) => onLokal({ ...satz, visual: { ...satz.visual, fokus: e.target.value || null } })}
            placeholder={satz.visual.szene === 'moat_segmente' ? 'seg.0 / seg.0.marge / seg.0.wachstum' : satz.visual.szene === 'zahl_reihe' ? 'umsatz / marge / gewinn / fcf' : 'Pfeiler-ID'}
            className="w-64 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-[var(--app-text)]"
          />
        ) : null}
        {satz.faktIds.length ? <span className="font-mono text-[var(--app-text-muted)]">{satz.faktIds.join(', ')}</span> : null}
        <button type="button" className="ml-auto underline text-[var(--app-text-muted)]" onClick={() => setChatOffen((x) => !x)}>
          Satz per Chat ändern
        </button>
      </div>

      {(satz.visual.konkurrenten ?? []).length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {(satz.visual.konkurrenten ?? []).map((name) => {
            const key = name.toLowerCase()
            const auto = (satz.visual.konkurrentLogos ?? []).find((l) => l.name.toLowerCase() === key && l.url)
            const upload = zustand.konkurrentLogos?.[key]
            const url = auto?.url ?? upload?.url ?? null
            const src = url ? (url.startsWith('http') || url.startsWith('/') ? url : `/${url}`) : null
            return (
              <div key={key} className="flex items-center gap-2 rounded-lg border border-[var(--app-border)] px-2 py-1">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" className="h-8 w-8 object-contain" />
                ) : (
                  <span className="text-xs text-amber-300">Logo fehlt</span>
                )}
                <span className="text-xs text-[var(--app-text)]">{name}</span>
                {auto ? null : (
                  <label className={`${LF_KNOPF} cursor-pointer px-2 py-1 text-xs`}>
                    {src ? 'Logo ersetzen' : 'Logo einfügen'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        e.target.value = ''
                        if (!f) return
                        if (!window.confirm('Ich bestätige, dass ich die Rechte an dieser Datei habe (eigene Aufnahme, Lizenz oder Press Kit).')) return
                        logoHochladen(name, f)
                      }}
                    />
                  </label>
                )}
              </div>
            )
          })}
        </div>
      ) : null}

      {satz.hinweise?.length ? (
        <ul className="mt-2 space-y-1">
          {satz.hinweise.map((h, k) => (
            <li key={k} className={`rounded-md border px-2 py-1 text-xs ${HINWEIS_FARBE[h.art] ?? ''}`}>
              {h.text}
            </li>
          ))}
        </ul>
      ) : null}

      {chatOffen ? (
        <div className="mt-2 flex gap-2">
          <input
            value={chat}
            onChange={(e) => setChat(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && chat.trim() && void umschreiben()}
            placeholder="z. B. kürzer, mehr Spannung, die Zahl erst am Ende nennen"
            className={LF_FELD}
          />
          <button type="button" className={LF_KNOPF} disabled={!chat.trim() || laeuft != null} onClick={() => void umschreiben()}>
            {laeuft === 'chat' ? '…' : 'Los'}
          </button>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {take?.url ? <audio src={take.url} controls preload="none" className="h-8 max-w-[260px]" /> : <span className="text-xs text-[var(--app-text-muted)]">Noch keine Stimme</span>}
        {st && st.takes.length > 1 ? (
          <select
            value={st.aktiv ?? ''}
            onChange={(e) => void takeWaehlen(e.target.value)}
            className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-xs text-[var(--app-text)]"
          >
            {st.takes.map((t, k) => (
              <option key={t.id} value={t.id}>
                Take {st.takes.length - k} · {(t.dauerMs / 1000).toFixed(1)}s
              </option>
            ))}
          </select>
        ) : null}
        <button type="button" className={LF_KNOPF} disabled={laeuft != null} onClick={() => void sprechen()}>
          {laeuft === 'stimme' ? 'Spricht…' : take ? 'Neu sprechen' : 'Sprechen'}
        </button>
        <button
          type="button"
          className="text-xs underline text-[var(--app-text-muted)]"
          onClick={() => setRegler((r) => (r ? null : { ...(st?.einstellungen ?? zustand.stimme.global) }))}
        >
          {regler ? 'Eigene Stimme verwerfen' : 'Stimme nur für diesen Satz'}
        </button>
      </div>
      {regler ? (
        <div className="mt-2 rounded-lg bg-[var(--app-surface-muted)] p-2">
          <StimmRegler wert={regler} onChange={setRegler} />
        </div>
      ) : null}

      {mitBild ? (
        <div className="mt-3 space-y-2 border-t border-[var(--app-border)] pt-3">
          <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-2.5">
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-[var(--app-text-muted)]">
              <span>Bildbrief</span>
              <span className={bild?.url ? 'text-emerald-400' : 'text-amber-300'}>{bild?.url ? 'gesetzt' : 'fehlt'}</span>
            </div>
            <textarea
              value={satz.visual.bildWunsch ?? ''}
              onChange={(e) => {
                const v = e.target.value
                onLokal({ ...satz, visual: { ...satz.visual, bildWunsch: v || null } })
                setSuche(v)
              }}
              rows={2}
              placeholder='z. B. "wide shot of semiconductor cleanroom workers in bunny suits, no logos"'
              className={`${LF_FELD} mt-1.5 resize-y text-sm`}
            />
            <p className="mt-1.5 text-[11px] text-[var(--app-text-muted)]">
              Qualitäts-Pfad: selbst suchen/hochladen (eigene Fotos, IR, CC mit Credit). Vorschläge unten sind nur Hilfe — Credits landen in der Videobeschreibung.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {bild?.url ? (
              bild.art === 'video' ? (
                <video src={bild.url} muted className="h-16 w-28 rounded-md object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bild.url} alt="" className="h-16 w-28 rounded-md object-cover" />
              )
            ) : (
              <span className="text-xs text-[var(--app-text-muted)]">Kein Bild — im Video erscheint Logo / Firmenname (kein „PENDING“).</span>
            )}
            <input
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder="Such-Keywords (englisch)"
              className="w-56 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1 text-sm text-[var(--app-text)]"
            />
            <button type="button" className={LF_KNOPF} disabled={laeuft != null || suche.trim().length < 2} onClick={() => void bilderSuchen(false)}>
              {laeuft === 'suche' ? 'Sucht…' : 'Vorschläge suchen'}
            </button>
            {pixabay ? (
              <button type="button" className={LF_KNOPF} disabled={laeuft != null || suche.trim().length < 2} onClick={() => void bilderSuchen(true)}>
                + Pixabay
              </button>
            ) : null}
            <label className={`${LF_KNOPF} cursor-pointer`}>
              Am Satz hochladen
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  if (!window.confirm('Ich bestätige, dass ich die Rechte an dieser Datei habe (eigene Aufnahme, Lizenz oder Press Kit).')) {
                    e.target.value = ''
                    return
                  }
                  bildHochladen(f)
                }}
              />
            </label>
          </div>
          {bild?.credit ? <p className="text-[11px] text-[var(--app-text-muted)]">Credit: {bild.credit}</p> : null}
          {kandidaten?.length ? (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {kandidaten.map((k) => (
                <button
                  key={k.originalUrl}
                  type="button"
                  disabled={laeuft != null}
                  onClick={() => void bildWaehlen(k)}
                  className="group relative overflow-hidden rounded-lg border border-[var(--app-border)] text-left"
                  title={k.eignungGrund ?? k.credit ?? ''}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={k.vorschauUrl} alt="" className="aspect-video w-full object-cover" />
                  <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 text-[10px] text-white">
                    {k.quelle}
                    {k.art === 'video' ? ' · Clip' : ''}
                    {k.eignung != null ? ` · ${k.eignung}/10` : ''}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

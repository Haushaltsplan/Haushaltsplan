'use client'

import dynamic from 'next/dynamic'
import { useState, useSyncExternalStore } from 'react'
import toast from 'react-hot-toast'
import { PageChrome, PageHero } from '@/components/page-shell'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import type { MoatShortAntwort, MoatShortErgebnis } from '@/lib/youtube/moat-short-types'
import type { MoatShortProps } from '@/remotion/moat-short-types'

const MoatShortPreview = dynamic(() => import('@/components/youtube/moat-short-preview.client'), {
  ssr: false,
  loading: () => <div className="aspect-[9/16] w-full animate-pulse rounded-[18px] bg-[var(--app-surface-muted)]" />,
})

const keinAbo = () => () => {}

type Eingabe = { paket: FundamentaldatenPaket; isin: string | null }

function leseExport(text: string): Eingabe | string {
  let j: Record<string, unknown>
  try {
    j = JSON.parse(text) as Record<string, unknown>
  } catch {
    return 'Das ist kein gültiges JSON.'
  }
  const roh = (j.fundamentaldatenRoh ?? j) as FundamentaldatenPaket
  if (!roh || !Array.isArray(roh.keyMetrics) || !roh.firmenname) {
    return 'Kein Fundamentaldaten-Export erkannt (fundamentaldatenRoh mit Kennzahlen fehlt).'
  }
  const meta = j.meta as { isin?: string | null } | undefined
  return {
    paket: { ...roh, zeilen: [], perioden: [], news: [], erweitert: undefined },
    isin: meta?.isin ?? null,
  }
}

function pruefeLogo(url: string | null): Promise<string | null> {
  if (!url) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth >= 64 ? url : null)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

const feldKlasse =
  'w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-red-500/40'

export function YoutubeShortsClient() {
  const [rohText, setRohText] = useState('')
  const [moatNeu, setMoatNeu] = useState(false)
  const [laedt, setLaedt] = useState(false)
  const [rendert, setRendert] = useState(false)
  const [ergebnis, setErgebnis] = useState<MoatShortErgebnis | null>(null)
  const [props, setProps] = useState<MoatShortProps | null>(null)
  const lokal = useSyncExternalStore(
    keinAbo,
    () => ['localhost', '127.0.0.1'].includes(window.location.hostname),
    () => false,
  )

  async function dateiGewaehlt(datei: File | undefined) {
    if (datei) setRohText(await datei.text())
  }

  async function erstellen() {
    const eingabe = leseExport(rohText)
    if (typeof eingabe === 'string') {
      toast.error(eingabe)
      return
    }
    setLaedt(true)
    try {
      const res = await fetch('/api/youtube/short', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paket: eingabe.paket, isin: eingabe.isin, moatNeu }),
      })
      const j = (await res.json()) as MoatShortAntwort | { error?: string }
      if (!('ok' in j) || !j.ok) {
        toast.error(('fehler' in j && j.fehler) || ('error' in j && j.error) || `Fehler (HTTP ${res.status})`)
        return
      }
      const logoUrl = await pruefeLogo(j.props.logoUrl)
      setErgebnis(j)
      setProps({ ...j.props, logoUrl })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Netzwerkfehler')
    } finally {
      setLaedt(false)
    }
  }

  async function mp4Exportieren() {
    if (!props) return
    setRendert(true)
    try {
      const res = await fetch('/api/youtube/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ props }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { fehler?: string }
        toast.error(j.fehler || `Render fehlgeschlagen (HTTP ${res.status})`)
        return
      }
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `${props.ticker}.mp4`
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`${name} gespeichert (auch unter out/youtube/).`)
    } finally {
      setRendert(false)
    }
  }

  function setze<K extends keyof MoatShortProps>(key: K, wert: MoatShortProps[K]) {
    setProps((p) => (p ? { ...p, [key]: wert } : p))
  }

  return (
    <PageChrome>
      <PageHero
        eyebrow="YouTube"
        title="Moat Check Shorts"
        description="Fundamentaldaten-Export einfügen. Daraus entstehen Moat-Urteil, englisches Script und ein 45-Sekunden-Short."
      />

      <section className="app-section-shell">
        <div className="app-surface-card-header px-4 py-2.5 sm:px-5">
          <h2 className="text-base font-semibold tracking-tight text-[var(--app-text)]">1 · Export einfügen</h2>
        </div>
        <div className="space-y-3 px-4 py-3 sm:px-5 sm:py-4">
          <textarea
            value={rohText}
            onChange={(e) => setRohText(e.target.value)}
            placeholder="JSON aus Fundamentaldaten → Export hier einfügen"
            rows={6}
            spellCheck={false}
            className={`${feldKlasse} font-mono text-xs`}
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)]">
              JSON-Datei wählen
              <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => void dateiGewaehlt(e.target.files?.[0])} />
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--app-text-muted)]">
              <input type="checkbox" checked={moatNeu} onChange={(e) => setMoatNeu(e.target.checked)} />
              Moat neu bewerten (statt gespeichertes Urteil)
            </label>
            <button
              type="button"
              disabled={laedt || !rohText.trim()}
              onClick={() => void erstellen()}
              className="ml-auto rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              {laedt ? 'Moat & Script werden erstellt…' : 'Short erstellen'}
            </button>
          </div>
        </div>
      </section>

      {ergebnis && props ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="app-section-shell">
            <div className="app-surface-card-header flex items-center justify-between px-4 py-2.5 sm:px-5">
              <h2 className="text-base font-semibold tracking-tight text-[var(--app-text)]">2 · Script prüfen</h2>
              <span className="text-xs text-[var(--app-text-muted)]">
                Moat {ergebnis.moat.score}/10 · {ergebnis.moatAusCache ? 'gespeichertes Urteil' : 'neu bewertet'}
              </span>
            </div>
            <div className="space-y-4 px-4 py-3 sm:px-5 sm:py-4">
              {ergebnis.warnungen.length ? (
                <ul className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                  {ergebnis.warnungen.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}

              <div>
                <label className="text-xs font-medium text-[var(--app-text-muted)]">Hook — einmal lesen, notfalls schärfer machen</label>
                <textarea value={props.hook} onChange={(e) => setze('hook', e.target.value)} rows={2} className={`${feldKlasse} mt-1`} />
                <select
                  value={ergebnis.metriken.find((m) => m.value === props.metricValue && m.label === props.metricLabel)?.id ?? ''}
                  onChange={(e) => {
                    const m = ergebnis.metriken.find((x) => x.id === e.target.value)
                    if (m) setProps((p) => (p ? { ...p, metricValue: m.value, metricLabel: m.label } : p))
                  }}
                  className={`${feldKlasse} mt-2`}
                >
                  {ergebnis.metriken.map((m) => (
                    <option key={m.id} value={m.id}>
                      Große Zahl: {m.label} · {m.value}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--app-text-muted)]">What they sell</label>
                <textarea value={props.business} onChange={(e) => setze('business', e.target.value)} rows={2} className={`${feldKlasse} mt-1`} />
              </div>

              {props.pillars.map((p, i) => (
                <div key={p.id}>
                  <label className="text-xs font-medium text-[var(--app-text-muted)]">
                    {p.label} · {p.score}/10
                  </label>
                  <input
                    value={p.line}
                    onChange={(e) =>
                      setze(
                        'pillars',
                        props.pillars.map((x, j) => (j === i ? { ...x, line: e.target.value } : x)),
                      )
                    }
                    className={`${feldKlasse} mt-1`}
                  />
                </div>
              ))}

              <div>
                <label className="text-xs font-medium text-[var(--app-text-muted)]">The crack</label>
                <textarea value={props.crack} onChange={(e) => setze('crack', e.target.value)} rows={2} className={`${feldKlasse} mt-1`} />
              </div>

              <div className="rounded-xl border border-[var(--app-border)] p-3 text-sm">
                <p className="text-xs font-medium text-[var(--app-text-muted)]">Titel & Beschreibung für YouTube</p>
                <p className="mt-1 font-medium text-[var(--app-text)]">{ergebnis.title}</p>
                <p className="mt-1 whitespace-pre-line text-[var(--app-text-muted)]">{ergebnis.description}</p>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(`${ergebnis.title}\n\n${ergebnis.description}`).then(() => toast.success('Kopiert'))}
                  className="mt-2 rounded-lg border border-[var(--app-border)] px-3 py-1 text-xs text-[var(--app-text-muted)]"
                >
                  Kopieren
                </button>
              </div>
            </div>
          </section>

          <section className="app-section-shell">
            <div className="app-surface-card-header px-4 py-2.5 sm:px-5">
              <h2 className="text-base font-semibold tracking-tight text-[var(--app-text)]">3 · Vorschau</h2>
            </div>
            <div className="space-y-3 px-4 py-3 sm:px-5 sm:py-4">
              <MoatShortPreview props={props} />
              <button
                type="button"
                disabled={!lokal || rendert}
                onClick={() => void mp4Exportieren()}
                className="w-full rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {rendert ? 'MP4 wird gerendert… (1–2 Min.)' : 'MP4 exportieren'}
              </button>
              {!lokal ? (
                <p className="text-xs text-[var(--app-text-muted)]">MP4-Export nur, wenn die App lokal läuft (npm run dev).</p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </PageChrome>
  )
}

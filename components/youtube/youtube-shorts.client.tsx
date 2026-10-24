'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { PageChrome, PageHero } from '@/components/page-shell'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import type { MoatShortAntwort, MoatShortErgebnis, MoatShortHookVariante } from '@/lib/youtube/moat-short-types'
import { MOAT_SHORT_KATALOG_PFADE, musikTrack, sortiereTracks, trackZumUrteil } from '@/lib/youtube/moat-short-musik'
import { musikPlaySrc, rendereMoatShortImBrowser } from '@/lib/youtube/moat-short-render-web'
import { fremdeZahlen } from '@/lib/youtube/moat-short-zahlen'
import { MOAT_SHORT_FPS, type MoatShortProps } from '@/remotion/moat-short-types'

const WINKEL_LABEL: Record<string, string> = {
  number_shock: 'Zahl schockt',
  contrast: 'Kontrast',
  stakes: 'Was auf dem Spiel steht',
}

const MoatShortPreview = dynamic(() => import('@/components/youtube/moat-short-preview.client'), {
  ssr: false,
  loading: () => <div className="aspect-[9/16] w-full animate-pulse rounded-[18px] bg-[var(--app-surface-muted)]" />,
})

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

function logoHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `/${url.replace(/^\/+/, '')}`
}

function pruefeLogo(url: string | null): Promise<string | null> {
  if (!url) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth >= 96 ? url : null)
    img.onerror = () => resolve(null)
    img.src = logoHref(url)
  })
}

const feldKlasse =
  'w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-red-500/40'

export function YoutubeShortsClient() {
  const [rohText, setRohText] = useState('')
  const [moatNeu, setMoatNeu] = useState(false)
  const [laedt, setLaedt] = useState(false)
  const [rendert, setRendert] = useState(false)
  const [renderProzent, setRenderProzent] = useState(0)
  const [renderDatei, setRenderDatei] = useState<string | null>(null)
  const [ergebnis, setErgebnis] = useState<MoatShortErgebnis | null>(null)
  const [props, setProps] = useState<MoatShortProps | null>(null)
  const [tracks, setTracks] = useState<string[]>(MOAT_SHORT_KATALOG_PFADE)
  const [musikWahl, setMusikWahl] = useState<string>('auto')
  const [sfx, setSfx] = useState(true)

  useEffect(() => {
    void fetch('/api/youtube/musik')
      .then((r) => r.json() as Promise<{ tracks?: string[] }>)
      .then((j) => setTracks(sortiereTracks([...new Set([...MOAT_SHORT_KATALOG_PFADE, ...(j.tracks ?? [])])])))
      .catch(() => undefined)
  }, [])

  const automatisch = trackZumUrteil(props?.verdict, tracks)
  const musik = musikWahl === 'auto' ? automatisch : musikWahl || null
  const track = musik ? musikTrack(musik) : null
  const fertig = props
    ? {
        ...props,
        musicSrc: musikPlaySrc(musik),
        musicGain: track?.gain ?? 0.5,
        musicTrim: Math.round((track?.startSekunden ?? 0) * MOAT_SHORT_FPS),
        sfx,
      }
    : null
  const beschreibung = ergebnis
    ? track?.credit
      ? `${ergebnis.description}\n\n${track.credit}`
      : ergebnis.description
    : ''
  const fremd =
    props && ergebnis
      ? fremdeZahlen(
          [props.hook, props.hookLoop, props.business, ...props.pillars.map((p) => p.line), props.crack].join(' '),
          ergebnis.metriken,
          [ergebnis.moat.score, ...props.pillars.map((p) => p.score)],
        )
      : []
  const zahlenWarnung = fremd.length ? `Zahlen ohne Quelle im Export: ${fremd.join(', ')}` : null

  function waehleHook(h: MoatShortHookVariante) {
    const m = ergebnis?.metriken.find((x) => x.id === h.metrikId)
    setProps((p) =>
      p ? { ...p, hook: h.claim, hookLoop: h.loop, ...(m ? { metricValue: m.value, metricLabel: m.label } : {}) } : p,
    )
  }

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

  function speichereBlob(blob: Blob, dateiname: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = dateiname
    a.click()
    URL.revokeObjectURL(url)
  }

  async function mp4Exportieren() {
    if (!fertig) return
    const ticker = fertig.ticker.replace(/[^A-Z0-9]/gi, '').toUpperCase() || 'SHORT'
    const dateiname = `${ticker}-moat.mp4`
    setRendert(true)
    setRenderProzent(0)
    setRenderDatei(dateiname)
    try {
      const blob = await rendereMoatShortImBrowser(fertig, (p) => {
        if (Number.isFinite(p)) setRenderProzent(Math.max(0, Math.min(100, Math.round(p * 100))))
      })
      speichereBlob(blob, dateiname)
      toast.success(`${dateiname} heruntergeladen.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Render im Browser fehlgeschlagen.')
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
              <div className="flex items-center gap-3">
                {props.logoUrl ? (
                  <img
                    src={logoHref(props.logoUrl)}
                    alt=""
                    className="h-12 w-12 rounded-lg border border-[var(--app-border)] bg-white object-contain p-1"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--app-surface-muted)] text-[10px] font-bold uppercase text-[var(--app-text-muted)]">
                    {props.ticker}
                  </div>
                )}
                <div>
                  <p className="font-medium text-[var(--app-text)]">{props.firmenname}</p>
                  <p className="text-xs text-[var(--app-text-muted)]">
                    ${props.ticker}
                    {props.logoUrl ? ' · echtes Firmenlogo' : ' · kein Logo gefunden'}
                  </p>
                </div>
              </div>

              {ergebnis.warnungen.length ? (
                <ul className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                  {ergebnis.warnungen.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}

              <div className="space-y-2">
                <p className="text-xs font-medium text-[var(--app-text-muted)]">Hook — die ersten zwei Sekunden entscheiden</p>
                {ergebnis.hookVarianten.map((h, i) => {
                  const aktiv = h.claim === props.hook
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => waehleHook(h)}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                        aktiv
                          ? 'border-red-500/60 bg-red-500/10'
                          : 'border-[var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-surface-muted)]'
                      }`}
                    >
                      <span className="text-[10px] uppercase tracking-wider text-[var(--app-text-muted)]">
                        {WINKEL_LABEL[h.winkel] ?? h.winkel}
                      </span>
                      <span className="mt-0.5 block font-medium text-[var(--app-text)]">{h.claim}</span>
                      <span className="block text-[var(--app-text-muted)]">{h.loop}</span>
                    </button>
                  )
                })}

                <label className="block pt-1 text-xs font-medium text-[var(--app-text-muted)]">Behauptung (steht als Überschrift im Bild)</label>
                <textarea value={props.hook} onChange={(e) => setze('hook', e.target.value)} rows={2} className={feldKlasse} />
                <label className="block text-xs font-medium text-[var(--app-text-muted)]">Spannungssatz (wird erst beim Crack aufgelöst)</label>
                <input value={props.hookLoop} onChange={(e) => setze('hookLoop', e.target.value)} className={feldKlasse} />
                <select
                  value={ergebnis.metriken.find((m) => m.value === props.metricValue && m.label === props.metricLabel)?.id ?? ''}
                  onChange={(e) => {
                    const m = ergebnis.metriken.find((x) => x.id === e.target.value)
                    if (m) setProps((p) => (p ? { ...p, metricValue: m.value, metricLabel: m.label } : p))
                  }}
                  className={feldKlasse}
                >
                  {ergebnis.metriken
                    .filter((m) => m.hook)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        Große Zahl: {m.label} · {m.value}
                      </option>
                    ))}
                </select>
                {!props.hook.includes(props.metricValue) ? (
                  <p className="text-xs text-amber-300">Die Behauptung nennt {props.metricValue} nicht wörtlich.</p>
                ) : null}
                {zahlenWarnung ? <p className="text-xs text-amber-300">{zahlenWarnung}</p> : null}
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
                  <select
                    value={ergebnis.metriken.find((m) => m.value === p.stat?.value && m.label === p.stat?.label)?.id ?? ''}
                    onChange={(e) => {
                      const m = ergebnis.metriken.find((x) => x.id === e.target.value)
                      setze(
                        'pillars',
                        props.pillars.map((x, j) => (j === i ? { ...x, stat: m ? { value: m.value, label: m.label } : null } : x)),
                      )
                    }}
                    className={`${feldKlasse} mt-1 text-xs`}
                  >
                    <option value="">Kein Zahlen-Schild</option>
                    {ergebnis.metriken.map((m) => (
                      <option key={m.id} value={m.id}>
                        Schild: {m.label} · {m.value}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              <div>
                <label className="text-xs font-medium text-[var(--app-text-muted)]">The crack</label>
                <textarea value={props.crack} onChange={(e) => setze('crack', e.target.value)} rows={2} className={`${feldKlasse} mt-1`} />
              </div>

              <div className="rounded-xl border border-[var(--app-border)] p-3 text-sm">
                <p className="text-xs font-medium text-[var(--app-text-muted)]">Titel & Beschreibung für YouTube</p>
                <p className="mt-1 font-medium text-[var(--app-text)]">{ergebnis.title}</p>
                <p className="mt-1 whitespace-pre-line text-[var(--app-text-muted)]">{beschreibung}</p>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(`${ergebnis.title}\n\n${beschreibung}`).then(() => toast.success('Kopiert'))}
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
              {fertig ? <MoatShortPreview props={fertig} /> : null}
              <select value={musikWahl} onChange={(e) => setMusikWahl(e.target.value)} className={`${feldKlasse} text-xs`}>
                <option value="auto">
                  Automatisch
                  {automatisch ? ` · ${musikTrack(automatisch).titel} (${musikTrack(automatisch).stimmung})` : ''}
                </option>
                <option value="">Keine Musik</option>
                {tracks.map((t) => (
                  <option key={t} value={t}>
                    ♪ {musikTrack(t).titel} – {musikTrack(t).stimmung}
                  </option>
                ))}
              </select>
              {track?.credit ? (
                <p className="text-xs text-[var(--app-text-muted)]">
                  Passend zum Urteil, Pegel angeglichen. Lizenz CC BY 4.0 – Namensnennung steht in der Beschreibung oben.
                </p>
              ) : null}
              {!tracks.length ? (
                <p className="text-xs text-[var(--app-text-muted)]">Musik wird beim ersten Laden heruntergeladen. Seite ggf. neu laden.</p>
              ) : null}
              <label className="flex items-center gap-2 text-xs text-[var(--app-text-muted)]">
                <input type="checkbox" checked={sfx} onChange={(e) => setSfx(e.target.checked)} />
                Soundeffekte (Schnitte, Balken, Stempel)
              </label>
              <button
                type="button"
                disabled={rendert || !fertig}
                onClick={() => void mp4Exportieren()}
                className="w-full rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {rendert ? `MP4 wird gerendert… ${renderProzent}%` : 'MP4 exportieren'}
              </button>
              {renderDatei ? (
                <p className="text-xs text-[var(--app-text-muted)]">
                  {rendert ? 'läuft im Browser' : 'heruntergeladen'}: <code>{renderDatei}</code>
                </p>
              ) : null}
              <p className="text-xs text-[var(--app-text-muted)]">
                Läuft online in Chrome oder Edge, ein bis drei Minuten. Tab offen lassen, danach startet der Download.
              </p>
            </div>
          </section>
        </div>
      ) : null}
    </PageChrome>
  )
}

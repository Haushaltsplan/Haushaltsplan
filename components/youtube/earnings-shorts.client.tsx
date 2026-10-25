'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { PaAktienSucheInput } from '@/components/portfolio-analyse/pa-aktien-suche-input'
import { MOAT_SHORT_KATALOG_PFADE, musikTrack, sortiereTracks, trackZumUrteil } from '@/lib/youtube/moat-short-musik'
import { logoPlaySrc, musikPlaySrc } from '@/lib/youtube/moat-short-media-src'
import {
  dateiZuEstimateBild,
  EARNINGS_SHORT_MAX_BILDER,
  type EarningsShortBild,
} from '@/lib/youtube/earnings-short-bilder'
import { rendereEarningsShortImBrowser } from '@/lib/youtube/earnings-short-render-web'
import { earningsShortSprechFingerprint } from '@/lib/youtube/earnings-short-voice'
import { earningsLoopWarnungen } from '@/lib/youtube/earnings-short-script'
import type { EarningsShortAntwort, EarningsShortErgebnis } from '@/lib/youtube/earnings-short-types'
import { PUBLISH_ZIELE } from '@/lib/youtube/publish-ziele'
import { ohneKennzahlId } from '@/lib/youtube/moat-short-script'
import { phrasePasst } from '@/lib/youtube/youtube-keywords'
import { ladeMp4ZuYoutube, youtubeShortsUrl } from '@/lib/youtube/youtube-upload-client'
import {
  EARNINGS_SHORT_DEFAULT_PROPS,
  EARNINGS_SHORT_FPS,
  type EarningsShortProps,
  type EarningsShortVoiceWort,
} from '@/remotion/earnings-short-types'

export type YoutubeKanalStand = { configured: boolean; connected: boolean; channelTitle: string | null }
type YtPrivacy = 'unlisted' | 'private' | 'public'

function base64ZuMp3(b64: string): Blob {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: 'audio/mpeg' })
}

function tagsFuerUpload(beschreibung: string, suchphrasen: string[], ticker: string, firmenname: string): string[] {
  const hashes = [...beschreibung.matchAll(/#([A-Za-z0-9_]+)/g)].map((m) => m[1])
  const extra = suchphrasen
    .filter((s) => phrasePasst(s, ticker, firmenname))
    .map((s) => s.replace(/[^A-Za-z0-9 ]/g, '').trim())
    .filter(Boolean)
  const unique: string[] = []
  for (const t of [ticker, ...hashes, ...extra]) {
    const n = t.trim()
    if (!n || unique.some((u) => u.toLowerCase() === n.toLowerCase())) continue
    unique.push(n)
    if (unique.length >= 8) break
  }
  return unique
}

const EarningsShortPreview = dynamic(() => import('@/components/youtube/earnings-short-preview.client'), {
  ssr: false,
  loading: () => <div className="aspect-[9/16] w-full animate-pulse rounded-[18px] bg-[var(--app-surface-muted)]" />,
})

function logoHref(url: string): string {
  return logoPlaySrc(url) ?? `/${url.replace(/^\/+/, '')}`
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

function gesprocheneZeilen(p: EarningsShortProps): EarningsShortProps {
  return {
    ...p,
    hook: ohneKennzahlId(p.hook),
    numbers: ohneKennzahlId(p.numbers),
    call0: ohneKennzahlId(p.call0),
    call1: ohneKennzahlId(p.call1),
    filing: ohneKennzahlId(p.filing),
    takeaway: ohneKennzahlId(p.takeaway),
  }
}

function beispielErgebnis(): EarningsShortErgebnis {
  const props = { ...EARNINGS_SHORT_DEFAULT_PROPS }
  return {
    props,
    title: 'NVDA: the beat is not the story',
    description:
      'NVIDIA (NVDA): +4.2% — NVDA earnings.\n\nThe call is about the backlog, not the print.\n\nNot investment advice. Altered or synthetic media.\n#Shorts #NVDA #earnings #investing',
    kommentar: 'What did the NVDA call change — the beat, or the story?',
    suchphrasen: ['NVDA earnings', 'NVIDIA earnings'],
    warnungen: [],
    quartalLabel: props.quartalLabel,
    callLabel: 'Q2 FY26',
    hatBericht: true,
  }
}

const feldKlasse =
  'w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-red-500/40'

export function EarningsShortsClient({ yt }: { yt: YoutubeKanalStand }) {
  const [ticker, setTicker] = useState('')
  const [firmenname, setFirmenname] = useState('')
  const [isin, setIsin] = useState<string | null>(null)
  const [symbolYahoo, setSymbolYahoo] = useState<string | null>(null)
  const [estimateBilder, setEstimateBilder] = useState<EarningsShortBild[]>([])
  const [laedt, setLaedt] = useState(false)
  const [rendert, setRendert] = useState(false)
  const [renderProzent, setRenderProzent] = useState(0)
  const [renderDatei, setRenderDatei] = useState<string | null>(null)
  const [ergebnis, setErgebnis] = useState<EarningsShortErgebnis | null>(null)
  const [props, setProps] = useState<EarningsShortProps | null>(null)
  const [tracks, setTracks] = useState<string[]>(MOAT_SHORT_KATALOG_PFADE)
  const [musikWahl, setMusikWahl] = useState<string>('auto')
  const [musikPegel, setMusikPegel] = useState(50)
  const [musikPegelCommit, setMusikPegelCommit] = useState(50)
  const [sfx, setSfx] = useState(true)
  const [mp4Blob, setMp4Blob] = useState<Blob | null>(null)
  const [uploadProzent, setUploadProzent] = useState(0)
  const [uploadLaedt, setUploadLaedt] = useState(false)
  const [videoId, setVideoId] = useState<string | null>(null)
  const [privacy, setPrivacy] = useState<YtPrivacy>('unlisted')
  const [uploadTitel, setUploadTitel] = useState('')
  const [uploadBeschreibung, setUploadBeschreibung] = useState('')
  const [uploadKommentar, setUploadKommentar] = useState('')
  const [stimmeOk, setStimmeOk] = useState(false)
  const [stimmeLaedt, setStimmeLaedt] = useState(false)
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null)
  const [stimmeFp, setStimmeFp] = useState<string | null>(null)

  useEffect(() => {
    void fetch('/api/youtube/musik')
      .then((r) => r.json() as Promise<{ tracks?: string[] }>)
      .then((j) => setTracks(sortiereTracks([...new Set([...MOAT_SHORT_KATALOG_PFADE, ...(j.tracks ?? [])])])))
      .catch(() => undefined)
    const gespeichert = Number(typeof window !== 'undefined' ? window.localStorage.getItem('moat-short-musik-pegel') : NaN)
    if (Number.isFinite(gespeichert)) {
      const v = Math.max(0, Math.min(100, gespeichert))
      setMusikPegel(v)
      setMusikPegelCommit(v)
    }
    void fetch('/api/youtube/voice')
      .then((r) => r.json() as Promise<{ configured?: boolean }>)
      .then((j) => setStimmeOk(Boolean(j.configured)))
      .catch(() => setStimmeOk(false))
  }, [])

  const automatisch = tracks.find((t) => t.endsWith('night-break.mp3')) ?? trackZumUrteil('narrow', tracks)
  const musik = musikWahl === 'auto' ? automatisch : musikWahl || null
  const track = musik ? musikTrack(musik) : null
  const sprechFp = props ? earningsShortSprechFingerprint(props) : ''
  const stimmePasst = Boolean(props?.voiceSrc && stimmeFp === sprechFp)
  const fertig = props
    ? {
        ...props,
        musicSrc: musikPlaySrc(musik),
        logoUrl: logoPlaySrc(props.logoUrl),
        musicGain: (track?.gain ?? 1) * (musikPegel / 100),
        musicTrim: Math.round((track?.startSekunden ?? 0) * EARNINGS_SHORT_FPS),
        sfx,
        voiceSrc: stimmePasst ? props.voiceSrc : null,
        voiceAlignment: stimmePasst ? props.voiceAlignment : null,
      }
    : null
  const loopWarnung = props ? earningsLoopWarnungen(props.hook, props.takeaway, props.metricValue) : []

  useEffect(() => {
    if (!ergebnis) return
    setUploadTitel(ergebnis.title)
    setUploadKommentar(ergebnis.kommentar)
    setUploadBeschreibung(track?.credit ? `${ergebnis.description}\n\n${track.credit}` : ergebnis.description)
  }, [ergebnis, track?.credit])

  function leereStimme() {
    setVoiceUrl((alt) => {
      if (alt) URL.revokeObjectURL(alt)
      return null
    })
    setStimmeFp(null)
    setProps((p) => (p ? { ...p, voiceSrc: null, voiceAlignment: null } : p))
  }

  useEffect(() => {
    if (!props?.voiceAlignment || !stimmeFp) return
    if (stimmeFp === earningsShortSprechFingerprint(props)) return
    leereStimme()
  }, [props, stimmeFp])

  async function stimmeErzeugen() {
    if (!props) return
    setStimmeLaedt(true)
    try {
      const res = await fetch('/api/youtube/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ art: 'earnings', props }),
      })
      const j = (await res.json()) as { ok?: boolean; audioBase64?: string; woerter?: EarningsShortVoiceWort[]; fehler?: string; error?: string }
      if (!res.ok || !j.ok || !j.audioBase64 || !j.woerter?.length) {
        toast.error(j.fehler || j.error || 'Stimme fehlgeschlagen.')
        return
      }
      const url = URL.createObjectURL(base64ZuMp3(j.audioBase64))
      setVoiceUrl((alt) => {
        if (alt) URL.revokeObjectURL(alt)
        return url
      })
      setStimmeFp(earningsShortSprechFingerprint(props))
      setProps((p) => (p ? { ...p, voiceSrc: url, voiceAlignment: j.woerter ?? null } : p))
      toast.success('Stimme liegt auf der Timeline.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Stimme fehlgeschlagen.')
    } finally {
      setStimmeLaedt(false)
    }
  }

  async function nachYoutube() {
    if (!mp4Blob) {
      toast.error('Zuerst das MP4 im Browser rendern.')
      return
    }
    if (!yt.connected) {
      toast.error('Zuerst YouTube verbinden.')
      return
    }
    const titel = uploadTitel.trim()
    if (!titel || titel.length > 100) {
      toast.error('Titel fehlt oder ist zu lang.')
      return
    }
    setUploadLaedt(true)
    setUploadProzent(0)
    setVideoId(null)
    try {
      const res = await fetch('/api/youtube/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titel,
          description: uploadBeschreibung,
          tags: tagsFuerUpload(
            uploadBeschreibung,
            ergebnis?.suchphrasen ?? [],
            props?.ticker ?? '',
            props?.firmenname ?? '',
          ),
          privacy,
          dateigroesse: mp4Blob.size,
        }),
      })
      const j = (await res.json()) as { uploadUrl?: string; error?: string }
      if (!res.ok || !j.uploadUrl) throw new Error(j.error || 'Upload-Init fehlgeschlagen.')
      const id = await ladeMp4ZuYoutube(j.uploadUrl, mp4Blob, setUploadProzent)
      setVideoId(id)
      toast.success(privacy === 'unlisted' ? 'Unlisted auf YouTube.' : 'Auf YouTube hochgeladen.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload fehlgeschlagen.')
    } finally {
      setUploadLaedt(false)
    }
  }

  async function erstellen() {
    if (!ticker.trim()) {
      toast.error('Zuerst einen Ticker wählen.')
      return
    }
    setLaedt(true)
    try {
      const res = await fetch('/api/youtube/earnings-short', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker,
          firmenname,
          isin,
          symbolYahoo,
          estimateBilder: estimateBilder.map((b) => b.dataUrl),
        }),
      })
      const j = (await res.json()) as EarningsShortAntwort | { error?: string }
      if (!('ok' in j) || !j.ok) {
        const luecken = 'luecken' in j && Array.isArray(j.luecken) ? j.luecken.map((l) => l.hinweis).join(' ') : ''
        toast.error(luecken || ('fehler' in j && j.fehler) || ('error' in j && j.error) || `Fehler (HTTP ${res.status})`)
        return
      }
      const logoUrl = await pruefeLogo(j.props.logoUrl)
      const sauber = gesprocheneZeilen(j.props)
      setErgebnis({ ...j, props: sauber })
      setProps({ ...sauber, logoUrl, voiceSrc: null, voiceAlignment: null })
      setMp4Blob(null)
      setVideoId(null)
      setVoiceUrl((alt) => {
        if (alt) URL.revokeObjectURL(alt)
        return null
      })
      setStimmeFp(null)
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
    const name = fertig.ticker.replace(/[^A-Z0-9]/gi, '').toUpperCase() || 'SHORT'
    const dateiname = `${name}-earnings.mp4`
    setRendert(true)
    setRenderProzent(0)
    setRenderDatei(dateiname)
    try {
      const blob = await rendereEarningsShortImBrowser(fertig, (p) => {
        if (Number.isFinite(p)) setRenderProzent(Math.max(0, Math.min(100, Math.round(p * 100))))
      })
      setMp4Blob(blob)
      speichereBlob(blob, dateiname)
      toast.success(`${dateiname} heruntergeladen.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Render im Browser fehlgeschlagen.')
    } finally {
      setRendert(false)
    }
  }

  function setze<K extends keyof EarningsShortProps>(key: K, wert: EarningsShortProps[K]) {
    setProps((p) => (p ? { ...p, [key]: wert } : p))
  }

  return (
    <>
      <section className="app-section-shell">
        <div className="app-surface-card-header px-4 py-2.5 sm:px-5">
          <h2 className="text-base font-semibold tracking-tight text-[var(--app-text)]">1 · Ticker wählen</h2>
        </div>
        <div className="space-y-3 px-4 py-3 sm:px-5 sm:py-4">
          <PaAktienSucheInput
            nurSuche
            kompakt
            placeholder="Ticker oder Name — AAPL, NVIDIA, ASML…"
            onAuswahl={(a) => {
              const sym = (a.meta.symbolYahoo ?? '').split('.')[0]?.toUpperCase() ?? ''
              setTicker(sym)
              setFirmenname(a.meta.name)
              setIsin(a.isin)
              setSymbolYahoo(a.meta.symbolYahoo)
            }}
          />
          {ticker ? (
            <p className="text-sm text-[var(--app-text)]">
              {firmenname || ticker} <span className="text-[var(--app-text-muted)]">${ticker}</span>
            </p>
          ) : (
            <p className="text-xs text-[var(--app-text-muted)]">
              Lädt Beat/Miss und Call-KI aus dem Cache. Fehlt der Call: zuerst Fundamentaldaten → Quartalszahlen öffnen.
            </p>
          )}
          <div>
            <p className="mb-1.5 text-xs font-medium text-[var(--app-text-muted)]">Estimate-Screenshots</p>
            <p className="mb-2 text-xs text-[var(--app-text-muted)]">
              Konsens aus Yahoo, Bloomberg oder der IR-Folie. Nur Infoquelle fürs Script, nicht im Bild.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {estimateBilder.map((b, i) => (
                <div key={`${b.dataUrl.slice(-24)}-${i}`} className="relative">
                  <img src={b.dataUrl} alt="" className="h-16 w-24 rounded-lg border border-[var(--app-border)] object-cover" />
                  <button
                    type="button"
                    onClick={() => setEstimateBilder((alt) => alt.filter((_, j) => j !== i))}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--app-surface)] text-[10px] text-[var(--app-text-muted)] ring-1 ring-[var(--app-border)]"
                    aria-label="Bild entfernen"
                  >
                    ×
                  </button>
                </div>
              ))}
              {estimateBilder.length < EARNINGS_SHORT_MAX_BILDER ? (
                <label className="cursor-pointer rounded-lg border border-dashed border-[var(--app-border)] px-3 py-2 text-xs text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)]">
                  Screenshot wählen
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = [...(e.target.files ?? [])]
                      e.target.value = ''
                      void Promise.all(files.map((f) => dateiZuEstimateBild(f)))
                        .then((neu) => {
                          setEstimateBilder((alt) => [...alt, ...neu].slice(0, EARNINGS_SHORT_MAX_BILDER))
                        })
                        .catch((err) => toast.error(err instanceof Error ? err.message : 'Bild unlesbar.'))
                    }}
                  />
                </label>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                const b = beispielErgebnis()
                setErgebnis(b)
                setProps(b.props)
                setTicker(b.props.ticker)
                setFirmenname(b.props.firmenname)
                setMp4Blob(null)
                setVideoId(null)
                leereStimme()
              }}
              className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)]"
            >
              NVDA-Beispiel
            </button>
            <button
              type="button"
              disabled={laedt || !ticker}
              onClick={() => void erstellen()}
              className="ml-auto rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              {laedt ? 'Call & Script werden gelesen…' : 'Short erstellen'}
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
                {ergebnis.quartalLabel}
                {ergebnis.hatBericht ? ' · Call + Bericht' : ' · nur Call'}
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
                    ${props.ticker} · {props.beat.toUpperCase()} {props.metricValue}
                  </p>
                </div>
              </div>

              {ergebnis.warnungen.length || loopWarnung.length ? (
                <ul className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                  {[...ergebnis.warnungen, ...loopWarnung].map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}

              {(
                [
                  ['hook', 'Hook'],
                  ['numbers', 'Zahlen'],
                  ['call0', 'Call 1'],
                  ['call1', 'Call 2'],
                  ['filing', 'Bericht'],
                  ['takeaway', 'Landung'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-xs font-medium text-[var(--app-text-muted)]">
                  {label}
                  <textarea
                    value={props[key]}
                    onChange={(e) => setze(key, e.target.value)}
                    rows={key === 'takeaway' ? 2 : 3}
                    className={`${feldKlasse} mt-1`}
                  />
                </label>
              ))}

              <label className="block text-xs font-medium text-[var(--app-text-muted)]">
                Titel
                <input value={uploadTitel} onChange={(e) => setUploadTitel(e.target.value)} className={`${feldKlasse} mt-1`} />
              </label>
              <label className="block text-xs font-medium text-[var(--app-text-muted)]">
                Beschreibung
                <textarea value={uploadBeschreibung} onChange={(e) => setUploadBeschreibung(e.target.value)} rows={6} className={`${feldKlasse} mt-1`} />
              </label>
              <label className="block text-xs font-medium text-[var(--app-text-muted)]">
                Angepinnter Kommentar
                <input value={uploadKommentar} onChange={(e) => setUploadKommentar(e.target.value)} className={`${feldKlasse} mt-1`} />
              </label>
            </div>
          </section>

          <section className="app-section-shell">
            <div className="app-surface-card-header px-4 py-2.5 sm:px-5">
              <h2 className="text-base font-semibold tracking-tight text-[var(--app-text)]">3 · Vorschau</h2>
            </div>
            <div className="space-y-3 px-4 py-3 sm:px-5 sm:py-4">
              {fertig ? <EarningsShortPreview props={fertig} restartKey={musikPegelCommit} /> : null}
              <select value={musikWahl} onChange={(e) => setMusikWahl(e.target.value)} className={`${feldKlasse} text-xs`}>
                <option value="auto">
                  Automatisch
                  {automatisch ? ` · ${musikTrack(automatisch).titel} (${musikTrack(automatisch).stimmung})` : ''}
                </option>
                <option value="">Keine Musik</option>
                {tracks.map((t) => (
                  <option key={t} value={t}>
                    {musikTrack(t).titel} – {musikTrack(t).stimmung}
                  </option>
                ))}
              </select>
              {musik ? (
                <label className="block text-xs text-[var(--app-text-muted)]">
                  Musik {musikPegel}%
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={musikPegel}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setMusikPegel(v)
                      window.localStorage.setItem('moat-short-musik-pegel', String(v))
                    }}
                    onPointerUp={(e) => setMusikPegelCommit(Number((e.target as HTMLInputElement).value))}
                    onKeyUp={(e) => setMusikPegelCommit(Number((e.target as HTMLInputElement).value))}
                    className="mt-1 w-full accent-red-600"
                  />
                </label>
              ) : null}
              {track?.credit ? (
                <p className="text-xs text-[var(--app-text-muted)]">
                  Auto: Night Break. 50 % = −24 dB unter der Stimme. Lizenz CC BY 4.0.
                </p>
              ) : null}
              <label className="flex items-center gap-2 text-xs text-[var(--app-text-muted)]">
                <input type="checkbox" checked={sfx} onChange={(e) => setSfx(e.target.checked)} />
                Soundeffekte (Schnitte, Stempel)
              </label>
              {!stimmeOk ? (
                <p className="text-xs text-[var(--app-text-muted)]">
                  Stimme: ELEVENLABS_API_KEY und ELEVENLABS_VOICE_ID in .env.local.
                </p>
              ) : (
                <button
                  type="button"
                  disabled={stimmeLaedt || !props}
                  onClick={() => void stimmeErzeugen()}
                  className="w-full rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm text-[var(--app-text)] hover:bg-[var(--app-surface-muted)] disabled:opacity-50"
                >
                  {stimmeLaedt ? 'Stimme wird erzeugt…' : stimmePasst ? 'Stimme neu erzeugen' : 'Stimme erzeugen'}
                </button>
              )}
              {stimmePasst ? (
                <p className="text-xs text-[var(--app-text-muted)]">Untertitel und Schnitte folgen der Aufnahme.</p>
              ) : voiceUrl || props?.voiceAlignment ? (
                <p className="text-xs text-amber-300">Script hat sich geändert — Stimme neu erzeugen.</p>
              ) : null}
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
                  {rendert ? 'läuft im Browser' : mp4Blob ? 'bereit zum Upload' : 'heruntergeladen'}: <code>{renderDatei}</code>
                </p>
              ) : null}
              <label className="block text-xs font-medium text-[var(--app-text-muted)]">Sichtbarkeit</label>
              <select value={privacy} onChange={(e) => setPrivacy(e.target.value as YtPrivacy)} className={`${feldKlasse} text-xs`}>
                <option value="unlisted">Unlisted — Link kennt nur ihr</option>
                <option value="private">Privat</option>
                <option value="public">Öffentlich — erst nach Audit</option>
              </select>
              <button
                type="button"
                disabled={uploadLaedt || rendert || !mp4Blob || !yt.connected}
                onClick={() => void nachYoutube()}
                className="w-full rounded-xl border border-red-500/50 bg-red-600/90 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {uploadLaedt
                  ? `YouTube lädt… ${uploadProzent}%`
                  : !yt.connected
                    ? 'YouTube verbinden, dann hochladen'
                    : !mp4Blob
                      ? 'Zuerst MP4 rendern'
                      : 'Nach YouTube'}
              </button>
              {videoId ? (
                <a href={youtubeShortsUrl(videoId)} target="_blank" rel="noreferrer" className="block text-center text-xs text-red-300 underline">
                  Short öffnen
                </a>
              ) : null}
              <div className="space-y-1.5 rounded-xl border border-[var(--app-border)] p-3">
                <p className="text-xs font-medium text-[var(--app-text-muted)]">Ziele</p>
                {PUBLISH_ZIELE.map((z) => (
                  <label key={z.id} className="flex items-start gap-2 text-xs text-[var(--app-text-muted)]">
                    <input type="checkbox" checked={z.id === 'youtube'} disabled={!z.aktiv} readOnly />
                    <span>
                      <span className="text-[var(--app-text)]">{z.label}</span>
                      {z.hinweis ? ` — ${z.hinweis}` : ''}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}

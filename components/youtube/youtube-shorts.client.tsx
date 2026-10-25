'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { PageChrome, PageHero } from '@/components/page-shell'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import type { MoatShortAntwort, MoatShortErgebnis, MoatShortHookVariante } from '@/lib/youtube/moat-short-types'
import { MOAT_SHORT_KATALOG_PFADE, musikTrack, sortiereTracks, trackZumUrteil } from '@/lib/youtube/moat-short-musik'
import { logoPlaySrc, musikPlaySrc } from '@/lib/youtube/moat-short-media-src'
import { rendereMoatShortImBrowser } from '@/lib/youtube/moat-short-render-web'
import { PUBLISH_ZIELE } from '@/lib/youtube/publish-ziele'
import { ohneKennzahlId, scriptLoopWarnungen, scriptStoryWarnungen } from '@/lib/youtube/moat-short-script'
import { moatShortSprechFingerprint } from '@/lib/youtube/moat-short-voice'
import { ladeMp4ZuYoutube, youtubeShortsUrl } from '@/lib/youtube/youtube-upload-client'
import { fremdeZahlen } from '@/lib/youtube/moat-short-zahlen'
import type { MoatShortVoiceWort } from '@/remotion/moat-short-types'
import { MOAT_SHORT_DEFAULT_PROPS, MOAT_SHORT_FPS, type MoatShortProps } from '@/remotion/moat-short-types'

type YtStatus = { configured: boolean; connected: boolean; channelTitle: string | null }
type YtPrivacy = 'unlisted' | 'private' | 'public'

function base64ZuMp3(b64: string): Blob {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: 'audio/mpeg' })
}

function tagsFuerUpload(beschreibung: string, suchphrasen: string[], ticker: string): string[] {
  const hashes = [...beschreibung.matchAll(/#([A-Za-z0-9_]+)/g)].map((m) => m[1])
  const extra = suchphrasen.map((s) => s.replace(/[^A-Za-z0-9 ]/g, '').trim()).filter(Boolean)
  const unique: string[] = []
  for (const t of [ticker, ...hashes, ...extra]) {
    const n = t.trim()
    if (!n || unique.some((u) => u.toLowerCase() === n.toLowerCase())) continue
    unique.push(n)
    if (unique.length >= 8) break
  }
  return unique
}

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

function beispielErgebnis(): MoatShortErgebnis {
  const props = { ...MOAT_SHORT_DEFAULT_PROPS }
  return {
    props,
    metriken: [
      { id: 'gm', label: 'Gross margin', value: '51.3%', hook: true },
      { id: 'swing', label: '10y gross margin swing', value: '2.1 pts', hook: false },
      { id: 'roic', label: '5-year avg. ROIC', value: '28.4%', hook: false },
    ],
    hookVarianten: [
      { winkel: 'number_shock', claim: props.hook, loop: props.hookLoop, land: props.closing, metrikId: 'gm' },
    ],
    moat: {
      ticker: props.ticker,
      isin: null,
      firmenname: props.firmenname,
      geschaeftsmodell: props.business,
      pfeiler: props.pillars.map((p) => ({ id: p.id, score: p.score, begruendung: p.line, risiko: '' })),
      score: props.score,
      urteil: 'tief',
      kaufwuerdig: true,
      kaufHinweis: '',
      zerstoerungsszenarien: [props.crack],
      stand: '',
      kiModell: null,
    },
    moatAusCache: true,
    title: 'ASML: why nobody can copy it',
    description:
      'ASML Holding (ASML): 51.3% — ASML moat.\n\nAt 51.3% gross margin, ASML sells machines nobody else can build.\n\nNot investment advice. Altered or synthetic media.\n#Shorts #ASML #investing #moat',
    kommentar: 'Is ASML a wide moat, or just the only shop in town?',
    suchphrasen: ['ASML moat', 'ASML stock', 'ASML monopoly'],
    warnungen: [],
  }
}

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

function gesprocheneZeilen(p: MoatShortProps): MoatShortProps {
  return {
    ...p,
    hook: ohneKennzahlId(p.hook),
    hookLoop: ohneKennzahlId(p.hookLoop),
    business: ohneKennzahlId(p.business),
    crack: ohneKennzahlId(p.crack),
    closing: ohneKennzahlId(p.closing),
    pillars: p.pillars.map((x) => ({ ...x, line: ohneKennzahlId(x.line) })),
  }
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
  useEffect(() => {
    if (!props) return
    const next = gesprocheneZeilen(props)
    const zeilenGleich = next.pillars.every((x, i) => x.line === props.pillars[i]?.line)
    if (
      next.hook === props.hook &&
      next.hookLoop === props.hookLoop &&
      next.business === props.business &&
      next.crack === props.crack &&
      next.closing === props.closing &&
      zeilenGleich
    ) {
      return
    }
    setProps(next)
  }, [props])
  const [tracks, setTracks] = useState<string[]>(MOAT_SHORT_KATALOG_PFADE)
  const [musikWahl, setMusikWahl] = useState<string>('auto')
  const [musikPegel, setMusikPegel] = useState(50)
  const [musikPegelCommit, setMusikPegelCommit] = useState(50)
  const [sfx, setSfx] = useState(true)
  const [mp4Blob, setMp4Blob] = useState<Blob | null>(null)
  const [yt, setYt] = useState<YtStatus>({ configured: false, connected: false, channelTitle: null })
  const [ytLaedt, setYtLaedt] = useState(false)
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

  const ladeYtStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/youtube/auth/status', { cache: 'no-store' })
      const j = (await res.json()) as YtStatus
      setYt({
        configured: Boolean(j.configured),
        connected: Boolean(j.connected),
        channelTitle: j.channelTitle ?? null,
      })
    } catch {
      setYt({ configured: false, connected: false, channelTitle: null })
    }
  }, [])

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
    void ladeYtStatus()
    void fetch('/api/youtube/voice')
      .then((r) => r.json() as Promise<{ configured?: boolean }>)
      .then((j) => setStimmeOk(Boolean(j.configured)))
      .catch(() => setStimmeOk(false))
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('yt') === 'connected') {
      toast.success('YouTube verbunden.')
      window.history.replaceState({}, '', window.location.pathname)
      void ladeYtStatus()
    }
    const err = sp.get('yt_error')
    if (err) {
      toast.error(`YouTube: ${err}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [ladeYtStatus])

  const automatisch = trackZumUrteil(props?.verdict, tracks)
  const musik = musikWahl === 'auto' ? automatisch : musikWahl || null
  const track = musik ? musikTrack(musik) : null
  const sprechFp = props ? moatShortSprechFingerprint(props) : ''
  const stimmePasst = Boolean(props?.voiceSrc && stimmeFp === sprechFp)
  const fertig = props
    ? {
        ...props,
        musicSrc: musikPlaySrc(musik),
        logoUrl: logoPlaySrc(props.logoUrl),
        musicGain: (track?.gain ?? 0.5) * (musikPegel / 100),
        musicTrim: Math.round((track?.startSekunden ?? 0) * MOAT_SHORT_FPS),
        sfx,
        voiceSrc: stimmePasst ? props.voiceSrc : null,
        voiceAlignment: stimmePasst ? props.voiceAlignment : null,
      }
    : null
  const beschreibung = uploadBeschreibung
  const fremd =
    props && ergebnis
      ? fremdeZahlen(
          [props.hook, props.hookLoop, props.business, ...props.pillars.map((p) => p.line), props.crack, props.closing].join(' '),
          ergebnis.metriken,
          [ergebnis.moat.score, ...props.pillars.map((p) => p.score)],
        )
      : []
  const zahlenWarnung = fremd.length ? `Zahlen ohne Quelle im Export: ${fremd.join(', ')}` : null
  const loopWarnung = props
    ? [...scriptLoopWarnungen(props.hook, props.closing, props.metricValue), ...scriptStoryWarnungen(props.hookLoop, props.crack)]
    : []

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
    if (stimmeFp === moatShortSprechFingerprint(props)) return
    leereStimme()
  }, [props, stimmeFp])

  async function stimmeErzeugen() {
    if (!props) return
    setStimmeLaedt(true)
    try {
      const res = await fetch('/api/youtube/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ props }),
      })
      const j = (await res.json()) as { ok?: boolean; audioBase64?: string; woerter?: MoatShortVoiceWort[]; fehler?: string; error?: string }
      if (!res.ok || !j.ok || !j.audioBase64 || !j.woerter?.length) {
        toast.error(j.fehler || j.error || 'Stimme fehlgeschlagen.')
        return
      }
      const url = URL.createObjectURL(base64ZuMp3(j.audioBase64))
      setVoiceUrl((alt) => {
        if (alt) URL.revokeObjectURL(alt)
        return url
      })
      setStimmeFp(moatShortSprechFingerprint(props))
      setProps((p) => (p ? { ...p, voiceSrc: url, voiceAlignment: j.woerter ?? null } : p))
      toast.success('Stimme liegt auf der Timeline.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Stimme fehlgeschlagen.')
    } finally {
      setStimmeLaedt(false)
    }
  }

  async function youtubeVerbinden() {
    setYtLaedt(true)
    try {
      const res = await fetch('/api/youtube/auth/start', { method: 'POST' })
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok || !body.url) {
        toast.error(body.error ?? 'OAuth-Start fehlgeschlagen.')
        return
      }
      window.location.href = body.url
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Verbindung fehlgeschlagen.')
    } finally {
      setYtLaedt(false)
    }
  }

  async function youtubeTrennen() {
    setYtLaedt(true)
    try {
      const res = await fetch('/api/youtube/auth/disconnect', { method: 'POST' })
      if (!res.ok) {
        toast.error('Trennen fehlgeschlagen.')
        return
      }
      toast.success('YouTube getrennt.')
      setYt((s) => ({ ...s, connected: false, channelTitle: null }))
    } finally {
      setYtLaedt(false)
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
          tags: tagsFuerUpload(uploadBeschreibung, ergebnis?.suchphrasen ?? [], props?.ticker ?? ''),
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

  function waehleHook(h: MoatShortHookVariante) {
    const m = ergebnis?.metriken.find((x) => x.id === h.metrikId)
    setProps((p) =>
      p
        ? {
            ...p,
            hook: h.claim,
            hookLoop: h.loop,
            closing: h.land,
            ...(m ? { metricValue: m.value, metricLabel: m.label } : {}),
          }
        : p,
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
      const sauber = gesprocheneZeilen(j.props)
      setErgebnis({
        ...j,
        props: sauber,
        hookVarianten: j.hookVarianten.map((h) => ({
          ...h,
          claim: ohneKennzahlId(h.claim),
          loop: ohneKennzahlId(h.loop),
          land: ohneKennzahlId(h.land),
        })),
      })
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
    const ticker = fertig.ticker.replace(/[^A-Z0-9]/gi, '').toUpperCase() || 'SHORT'
    const dateiname = `${ticker}-moat.mp4`
    setRendert(true)
    setRenderProzent(0)
    setRenderDatei(dateiname)
    try {
      const blob = await rendereMoatShortImBrowser(fertig, (p) => {
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

  function setze<K extends keyof MoatShortProps>(key: K, wert: MoatShortProps[K]) {
    setProps((p) => (p ? { ...p, [key]: wert } : p))
  }

  return (
    <PageChrome>
      <PageHero
        eyebrow="YouTube"
        title="Moat Check Shorts"
        description="Fundamentaldaten-Export einfügen. Daraus entstehen Moat-Urteil, englisches Script und ein Short, das unsichtbar in sich zurückläuft."
      />

      <section className="app-section-shell">
        <div className="app-surface-card-header flex items-center justify-between px-4 py-2.5 sm:px-5">
          <h2 className="text-base font-semibold tracking-tight text-[var(--app-text)]">YouTube-Kanal</h2>
          {yt.connected ? (
            <span className="text-xs text-[var(--app-text-muted)]">{yt.channelTitle || 'YouTube verbunden'}</span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5 sm:py-4">
          {!yt.configured ? (
            <p className="text-sm text-[var(--app-text-muted)]">
              YOUTUBE_CLIENT_ID und YOUTUBE_CLIENT_SECRET fehlen. Redirect:{' '}
              <code className="text-xs">/api/youtube/auth/callback</code>
            </p>
          ) : yt.connected ? (
            <>
              <p className="text-sm text-[var(--app-text-muted)]">
                Upload direkt aus dem Browser. Standard ist unlisted, bis der Kanal geprüft ist.
              </p>
              <button
                type="button"
                disabled={ytLaedt}
                onClick={() => void youtubeTrennen()}
                className="ml-auto rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)]"
              >
                Trennen
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-[var(--app-text-muted)]">
                Einmal verbinden — danach landet das gerenderte MP4 ohne Umweg über Studio.
              </p>
              <button
                type="button"
                disabled={ytLaedt}
                onClick={() => void youtubeVerbinden()}
                className="ml-auto rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {ytLaedt ? 'Weiterleitung…' : 'YouTube verbinden'}
              </button>
            </>
          )}
        </div>
      </section>

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
            <button
              type="button"
              onClick={() => {
                const b = beispielErgebnis()
                setErgebnis(b)
                setProps(b.props)
                setMp4Blob(null)
                setVideoId(null)
                setVoiceUrl((alt) => {
                  if (alt) URL.revokeObjectURL(alt)
                  return null
                })
                setStimmeFp(null)
              }}
              className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)]"
            >
              ASML-Beispiel
            </button>
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
                <p className="text-xs font-medium text-[var(--app-text-muted)]">
                  Hook-Kreis — Landung mündet grammatisch in die Behauptung
                </p>
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
                      <span className="mt-1 block text-[11px] text-[var(--app-text-muted)]">Ende → {h.land}</span>
                    </button>
                  )
                })}

                <label className="block pt-1 text-xs font-medium text-[var(--app-text-muted)]">Behauptung (steht als Überschrift im Bild)</label>
                <textarea value={props.hook} onChange={(e) => setze('hook', e.target.value)} rows={2} className={feldKlasse} />
                <label className="block text-xs font-medium text-[var(--app-text-muted)]">
                  Spannungssatz, noch ohne Bedrohung. Der Crack kommt nach den Säulen.
                </label>
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
                {loopWarnung.map((w) => (
                  <p key={w} className="text-xs text-amber-300">
                    {w}
                  </p>
                ))}
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
                <label className="text-xs font-medium text-[var(--app-text-muted)]">The crack — löst den Spannungssatz</label>
                <textarea value={props.crack} onChange={(e) => setze('crack', e.target.value)} rows={2} className={`${feldKlasse} mt-1`} />
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--app-text-muted)]">
                  Landung — offene Brücke, kein Schlusssatz. Danach beginnt die Behauptung.
                </label>
                <textarea value={props.closing} onChange={(e) => setze('closing', e.target.value)} rows={2} className={`${feldKlasse} mt-1`} />
                <p className="mt-2 rounded-lg bg-[var(--app-surface-muted)] px-3 py-2 text-xs leading-relaxed text-[var(--app-text-muted)]">
                  <span className="font-medium text-[var(--app-text)]">{props.closing}</span>
                  {' → '}
                  {props.hook}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--app-border)] p-3 text-sm">
                <p className="text-xs font-medium text-[var(--app-text-muted)]">Upload — Titel, Beschreibung, Kommentar</p>
                <label className="mt-2 block text-xs text-[var(--app-text-muted)]">Titel</label>
                <input value={uploadTitel} onChange={(e) => setUploadTitel(e.target.value)} className={`${feldKlasse} mt-1`} />
                <p className="mt-1 text-[11px] text-[var(--app-text-muted)]">
                  {uploadTitel.length} Zeichen · Keyword vorne, 28–58, kein # im Titel
                </p>
                {ergebnis.suchphrasen.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ergebnis.suchphrasen.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setUploadTitel(p.slice(0, 50))}
                        className="rounded-full border border-[var(--app-border)] px-2 py-0.5 text-[11px] text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)]"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-[var(--app-text-muted)]">Keine YouTube-Suchvorschläge — Titel bleibt der Script-Vorschlag.</p>
                )}
                <label className="mt-3 block text-xs text-[var(--app-text-muted)]">Beschreibung</label>
                <textarea value={uploadBeschreibung} onChange={(e) => setUploadBeschreibung(e.target.value)} rows={6} className={`${feldKlasse} mt-1 font-sans`} />
                <label className="mt-3 block text-xs text-[var(--app-text-muted)]">Anzupinnender Kommentar</label>
                <input value={uploadKommentar} onChange={(e) => setUploadKommentar(e.target.value)} className={`${feldKlasse} mt-1`} />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(uploadTitel).then(() => toast.success('Titel kopiert'))}
                    className="rounded-lg border border-[var(--app-border)] px-3 py-1 text-xs text-[var(--app-text-muted)]"
                  >
                    Titel
                  </button>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(beschreibung).then(() => toast.success('Beschreibung kopiert'))}
                    className="rounded-lg border border-[var(--app-border)] px-3 py-1 text-xs text-[var(--app-text-muted)]"
                  >
                    Beschreibung
                  </button>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(uploadKommentar).then(() => toast.success('Kommentar kopiert'))}
                    className="rounded-lg border border-[var(--app-border)] px-3 py-1 text-xs text-[var(--app-text-muted)]"
                  >
                    Kommentar
                  </button>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                  Anpinnen geht in Studio (kein extra Scope). Ersten Frame als Thumbnail, Related Video auf euer bestes Longform. Nicht für Kinder.
                </p>
              </div>
            </div>
          </section>

          <section className="app-section-shell">
            <div className="app-surface-card-header px-4 py-2.5 sm:px-5">
              <h2 className="text-base font-semibold tracking-tight text-[var(--app-text)]">3 · Vorschau</h2>
            </div>
            <div className="space-y-3 px-4 py-3 sm:px-5 sm:py-4">
              {fertig ? <MoatShortPreview props={fertig} restartKey={musikPegelCommit} /> : null}
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
                  Passend zum Urteil. Tracks sind untereinander angeglichen — der Regler sitzt darüber. Lizenz CC BY 4.0, Namensnennung in der Beschreibung.
                </p>
              ) : null}
              {!tracks.length ? (
                <p className="text-xs text-[var(--app-text-muted)]">Musik wird beim ersten Laden heruntergeladen. Seite ggf. neu laden.</p>
              ) : null}
              <label className="flex items-center gap-2 text-xs text-[var(--app-text-muted)]">
                <input type="checkbox" checked={sfx} onChange={(e) => setSfx(e.target.checked)} />
                Soundeffekte (Schnitte, Balken, Stempel)
              </label>
              {!stimmeOk ? (
                <p className="text-xs text-[var(--app-text-muted)]">
                  Stimme: ELEVENLABS_API_KEY und ELEVENLABS_VOICE_ID in .env.local — Klon bleibt bei ElevenLabs.
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
                <p className="text-xs text-[var(--app-text-muted)]">Untertitel und Schnitte folgen der Aufnahme. Script ändern = Stimme neu.</p>
              ) : voiceUrl || props?.voiceAlignment ? (
                <p className="text-xs text-amber-300">Script hat sich geändert — Stimme neu erzeugen, sonst bleibt die Schätzung.</p>
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
                <a
                  href={youtubeShortsUrl(videoId)}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-center text-xs text-red-300 underline"
                >
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
              <p className="text-xs text-[var(--app-text-muted)]">
                Läuft online in Chrome oder Edge, ein bis drei Minuten. Tab offen lassen. Das MP4 bleibt im Tab für den Upload — nicht über Vercel.
              </p>
            </div>
          </section>
        </div>
      ) : null}
    </PageChrome>
  )
}

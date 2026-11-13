'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { EarningsShortsClient } from '@/components/youtube/earnings-shorts.client'
import { VidiqClient } from '@/components/youtube/vidiq.client'
import { YoutubeEigeneTags } from '@/components/youtube/youtube-eigene-tags'
import { PageChrome, PageHero } from '@/components/page-shell'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { gesamtScoreAusPfeilern } from '@/lib/portfolio-analyse/moat-ki-types'
import type { MoatShortAntwort, MoatShortErgebnis, MoatShortHookVariante } from '@/lib/youtube/moat-short-types'
import { gespeicherterMusikPegel, ladeVorhandeneTracks, liesMusikDatei, musikTrack, trackZumUrteil } from '@/lib/youtube/moat-short-musik'
import { phrasePasst } from '@/lib/youtube/youtube-keywords'
import { tagsSichtbar } from '@/lib/youtube/youtube-tags'
import { logoPlaySrc, musikPlaySrc } from '@/lib/youtube/moat-short-media-src'
import { rendereMoatShortImBrowser } from '@/lib/youtube/moat-short-render-web'
import { PUBLISH_ZIELE } from '@/lib/youtube/publish-ziele'
import { ziffernImText } from '@/lib/youtube/moat-caption'
import { heroMetricAus } from '@/lib/youtube/moat-hero-metric'
import { doppelteWendung, fremderKlassenSatz, hookKarteFuerUnternehmen, hookPaar, istOffeneBruecke, kickerZurZahl, kuerzeGesprocheneZeile, oeffneSprechende, ohneKennzahlId, sanitiereMoatFuerStimme, schaetzeSprechsekunden, scriptLoopWarnungen, scriptStoryWarnungen } from '@/lib/youtube/moat-short-script'
import type { MoatRichtung } from '@/lib/youtube/moat-short-urteil'
import { fuehrendeStilleMs } from '@/lib/youtube/moat-short-silence'
import { gespeicherteStimmeRegler, moatShortSprechFingerprint, speichereStimmeRegler } from '@/lib/youtube/moat-short-voice'
import { ladeMp4ZuYoutube, youtubeShortsUrl } from '@/lib/youtube/youtube-upload-client'
import { fremdeZahlen } from '@/lib/youtube/moat-short-zahlen'
import type { MoatShortVoiceWort } from '@/remotion/moat-short-types'
import { MOAT_SHORT_DEFAULT_PROPS, MOAT_SHORT_FPS, type MoatShortProps } from '@/remotion/moat-short-types'

type YtStatus = { configured: boolean; connected: boolean; channelTitle: string | null }
type YtPrivacy = 'unlisted' | 'private' | 'public'
type YoutubeModus = 'moat' | 'earnings' | 'vidiq'

function base64ZuMp3(b64: string): Blob {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: 'audio/mpeg' })
}

function tagsFuerUpload(
  beschreibung: string,
  suchphrasen: string[],
  ticker: string,
  firmenname: string,
  eigene: string[] = [],
): string[] {
  const hashes = [...beschreibung.matchAll(/#([A-Za-z0-9_]+)/g)].map((m) => m[1])
  const extra = suchphrasen
    .filter((s) => phrasePasst(s, ticker, firmenname))
    .map((s) => s.replace(/[^A-Za-z0-9 ]/g, '').trim())
    .filter(Boolean)
  return tagsSichtbar([ticker, ...hashes, ...extra], eigene, [])
}

const WINKEL_LABEL: Record<string, string> = {
  number_shock: 'Zahl schockt',
  contrast: 'Kontrast',
  stakes: 'Was auf dem Spiel steht',
}

const HOOK_WINKEL = ['number_shock', 'contrast', 'stakes'] as const

function hookKarten(varianten: MoatShortHookVariante[]): MoatShortHookVariante[] {
  const geordnet: MoatShortHookVariante[] = []
  const gesehen = new Set<MoatShortHookVariante>()
  for (const winkel of HOOK_WINKEL) {
    const treffer = varianten.find((h) => h.winkel === winkel && !gesehen.has(h))
    if (!treffer) continue
    gesehen.add(treffer)
    geordnet.push(treffer)
  }
  for (const h of varianten) {
    if (gesehen.has(h)) continue
    gesehen.add(h)
    geordnet.push(h)
  }
  return geordnet
}

function geschaeftsKontext(p: MoatShortProps, e: MoatShortErgebnis): string {
  return [p.kicker, e.moat.geschaeftsmodell, ...e.moat.pfeiler.flatMap((x) => [x.begruendung, x.risiko]), ...p.pillars.map((x) => x.line), p.business]
    .filter((z) => z && z.trim() && z.trim() !== '–')
    .join('\n')
}

function scriptZumKopieren(p: MoatShortProps): string {
  return [
    `Blickfang: ${p.kicker}`,
    `Frage: ${p.hook}`,
    `Antwort: ${p.proof}`,
    ...p.pillars.map((x) => `${x.label}: ${x.line}`),
    `Crack: ${p.crack}`,
    `Landung: ${p.closing}`,
  ].join('\n')
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
      {
        winkel: 'number_shock',
        kicker: props.kicker,
        claim: props.hook,
        proof: props.proof,
        loop: props.hookLoop,
        land: props.closing,
        metrikId: 'gm',
      },
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
  if (/^(data:|blob:)/i.test(url)) return url
  return logoPlaySrc(url) ?? `/${url.replace(/^\/+/, '')}`
}

function dateiZuLogo(datei: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objekt = URL.createObjectURL(datei)
    const img = new Image()
    img.onload = () => {
      const max = 512
      const faktor = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight, 1))
      const w = Math.max(1, Math.round(img.naturalWidth * faktor))
      const h = Math.max(1, Math.round(img.naturalHeight * faktor))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(objekt)
        reject(new Error('Bild lässt sich nicht lesen.'))
        return
      }
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(objekt)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => {
      URL.revokeObjectURL(objekt)
      reject(new Error('Das ist kein lesbares Bild.'))
    }
    img.src = objekt
  })
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

function zeileWennNoetig(text: string, opts?: { behalten?: string; maxWoerter?: number; frage?: boolean }): string {
  const roh = ohneKennzahlId(text).replace(/\s+/g, ' ').trim()
  const woerter = roh.split(/\s+/).filter(Boolean).length
  const maxW = opts?.maxWoerter ?? 12
  const gestapelt = /\bno\s+\w+\s+can\s+avoid\b/i.test(roh) || /\bselling\s+\w+\s+no\s+/i.test(roh)
  if (woerter <= maxW && roh.length <= 78 && !gestapelt) return roh
  return kuerzeGesprocheneZeile(roh, { maxWoerter: maxW, maxZeichen: 78, behalten: opts?.behalten, frage: opts?.frage })
}

function kickerWennNoetig(kicker: string): string {
  const t = ohneKennzahlId(kicker).replace(/\s+/g, ' ').trim()
  const teile = t.split(/\s+/).filter(Boolean)
  if (teile.length <= 5 && t.length <= 28) return t
  const kurz = teile.slice(0, 5).join(' ')
  return kurz.length <= 28 ? kurz : kurz.slice(0, 28).replace(/\s+\S*$/, '').trim()
}

function gesprocheneZeilen(p: MoatShortProps): MoatShortProps {
  const alsFrage = Boolean(p.proof.trim()) || /\?\s*$/.test(p.hook.trim())
  const hook = ziffernImText(
    zeileWennNoetig(p.hook, {
      behalten: alsFrage ? undefined : p.metricValue,
      maxWoerter: alsFrage ? 10 : 12,
      frage: alsFrage,
    }),
  )
  const proof = ziffernImText(
    p.proof.trim()
      ? /\b(?:lets|let) them print\b|\b(?:drives|drive)\b/i.test(p.proof)
        ? p.proof.replace(/\s+/g, ' ').trim()
        : zeileWennNoetig(p.proof, { behalten: p.metricValue, maxWoerter: 14 })
      : p.proof,
  )
  const closingRoh = ziffernImText(istOffeneBruecke(p.closing, p.metricValue) ? ohneKennzahlId(p.closing) : p.closing)
  return {
    ...p,
    kicker: kickerZurZahl(kickerWennNoetig(p.kicker), p.metricLabel, `${hook} ${proof}`),
    hook,
    proof,
    hookLoop: '',
    business: ohneKennzahlId(p.business),
    crack: ziffernImText(zeileWennNoetig(p.crack)),
    closing: istOffeneBruecke(closingRoh, p.metricValue) ? oeffneSprechende(closingRoh) : closingRoh,
    pillars: p.pillars.map((x) => ({ ...x, line: ziffernImText(zeileWennNoetig(x.line, { behalten: x.stat?.value })) })),
  }
}

const feldKlasse =
  'w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-red-500/40'

const studioFeld =
  'w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-[13px] text-neutral-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] focus:border-emerald-400/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/25'

function Wellenform({ aktiv, peaks }: { aktiv: boolean; peaks: number[] | null }) {
  const balken = peaks ?? Array.from({ length: 28 }, () => 0.28)
  return (
    <div className="flex h-10 items-end justify-center gap-[3px]" aria-hidden>
      {balken.map((p, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full ${aktiv ? 'animate-pulse bg-emerald-300' : peaks ? 'bg-emerald-400/80' : 'bg-neutral-700'}`}
          style={{
            height: `${Math.max(4, Math.round((aktiv ? 0.3 + (i % 6) * 0.1 : p) * 36))}px`,
            animationDelay: `${i * 45}ms`,
          }}
        />
      ))}
    </div>
  )
}

async function wellenformAusBlob(blob: Blob): Promise<number[] | null> {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer())
    const data = buf.getChannelData(0)
    const n = 28
    const sprung = Math.max(1, Math.floor(data.length / n))
    const out: number[] = []
    for (let i = 0; i < n; i++) {
      let max = 0
      const start = i * sprung
      for (let j = 0; j < sprung; j += 24) max = Math.max(max, Math.abs(data[start + j] ?? 0))
      out.push(max)
    }
    const decke = Math.max(...out, 0.01)
    return out.map((v) => v / decke)
  } catch {
    return null
  } finally {
    await ctx.close()
  }
}

export function YoutubeShortsClient() {
  const [modus, setModus] = useState<YoutubeModus>('moat')
  const [rohText, setRohText] = useState('')
  const [eigenesLogo, setEigenesLogo] = useState<string | null>(null)
  const [logoAusSuche, setLogoAusSuche] = useState<string | null>(null)
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
      next.kicker === props.kicker &&
      next.hook === props.hook &&
      next.proof === props.proof &&
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
  const [tracks, setTracks] = useState<string[]>([])
  const [eigeneMusik, setEigeneMusik] = useState<string | null>(null)
  const [eigeneMusikName, setEigeneMusikName] = useState<string | null>(null)
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
  const [eigeneTags, setEigeneTags] = useState<string[]>([])
  const [ohneTags, setOhneTags] = useState<string[]>([])
  const [stimmeOk, setStimmeOk] = useState(false)
  const [stimmeLaedt, setStimmeLaedt] = useState(false)
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null)
  const [stimmeFp, setStimmeFp] = useState<string | null>(null)
  const [stabilitaet, setStabilitaet] = useState(40)
  const [aehnlichkeit, setAehnlichkeit] = useState(80)
  const [stil, setStil] = useState(20)
  const [tempo, setTempo] = useState(1.15)
  const [betonung, setBetonung] = useState(100)
  const [wellenform, setWellenform] = useState<number[] | null>(null)
  const [moatWahl, setMoatWahl] = useState<MoatRichtung>('ki')
  const [richtungLaedt, setRichtungLaedt] = useState<Extract<MoatRichtung, 'groesser' | 'kleiner'> | null>(null)

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
    void ladeVorhandeneTracks().then(setTracks)
    const gespeichert = gespeicherterMusikPegel()
    if (gespeichert != null) {
      const v = Math.max(0, Math.min(100, gespeichert))
      setMusikPegel(v)
      setMusikPegelCommit(v)
    }
    const regler = gespeicherteStimmeRegler()
    setStabilitaet(regler.stabilitaet)
    setAehnlichkeit(regler.aehnlichkeit)
    setStil(regler.stil)
    setTempo(regler.tempo)
    setBetonung(regler.betonung)
    void ladeYtStatus()
    void fetch('/api/youtube/voice')
      .then((r) => r.json() as Promise<{ configured?: boolean }>)
      .then((j) => setStimmeOk(Boolean(j.configured)))
      .catch(() => setStimmeOk(false))
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('modus') === 'earnings') setModus('earnings')
    if (sp.get('modus') === 'vidiq') setModus('vidiq')
    if (sp.get('yt') === 'connected') {
      toast.success('YouTube verbunden.')
      const next = new URL(window.location.href)
      next.searchParams.delete('yt')
      window.history.replaceState({}, '', next.pathname + next.search)
      void ladeYtStatus()
    }
    const err = sp.get('yt_error')
    if (err) {
      toast.error(`YouTube: ${err}`)
      const next = new URL(window.location.href)
      next.searchParams.delete('yt_error')
      window.history.replaceState({}, '', next.pathname + next.search)
    }
  }, [ladeYtStatus])

  const automatisch = trackZumUrteil(props?.verdict, tracks)
  const katalogMusik = musikWahl === 'auto' ? automatisch : musikWahl || null
  const musik = eigeneMusik ?? katalogMusik
  const track = katalogMusik ? musikTrack(katalogMusik) : null
  const sprechFp = props ? moatShortSprechFingerprint(props) : ''
  const autoTags = tagsFuerUpload(uploadBeschreibung, ergebnis?.suchphrasen ?? [], props?.ticker ?? '', props?.firmenname ?? '', [])
  const youtubeTags = tagsSichtbar(autoTags, eigeneTags, ohneTags)
  const stimmePasst = Boolean(props?.voiceSrc && stimmeFp === sprechFp)
  const fertig = props
    ? {
        ...props,
        musicSrc: musikPlaySrc(musik),
        logoUrl: logoPlaySrc(props.logoUrl),
        musicGain: (track?.gain ?? 1) * (musikPegel / 100),
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
          [props.hook, props.proof, ...props.pillars.map((p) => p.line), props.crack, props.closing].join(' '),
          ergebnis.metriken,
          [ergebnis.moat.score, ...props.pillars.map((p) => p.score)],
        )
      : []
  const zahlenWarnung = fremd.length ? `Zahlen ohne Quelle im Export: ${fremd.join(', ')}` : null
  const loopWarnung = props
    ? [...scriptLoopWarnungen(props.hook, props.closing, props.metricValue, props.proof, props.metricLabel), ...scriptStoryWarnungen(props.hookLoop, props.crack)]
    : []
  const doppelHinweis = props ? doppelteWendung(props) : null
  const stoppVorZahl = props ? /[.!?…,:;—–-]\s+(?:an?\s+)?\d/.test([props.proof, props.hook, props.crack, props.closing].join(' ')) : false
  const flussOk = !doppelHinweis && !stoppVorZahl
  const sprechSekunden = props
    ? schaetzeSprechsekunden([props.hook, props.proof, ...props.pillars.map((p) => p.line), props.crack, props.closing], tempo)
    : 0
  const dauerImFenster = sprechSekunden >= 27 && sprechSekunden <= 30

  useEffect(() => {
    if (!ergebnis) return
    setUploadTitel(ergebnis.title)
    setUploadBeschreibung(track?.credit ? `${ergebnis.description}\n\n${track.credit}` : ergebnis.description)
  }, [ergebnis, track?.credit])

  useEffect(() => {
    if (!props || !ergebnis) return
    const kontext = geschaeftsKontext(props, ergebnis)
    if (!fremderKlassenSatz(props.hook, kontext) && !fremderKlassenSatz(props.proof, kontext)) return
    const metrik = ergebnis.metriken.find((m) => m.value === props.metricValue && m.label === props.metricLabel)
    const paar = hookPaar(props.hook, props.proof, props.firmenname, props.metricValue, props.metricLabel, metrik?.id ?? '', kontext)
    if (paar.claim === props.hook && paar.proof === props.proof) return
    setProps((p) => (p ? { ...p, hook: paar.claim, proof: paar.proof } : p))
  }, [props, ergebnis])

  function leereStimme() {
    setVoiceUrl((alt) => {
      if (alt) URL.revokeObjectURL(alt)
      return null
    })
    setStimmeFp(null)
    setWellenform(null)
    setProps((p) => (p ? { ...p, voiceSrc: null, voiceAlignment: null, voiceLeadMs: undefined } : p))
  }

  useEffect(() => {
    if (!props?.voiceAlignment || !stimmeFp) return
    if (stimmeFp === moatShortSprechFingerprint(props)) return
    leereStimme()
  }, [props, stimmeFp])

  async function stimmeErzeugen() {
    if (!props) return
    const sauber = sanitiereMoatFuerStimme(props)
    setStimmeLaedt(true)
    setWellenform(null)
    try {
      const res = await fetch('/api/youtube/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          props: sauber,
          stimme: {
            stability: stabilitaet / 100,
            similarity: aehnlichkeit / 100,
            style: stil / 100,
            speed: tempo,
            pause: 0,
            betonung,
          },
        }),
      })
      const j = (await res.json()) as { ok?: boolean; audioBase64?: string; woerter?: MoatShortVoiceWort[]; fehler?: string; error?: string }
      if (!res.ok || !j.ok || !j.audioBase64 || !j.woerter?.length) {
        toast.error(j.fehler || j.error || 'Stimme fehlgeschlagen.')
        return
      }
      const blob = base64ZuMp3(j.audioBase64)
      const url = URL.createObjectURL(blob)
      const [voiceLeadMs, peaks] = await Promise.all([
        fuehrendeStilleMs(blob).catch(() => undefined),
        wellenformAusBlob(blob),
      ])
      setVoiceUrl((alt) => {
        if (alt) URL.revokeObjectURL(alt)
        return url
      })
      setWellenform(peaks)
      setStimmeFp(moatShortSprechFingerprint(sauber))
      setProps({ ...sauber, voiceSrc: url, voiceAlignment: j.woerter ?? null, voiceLeadMs })
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
          tags: youtubeTags,
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
      const msg = e instanceof Error ? e.message : 'Upload fehlgeschlagen.'
      if (/erneut verbinden/i.test(msg)) setYt((s) => ({ ...s, connected: false, channelTitle: null }))
      toast.error(msg)
    } finally {
      setUploadLaedt(false)
    }
  }

  function waehleHook(frage: string, antwort: string, metrikId: string) {
    const m = ergebnis?.metriken.find((x) => x.id === metrikId)
    setProps((p) =>
      p
        ? {
            ...p,
            hook: frage,
            proof: antwort,
            ...(m
              ? {
                  metricValue: m.value,
                  metricLabel: m.label,
                  heroMetric: heroMetricAus(m.value, m.label, antwort),
                  proof: heroMetricAus(m.value, m.label, antwort).spoken_reference,
                }
              : {}),
          }
        : p,
    )
  }

  async function dateiGewaehlt(datei: File | undefined) {
    if (datei) setRohText(await datei.text())
  }

  async function logoGewaehlt(datei: File | undefined) {
    if (!datei) return
    if (!/^image\/(png|jpeg|webp)$/.test(datei.type)) {
      toast.error('Logo als PNG, JPG oder WebP.')
      return
    }
    if (datei.size > 8_000_000) {
      toast.error('Das Logo ist größer als 8 MB.')
      return
    }
    try {
      const url = await dateiZuLogo(datei)
      setEigenesLogo(url)
      setProps((p) => (p ? { ...p, logoUrl: url } : p))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Logo lässt sich nicht lesen.')
    }
  }

  function logoEntfernen() {
    setEigenesLogo(null)
    setProps((p) => (p ? { ...p, logoUrl: logoAusSuche } : p))
  }

  function scriptAusAntwort(j: MoatShortErgebnis, logoUrl: string | null): MoatShortErgebnis {
    const sauber = gesprocheneZeilen({ ...j.props, logoUrl })
    return {
      ...j,
      props: sauber,
      hookVarianten: j.hookVarianten.map((h) => ({
        ...h,
        kicker: ohneKennzahlId(h.kicker),
        claim: ohneKennzahlId(h.claim),
        proof: ohneKennzahlId(h.proof),
        loop: ohneKennzahlId(h.loop),
        land: ohneKennzahlId(h.land),
      })),
    }
  }

  function zeigeScript(stand: MoatShortErgebnis, logoUrl: string | null) {
    setErgebnis(stand)
    setProps({ ...stand.props, logoUrl, voiceSrc: null, voiceAlignment: null })
    setMp4Blob(null)
    setVideoId(null)
    setVoiceUrl((alt) => {
      if (alt) URL.revokeObjectURL(alt)
      return null
    })
    setStimmeFp(null)
  }

  async function richtungWaehlen(richtung: 'groesser' | 'kleiner') {
    if (moatWahl === richtung || richtungLaedt) return
    const eingabe = leseExport(rohText)
    if (typeof eingabe === 'string') {
      toast.error('Höher und niedriger brauchen den eingefügten Export.')
      return
    }
    setRichtungLaedt(richtung)
    try {
      const res = await fetch('/api/youtube/short', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paket: eingabe.paket, isin: eingabe.isin, moatRichtung: richtung }),
      })
      const j = (await res.json()) as MoatShortAntwort | { error?: string }
      if (!('ok' in j) || !j.ok) {
        toast.error(('fehler' in j && j.fehler) || ('error' in j && j.error) || `Fehler (HTTP ${res.status})`)
        return
      }
      const gefunden = await pruefeLogo(j.props.logoUrl)
      setLogoAusSuche(gefunden)
      const logoUrl = eigenesLogo ?? gefunden
      setMoatWahl(richtung)
      zeigeScript(scriptAusAntwort({ ...j, warnungen: eigenesLogo ? j.warnungen.filter((w) => !w.includes('Firmenlogo')) : j.warnungen }, logoUrl), logoUrl)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Netzwerkfehler')
    } finally {
      setRichtungLaedt(null)
    }
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
      const gefunden = await pruefeLogo(j.props.logoUrl)
      setLogoAusSuche(gefunden)
      const logoUrl = eigenesLogo ?? gefunden
      const sauber = gesprocheneZeilen({ ...j.props, logoUrl })
      const stand: MoatShortErgebnis = {
        ...j,
        warnungen: eigenesLogo ? j.warnungen.filter((w) => !w.includes('Firmenlogo')) : j.warnungen,
        props: sauber,
        hookVarianten: j.hookVarianten.map((h) => ({
          ...h,
          kicker: ohneKennzahlId(h.kicker),
          claim: ohneKennzahlId(h.claim),
          proof: ohneKennzahlId(h.proof),
          loop: ohneKennzahlId(h.loop),
          land: ohneKennzahlId(h.land),
        })),
      }
      setMoatWahl('ki')
      setErgebnis(stand)
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

  function wechsleModus(next: YoutubeModus) {
    setModus(next)
    const u = new URL(window.location.href)
    if (next === 'moat') u.searchParams.delete('modus')
    else u.searchParams.set('modus', next)
    window.history.replaceState({}, '', u.pathname + u.search)
  }

  return (
    <PageChrome>
      <PageHero
        eyebrow="YouTube"
        title={modus === 'earnings' ? 'Earnings Check Shorts' : modus === 'vidiq' ? 'VidIQ' : 'Moat Check Shorts'}
        description={
          modus === 'earnings'
            ? 'Ticker wählen. Daraus entstehen Beat/Miss, die wichtigen Call-Themen und ein längeres Short im gleichen Look.'
            : modus === 'vidiq'
              ? 'Bestehende Shorts bewerten, Titel und Tags verbessern und direkt auf YouTube schreiben.'
              : 'Fundamentaldaten-Export einfügen. Daraus entstehen Moat-Urteil, englisches Script und ein Short, das unsichtbar in sich zurückläuft.'
        }
      />
      <div className="mb-4 flex gap-2 px-1">
        <button
          type="button"
          onClick={() => wechsleModus('moat')}
          className={`rounded-xl px-4 py-2 text-sm font-medium ${
            modus === 'moat'
              ? 'bg-red-600 text-white'
              : 'border border-[var(--app-border)] text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)]'
          }`}
        >
          Moat Check
        </button>
        <button
          type="button"
          onClick={() => wechsleModus('earnings')}
          className={`rounded-xl px-4 py-2 text-sm font-medium ${
            modus === 'earnings'
              ? 'bg-red-600 text-white'
              : 'border border-[var(--app-border)] text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)]'
          }`}
        >
          Earnings Check
        </button>
        <button
          type="button"
          onClick={() => wechsleModus('vidiq')}
          className={`rounded-xl px-4 py-2 text-sm font-medium ${
            modus === 'vidiq'
              ? 'bg-emerald-600 text-white'
              : 'border border-[var(--app-border)] text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)]'
          }`}
        >
          VidIQ
        </button>
      </div>

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

      {modus === 'earnings' ? (
        <EarningsShortsClient yt={yt} onVerbindungWeg={() => setYt((s) => ({ ...s, connected: false, channelTitle: null }))} />
      ) : null}

      {modus === 'vidiq' ? (
        <VidiqClient onReconnect={() => setYt((s) => ({ ...s, connected: false, channelTitle: null }))} />
      ) : null}

      {modus === 'moat' ? (
      <>
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
            <label className="cursor-pointer rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)]">
              Logo hochladen
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  void logoGewaehlt(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
            {eigenesLogo ? (
              <span className="inline-flex items-center gap-2 text-sm text-[var(--app-text-muted)]">
                <img src={eigenesLogo} alt="" className="h-9 w-9 rounded-md border border-[var(--app-border)] bg-white object-contain p-0.5" />
                wird verwendet
                <button type="button" onClick={logoEntfernen} className="underline">
                  entfernen
                </button>
              </span>
            ) : (
              <span className="text-xs text-[var(--app-text-muted)]">PNG, JPG oder WebP. Ersetzt die Logo-Suche.</span>
            )}
            <button
              type="button"
              onClick={() => {
                const b = beispielErgebnis()
                setMoatWahl('ki')
                setErgebnis(b)
                setProps({ ...b.props, logoUrl: eigenesLogo ?? b.props.logoUrl })
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
                Moat {gesamtScoreAusPfeilern(props.pillars.map((p) => p.score)).toFixed(1)}/10 ·{' '}
                {moatWahl === 'ki'
                  ? ergebnis.moatAusCache
                    ? 'gespeichertes Urteil'
                    : 'KI-Urteil'
                  : moatWahl === 'groesser'
                    ? 'höher'
                    : 'niedriger'}
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
                    {eigenesLogo ? ' · hochgeladenes Logo' : props.logoUrl ? ' · echtes Firmenlogo' : ' · kein Logo gefunden'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    ['kleiner', 'Niedriger'],
                    ['groesser', 'Höher'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    disabled={laedt || richtungLaedt !== null}
                    onClick={() => void richtungWaehlen(id)}
                    className={`rounded-full border px-3 py-1 text-xs disabled:opacity-50 ${
                      moatWahl === id
                        ? 'border-red-500/60 bg-red-500/10 text-[var(--app-text)]'
                        : 'border-[var(--app-border)] text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)]'
                    }`}
                  >
                    {richtungLaedt === id ? 'Score und Text…' : label}
                  </button>
                ))}
              </div>

              {ergebnis.warnungen.length ? (
                <ul className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                  {ergebnis.warnungen.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}

              <div className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-950/90 p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-md">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400">Script studio</p>
                    <button
                      type="button"
                      onClick={() =>
                        void navigator.clipboard.writeText(scriptZumKopieren(props)).then(
                          () => toast.success('Script kopiert'),
                          () => toast.error('Kopieren fehlgeschlagen.'),
                        )
                      }
                      className="rounded-full border border-neutral-800 bg-neutral-950 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-200 hover:border-neutral-600"
                    >
                      Script kopieren
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${dauerImFenster ? 'border-emerald-500/40 text-emerald-200' : 'border-amber-500/40 text-amber-200'}`}>
                      ~{sprechSekunden.toFixed(0)}s · Ziel 27–30s
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${flussOk ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-100' : 'border-amber-400/60 bg-amber-400/10 text-amber-100'}`}>
                      {doppelHinweis ? 'Warning: Duplicate Phrase Detected' : stoppVorZahl ? 'Warning: Pause Before Number' : 'Grammar & Pacing OK'}
                    </span>
                  </div>
                </div>
                {doppelHinweis ? <p className="font-mono text-[11px] text-amber-200/90">{doppelHinweis}</p> : null}
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {hookKarten(ergebnis.hookVarianten).map((h) => {
                  const m = ergebnis.metriken.find((x) => x.id === h.metrikId)
                  const karte = hookKarteFuerUnternehmen({
                    winkel: h.winkel,
                    claim: h.claim,
                    proof: h.proof,
                    firma: props.firmenname,
                    wert: m?.value ?? props.metricValue,
                    label: m?.label ?? props.metricLabel,
                    id: m?.id ?? h.metrikId,
                    kontext: geschaeftsKontext(props, ergebnis),
                  })
                  const aktiv = props.hook === karte.frage && props.proof === karte.antwort
                  return (
                    <button
                      key={`${h.winkel}-${h.metrikId}`}
                      type="button"
                      aria-pressed={aktiv}
                      onClick={() => waehleHook(karte.frage, karte.antwort, h.metrikId)}
                      className={`rounded-xl border px-3 py-3 text-left transition ${
                        aktiv
                          ? 'border-emerald-400/70 bg-emerald-400/10 shadow-[0_0_24px_rgba(52,211,153,0.16)]'
                          : 'border-neutral-800 bg-neutral-950 hover:border-neutral-600'
                      }`}
                    >
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-300/80">
                        {WINKEL_LABEL[h.winkel]}
                      </span>
                      <span className="mt-2 block text-sm font-medium text-neutral-100">{karte.frage}</span>
                      <span className="mt-1 block font-mono text-[11px] leading-relaxed text-neutral-400">{karte.antwort}</span>
                    </button>
                  )
                })}
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <label className="block font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                  Blickfang, nur im Bild. 2–5 Wörter.
                  <input value={props.kicker} onChange={(e) => setze('kicker', e.target.value)} className={`${studioFeld} mt-1`} />
                </label>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                  Große Zahl, ab Frame 0 im Bild.
                <select
                  value={ergebnis.metriken.find((m) => m.value === props.metricValue && m.label === props.metricLabel)?.id ?? ''}
                  onChange={(e) => {
                    const m = ergebnis.metriken.find((x) => x.id === e.target.value)
                    if (m) {
                      setProps((p) =>
                        p
                          ? {
                              ...p,
                              metricValue: m.value,
                              metricLabel: m.label,
                              proof: heroMetricAus(m.value, m.label, p.proof).spoken_reference,
                              heroMetric: heroMetricAus(m.value, m.label, p.proof),
                            }
                          : p,
                      )
                    }
                  }}
                  className={`${studioFeld} mt-1`}
                >
                  {ergebnis.metriken
                    .filter((m) => m.hook)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        Große Zahl: {m.label} · {m.value}
                      </option>
                    ))}
                </select>
                </label>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-neutral-500 md:col-span-2">
                  Frage, gesprochen ab Sekunde 0. Ohne die Zahl.
                  <textarea value={props.hook} onChange={(e) => setze('hook', e.target.value)} rows={2} className={`${studioFeld} mt-1`} />
                </label>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-neutral-500 md:col-span-2">
                  Antwort: Treiber, Zahl, Folge. Ein Atemzug.
                  <textarea value={props.proof} onChange={(e) => setze('proof', e.target.value)} rows={2} className={`${studioFeld} mt-1`} />
                </label>
                </div>
                {loopWarnung.map((w) => (
                  <p key={w} className="text-xs text-amber-300">
                    {w}
                  </p>
                ))}
                {zahlenWarnung ? <p className="font-mono text-[11px] text-amber-200">{zahlenWarnung}</p> : null}

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {props.pillars.map((p, i) => (
                <div key={p.id} className="rounded-xl border border-neutral-800 bg-neutral-950 p-2">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
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
                    className={`${studioFeld} mt-1`}
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
                    className={`${studioFeld} mt-1 text-xs`}
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
              </div>

              <label className="block font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                The crack — löst den Spannungssatz
                <textarea value={props.crack} onChange={(e) => setze('crack', e.target.value)} rows={2} className={`${studioFeld} mt-1`} />
              </label>

              <label className="block font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                Landung — offene Brücke, kein Schlusssatz.
                <textarea value={props.closing} onChange={(e) => setze('closing', e.target.value)} rows={2} className={`${studioFeld} mt-1`} />
              </label>
              <p className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-[11px] leading-relaxed text-neutral-400">
                <span className="text-neutral-100">{props.closing}</span>
                {' → '}
                {props.hook}
              </p>
              </div>

              <div className="rounded-xl border border-[var(--app-border)] p-3 text-sm">
                <p className="text-xs font-medium text-[var(--app-text-muted)]">Upload — Titel, Beschreibung, Kommentar</p>
                <label className="mt-2 block text-xs text-[var(--app-text-muted)]">Titel</label>
                <input value={uploadTitel} onChange={(e) => setUploadTitel(e.target.value)} className={`${feldKlasse} mt-1`} />
                <p className="mt-1 text-[11px] text-[var(--app-text-muted)]">
                  {uploadTitel.length} Zeichen · gesprochene Zeile, 40–60, kein Doppelpunkt
                </p>
                {ergebnis.suchphrasen.length ? (
                  <div className="mt-2">
                    <p className="text-[11px] text-[var(--app-text-muted)]">Suchbegriffe in der Beschreibung, nicht der Titel.</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {ergebnis.suchphrasen.map((p) => (
                        <span
                          key={p}
                          className="rounded-full border border-[var(--app-border)] px-2 py-0.5 text-[11px] text-[var(--app-text-muted)]"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-[var(--app-text-muted)]">Keine passenden YouTube-Suchbegriffe — Beschreibung nutzt den Firmennamen.</p>
                )}
                <label className="mt-3 block text-xs text-[var(--app-text-muted)]">Beschreibung</label>
                <textarea value={uploadBeschreibung} onChange={(e) => setUploadBeschreibung(e.target.value)} rows={6} className={`${feldKlasse} mt-1 font-sans`} />
                <YoutubeEigeneTags
                  eigene={eigeneTags}
                  onEigene={setEigeneTags}
                  automatisch={autoTags}
                  ohne={ohneTags}
                  onOhne={setOhneTags}
                />
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
              <select
                value={musikWahl}
                onChange={(e) => {
                  setEigeneMusik(null)
                  setEigeneMusikName(null)
                  setMusikWahl(e.target.value)
                }}
                className={`${feldKlasse} text-xs`}
              >
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
              <label className="flex items-center gap-2 text-xs text-[var(--app-text-muted)]">
                <input
                  type="file"
                  accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg,.mp3,.m4a,.wav,.ogg"
                  className="max-w-full text-xs"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    void liesMusikDatei(file)
                      .then((url) => {
                        setEigeneMusik(url)
                        setEigeneMusikName(file.name)
                      })
                      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : 'MP3 nicht lesbar'))
                  }}
                />
                {eigeneMusikName ?? 'MP3 direkt wählen'}
              </label>
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
                  Automatisch zum Urteil. 50 % = −24 dB unter der Stimme. Namensnennung ist nicht nötig, der Link steht trotzdem in der Beschreibung. MP3s aus der Audio Library: beat-your-competition.mp3, know-myself.mp3, brain-trust.mp3.
                </p>
              ) : null}
              {!tracks.length && !eigeneMusik ? (
                <p className="text-xs text-[var(--app-text-muted)]">
                  Die drei MP3s liegen lokal in public/youtube-music. Diese Seite sieht sie nur, wenn sie lokal läuft. Sonst oben die Datei wählen.
                </p>
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
                <>
                  <div className="space-y-2">
                    {(
                      [
                        ['stabilitaet', 'Stabilität', stabilitaet, setStabilitaet, 0, 100, String(stabilitaet)],
                        ['aehnlichkeit', 'Ähnlichkeit', aehnlichkeit, setAehnlichkeit, 0, 100, String(aehnlichkeit)],
                        ['stil', 'Stil', stil, setStil, 0, 100, String(stil)],
                        ['betonung', 'Betonung der Zahl', betonung, setBetonung, 0, 100, betonung <= 0 ? 'Punkt' : 'Ausrufezeichen'],
                      ] as const
                    ).map(([teil, label, wert, setze, min, max, anzeige]) => (
                      <label key={teil} className="block text-xs text-[var(--app-text-muted)]">
                        {label} {anzeige}
                        <input
                          type="range"
                          min={min}
                          max={max}
                          step={1}
                          value={wert}
                          onChange={(e) => {
                            const v = Number(e.target.value)
                            setze(v)
                            speichereStimmeRegler(teil, v)
                          }}
                          className="mt-1 w-full accent-red-600"
                        />
                      </label>
                    ))}
                    <label className="block text-xs text-[var(--app-text-muted)]">
                      Tempo {tempo.toFixed(2)}
                      <input
                        type="range"
                        min={70}
                        max={120}
                        step={1}
                        value={Math.round(tempo * 100)}
                        onChange={(e) => {
                          const v = Number(e.target.value) / 100
                          setTempo(v)
                          speichereStimmeRegler('tempo', v)
                        }}
                        className="mt-1 w-full accent-red-600"
                      />
                    </label>
                    <p className="text-xs text-[var(--app-text-muted)]">
                      Start ist der jetzige Klang: Stabilität 40, Ähnlichkeit 80, Stil 20, Tempo 1,15, die Zahl ohne Pause im selben Satz, mit Ausrufezeichen. Tempo geht von 0,70 bis 1,20. Wirkt nach „Stimme neu erzeugen“.
                    </p>
                  </div>
                  <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2">
                    <Wellenform aktiv={stimmeLaedt} peaks={wellenform} />
                  </div>
                  <button
                    type="button"
                    disabled={stimmeLaedt || !props}
                    onClick={() => void stimmeErzeugen()}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm disabled:opacity-50 ${
                      stimmeLaedt
                        ? 'animate-pulse border-emerald-400/50 bg-emerald-400/10 text-emerald-100'
                        : 'border-neutral-800 bg-neutral-950 text-neutral-100 hover:border-neutral-600'
                    }`}
                  >
                    {stimmeLaedt ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-600 border-t-emerald-300" />
                        Stimme wird erzeugt…
                      </>
                    ) : stimmePasst ? (
                      'Stimme neu erzeugen'
                    ) : (
                      'Stimme erzeugen'
                    )}
                  </button>
                </>
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
              <YoutubeEigeneTags
                eigene={eigeneTags}
                onEigene={setEigeneTags}
                automatisch={autoTags}
                ohne={ohneTags}
                onOhne={setOhneTags}
              />
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
      </>
      ) : null}
    </PageChrome>
  )
}

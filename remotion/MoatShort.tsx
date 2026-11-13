import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadInterTight } from '@remotion/google-fonts/InterTight'
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono'
import { Audio } from '@remotion/media'
import { mouseClick, shutterModern, whoosh } from '@remotion/sfx'
import { useMemo } from 'react'
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  interpolateColors,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { gesamtScoreAusPfeilern } from '../lib/portfolio-analyse/moat-ki-types'
import { istOffeneBruecke, kickerZurZahl, oeffneSprechende, ohneKennzahlId, ohneKiBindestrich } from '../lib/youtube/moat-short-script'
import { logoPlaySrc } from '../lib/youtube/moat-short-media-src'
import { berechneMoatShortTimeline } from './moat-short-timeline'
import { SubscribeBadge } from './SubscribeBadge'
import { SFX_CONFIG } from './sfx-config'
import { MOAT_SHORT_FPS, MOAT_SHORT_HEIGHT, type MoatShortBeat, type MoatShortProps, type MoatShortTimeline, type MoatShortVerdict } from './moat-short-types'

const { fontFamily: DISPLAY } = loadInterTight('normal', { weights: ['600', '800', '900'], subsets: ['latin'] })
const { fontFamily: SANS } = loadInter('normal', { weights: ['600', '700'], subsets: ['latin'] })
const { fontFamily: MONO } = loadMono('normal', { weights: ['500', '700'], subsets: ['latin'] })

const BG = '#0C0C0E'
const BG_CRACK = '#1D0E0C'
const TEXT = '#F3F1EC'
const MUTED = 'rgba(243, 241, 236, 0.52)'
const BRAND = '#E9B44C'
const VERDICT_FARBE: Record<MoatShortVerdict, string> = { wide: '#6FD39A', narrow: '#E9B44C', none: '#EF6A5A' }
const VERDICT_LABEL: Record<MoatShortVerdict, string> = { wide: 'Wide moat', narrow: 'Narrow moat', none: 'No moat' }
const STEMPEL_AUFPRALL = 9
/** YouTube-UI: oben 15 %, unten 22 %. Links und rechts gleich 15 %, sonst liegt die Mitte links der Leinwand. */
const SAFE_TOP = Math.round(MOAT_SHORT_HEIGHT * 0.15)
const SAFE_BOTTOM = Math.round(MOAT_SHORT_HEIGHT * 0.22)
const SAFE_X = Math.round(1080 * 0.15)
const SAFE_LEFT = SAFE_X
const SAFE_RIGHT = SAFE_X
const CAPTION_YELLOW = '#FFE14A'
const CAPTION_SIZE = 76
const CAPTION_LINE = 1.05
/** Sanfter Schub. Der Ursprung liegt auf dem Inhalt, damit die feste Kopfzeile nicht mitzoomt. */
const INHALT_TOP = SAFE_TOP + 130
/** Balken-Feder ist bei Frame 15 angekommen. */
const PILLAR_ZAHL_FRAME = 15

function saubereProps(p: MoatShortProps): MoatShortProps {
  const hook = ohneKennzahlId(ohneKiBindestrich(p.hook))
  const proof = ohneKennzahlId(ohneKiBindestrich(p.proof))
  const closing = ohneKennzahlId(ohneKiBindestrich(p.closing))
  return {
    ...p,
    kicker: kickerZurZahl(ohneKennzahlId(ohneKiBindestrich(p.kicker)), p.metricLabel, `${hook} ${proof}`),
    hook,
    proof,
    hookLoop: ohneKennzahlId(ohneKiBindestrich(p.hookLoop)),
    business: ohneKennzahlId(ohneKiBindestrich(p.business)),
    crack: ohneKennzahlId(ohneKiBindestrich(p.crack)),
    closing: istOffeneBruecke(closing, p.metricValue) ? oeffneSprechende(closing) : closing,
    pillars: p.pillars.map((x) => ({ ...x, line: ohneKennzahlId(ohneKiBindestrich(x.line)) })),
  }
}

function scoreFarbe(score: number): string {
  if (score >= 8) return VERDICT_FARBE.wide
  if (score >= 6) return VERDICT_FARBE.narrow
  return VERDICT_FARBE.none
}

/** Flex-Wrap: sichtbarer Abstand, echter Umbruch, zentrierte Zeilen. */
function Wortzeile({
  text,
  farbeFuer,
  gewichtFuer,
}: {
  text: string
  farbeFuer?: (wort: string, i: number) => string
  gewichtFuer?: (wort: string, i: number) => number
}) {
  return (
    <span
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        columnGap: '0.32em',
        rowGap: 0,
        maxWidth: '100%',
        lineHeight: CAPTION_LINE,
      }}
    >
      {text
        .trim()
        .split(/\s+/)
        .map((w, i) => (
          <span key={i} style={{ color: farbeFuer?.(w, i), fontWeight: gewichtFuer?.(w, i), lineHeight: CAPTION_LINE, paddingBottom: 8 }}>
            {w}
          </span>
        ))}
    </span>
  )
}

function beat(beats: MoatShortBeat[], id: MoatShortBeat['id']): MoatShortBeat {
  return beats.find((b) => b.id === id) ?? { id, text: '', from: 0, duration: 1 }
}

export const MoatShort: React.FC<MoatShortProps> = (roh) => {
  const frame = useCurrentFrame()
  const props = useMemo(() => saubereProps(roh), [roh])
  const timeline = useMemo(() => berechneMoatShortTimeline(props), [props])
  const { beats, captions, durationInFrames } = timeline

  const hook = beat(beats, 'hook')
  const proof = beats.find((b) => b.id === 'proof')
  const p0 = beat(beats, 'pillar0')
  const p3 = beat(beats, 'pillar3')
  const crack = beat(beats, 'crack')
  const verdict = beat(beats, 'verdict')
  const crackEnde = crack.from + crack.duration

  const bg =
    beats.some((b) => b.id === 'crack') && crack.from > 0
      ? interpolateColors(
          frame,
          [crack.from, crack.from + 2, crack.from + 6, crackEnde - 4, crackEnde],
          [BG, '#6A2A24', BG_CRACK, BG_CRACK, BG],
        )
      : BG

  return (
    <AbsoluteFill style={{ backgroundColor: bg, color: TEXT, fontFamily: DISPLAY }}>
      <Sequence
        from={hook.from}
        durationInFrames={Math.max(1, (p0.from > hook.from ? p0.from : proof ? proof.from + proof.duration : hook.from + hook.duration) - hook.from)}
        layout="none"
      >
        <HookSzene
          kicker={props.kicker}
          logoUrl={props.logoUrl}
          ticker={props.ticker}
          value={props.metricValue}
          label={props.metricLabel}
          satz2Ab={satz2Frame(proof?.from ?? null, hook.from)}
        />
      </Sequence>
      <Sequence from={p0.from} durationInFrames={p3.from + p3.duration - p0.from} layout="none">
        <PillarSzene pillars={props.pillars} starts={[0, 1, 2, 3].map((i) => beat(beats, `pillar${i}` as MoatShortBeat['id']).from - p0.from)} />
      </Sequence>
      <Sequence from={crack.from} durationInFrames={crack.duration} layout="none">
        <CrackSzene />
      </Sequence>
      <Sequence from={verdict.from} durationInFrames={Math.max(1, durationInFrames - verdict.from)} layout="none">
        <VerdictSzene
          verdict={props.verdict}
          score={gesamtScoreAusPfeilern(props.pillars.map((p) => p.score))}
          fadeOut={0}
        />
      </Sequence>

      {frame >= p0.from ? (
        <Kopfzeile
          ticker={props.ticker}
          logoUrl={props.logoUrl}
          fortschritt={frame / Math.max(1, durationInFrames - 1)}
        />
      ) : null}
      <Koernung />

      {captions.map((c, i) => (
        <Sequence key={i} from={c.from} durationInFrames={c.duration} layout="none">
          <Caption text={c.text} woerter={c.woerter} top={captionTop(c.from, proof?.from ?? null, p0.from)} />
        </Sequence>
      ))}

      <Ton
        musicSrc={props.musicSrc}
        musicGain={props.musicGain}
        musicTrim={props.musicTrim ?? 0}
        sfx={props.sfx}
        voiceSrc={props.voiceSrc}
        voiceTrim={timeline.voiceTrimFrames}
        voiceSchnitte={timeline.voiceSchnitte}
        metricFrame={timeline.metricFrame}
        dauer={durationInFrames}
        beats={beats}
      />
    </AbsoluteFill>
  )
}

function wortAusklang(laenge: number) {
  const fade = Math.max(1, Math.round((SFX_CONFIG.wortFadeMs / 1000) * MOAT_SHORT_FPS))
  return (frame: number) => {
    const rest = laenge - 1 - frame
    if (rest >= fade) return 1
    return Math.max(0, (rest + 1) / fade)
  }
}

function Stimme({
  src,
  trim,
  schnitte,
  dauer,
}: {
  src: string
  trim: number
  schnitte: MoatShortTimeline['voiceSchnitte']
  dauer: number
}) {
  const datei = stimmeAudioSrc(src)
  const lead = Math.max(0, trim)
  const luft = Math.round(SFX_CONFIG.loopLuftSekunden * MOAT_SHORT_FPS)
  const stimmeBis = Math.max(1, dauer - luft)
  const cuts = schnitte.filter((s) => s.bisFrame > s.vonFrame && s.vonFrame >= lead)
  if (!cuts.length) {
    return (
      <Audio
        src={datei}
        volume={wortAusklang(stimmeBis)}
        trimBefore={lead > 0 ? lead : undefined}
        durationInFrames={stimmeBis}
      />
    )
  }
  const teile: { from: number; trimBefore: number; duration: number }[] = []
  let cursor = lead
  let komposition = 0
  for (const s of cuts) {
    const spanne = s.vonFrame - cursor
    if (spanne > 0) {
      teile.push({ from: komposition, trimBefore: cursor, duration: spanne })
      komposition += spanne
    }
    cursor = Math.max(cursor, s.bisFrame)
  }
  teile.push({ from: komposition, trimBefore: cursor, duration: Math.max(1, stimmeBis - komposition) })
  return (
    <>
      {teile.map((t, i) => (
        <Sequence key={i} from={t.from} durationInFrames={t.duration} layout="none">
          <Audio
            src={datei}
            volume={i === teile.length - 1 ? wortAusklang(t.duration) : 1}
            trimBefore={t.trimBefore > 0 ? t.trimBefore : undefined}
            durationInFrames={t.duration}
          />
        </Sequence>
      ))}
    </>
  )
}

function Ton({
  musicSrc,
  musicGain,
  musicTrim,
  sfx,
  voiceSrc,
  voiceTrim,
  voiceSchnitte,
  metricFrame,
  dauer,
  beats,
}: {
  musicSrc: string | null
  musicGain: number
  musicTrim: number
  sfx: boolean
  voiceSrc: string | null
  voiceTrim: number
  voiceSchnitte: MoatShortTimeline['voiceSchnitte']
  metricFrame: number | null
  dauer: number
  beats: MoatShortBeat[]
}) {
  /** Schnitt-Sounds bleiben unter der Stimme. Pegel stehen in SFX_CONFIG. */
  const cues: { from: number; src: string; volume: number }[] = []
  for (const b of beats) {
    if (b.id === 'pillar0' || b.id === 'crack') cues.push({ from: b.from, src: whoosh, volume: SFX_CONFIG.uebergang.pegel })
    if (b.id.startsWith('pillar')) cues.push({ from: b.from + PILLAR_ZAHL_FRAME, src: mouseClick, volume: SFX_CONFIG.balken.pegel })
    if (b.id === 'verdict') cues.push({ from: b.from + STEMPEL_AUFPRALL - 1, src: shutterModern, volume: SFX_CONFIG.stempel.pegel })
  }
  const reveal = beats.find((b) => b.id === 'proof')?.from
  const tick = reveal != null && reveal > 0 ? reveal : metricFrame != null && metricFrame > 0 ? metricFrame : null
  if (tick != null) cues.push({ from: tick, src: mouseClick, volume: SFX_CONFIG.heroTick.pegel })

  const deckel = voiceSrc ? 0.063 : 0.126
  const relativ = Math.max(0, musicGain) / 0.5
  const musikVolume = Math.max(0, Math.min(1, deckel * relativ))

  return (
    <>
      {musicSrc ? (
        <Audio
          src={musikAudioSrc(musicSrc)}
          loop
          volume={musikVolume}
          trimBefore={musicTrim > 0 ? musicTrim : undefined}
        />
      ) : null}
      {voiceSrc ? <Stimme src={voiceSrc} trim={voiceTrim} schnitte={voiceSchnitte} dauer={dauer} /> : null}
      {sfx ? (
        <Sequence from={0} durationInFrames={8} layout="none">
          <Audio src={hookImpactSrc()} volume={SFX_CONFIG.hookImpact.pegel} />
        </Sequence>
      ) : null}
      {sfx
        ? cues.map((c, i) => (
            <Sequence key={i} from={c.from} durationInFrames={24} layout="none">
              <Audio src={c.src} volume={c.volume} />
            </Sequence>
          ))
        : null}
    </>
  )
}

function logoSrc(url: string): string {
  if (/^(data:|blob:)/i.test(url)) return url
  const play = logoPlaySrc(url)
  if (play && (/^(data:|blob:|https?:)/i.test(play) || play.startsWith('/api/'))) return play
  return staticFile((play ?? url).replace(/^\/+/, ''))
}

function hookImpactSrc(): string {
  if (typeof window !== 'undefined' && !('remotion_staticBase' in window && window.remotion_staticBase)) {
    return `${window.location.origin}/${SFX_CONFIG.hookImpact.datei}`
  }
  return staticFile(SFX_CONFIG.hookImpact.datei)
}

function stimmeAudioSrc(src: string): string {
  if (/^(blob:|data:|https?:)/i.test(src) || src.startsWith('/api/')) return src
  return src
}

function musikAudioSrc(src: string): string {
  if (/^(blob:|data:|https?:)/i.test(src) || src.startsWith('/youtube-music/') || src.startsWith('/api/')) return src
  const datei = src.split('/').pop() ?? src
  if (typeof window !== 'undefined' && !('remotion_staticBase' in window && window.remotion_staticBase) && datei) {
    return `${window.location.origin}/youtube-music/${encodeURIComponent(datei)}`
  }
  return staticFile(src.replace(/^\/+/, ''))
}

function kamera(frame: number): number {
  return interpolate(frame, [0, 80], [1, 1.04], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
}

/** Satz 2, sonst etwa Sekunde 3. Die Hero-Zahl bleibt bis dahin unsichtbar. */
function satz2Frame(proofFrom: number | null, hookFrom: number): number {
  const start = proofFrom == null ? Math.round(3 * MOAT_SHORT_FPS) : proofFrom - hookFrom
  return start >= 12 ? start : Math.round(3 * MOAT_SHORT_FPS)
}

function heroAnzeige(value: string, fortschritt: number): string {
  const m = value.trim().match(/^([^0-9+-]*)([+-]?\d+(?:\.\d+)?)(.*)$/)
  if (!m || fortschritt >= 1) return value
  const prefix = m[1] ?? ''
  const num = m[2] ?? ''
  const suffix = m[3] ?? ''
  if (!prefix.includes('$') && !suffix.includes('%') && !suffix.includes('$')) return value
  const n = Number(num)
  if (!Number.isFinite(n)) return value
  const decimals = (num.split('.')[1] ?? '').length
  const aktuell = n * fortschritt
  const text = decimals ? aktuell.toFixed(decimals) : String(Math.round(aktuell))
  const vorzeichen = num.startsWith('+') && aktuell > 0 ? '+' : ''
  return `${prefix}${vorzeichen}${text}${suffix}`
}

function captionTop(frame: number, proofFrom: number | null, pillarFrom: number): number {
  if (proofFrom != null && pillarFrom > proofFrom && frame >= proofFrom && frame < pillarFrom) return 1120
  if (frame < pillarFrom) return 900
  return 1040
}

function Kopfzeile({
  ticker,
  logoUrl,
  fortschritt,
}: {
  ticker: string
  logoUrl: string | null
  fortschritt: number
}) {
  return (
    <div style={{ position: 'absolute', top: SAFE_TOP, left: SAFE_LEFT, right: SAFE_RIGHT }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: MONO, fontSize: 28, letterSpacing: 6, fontWeight: 700 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ width: 14, height: 14, borderRadius: 7, background: BRAND }} />
          MOAT CHECK
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 14, color: MUTED }}>
          {logoUrl ? (
            <Img src={logoSrc(logoUrl)} style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 10, background: '#FFFFFF', padding: 4 }} />
          ) : null}
          ${ticker}
        </span>
      </div>
      <div style={{ marginTop: 26, height: 3, background: 'rgba(243,241,236,0.1)', borderRadius: 2 }}>
        <div style={{ width: `${Math.min(0.92, fortschritt) * 100}%`, height: '100%', background: BRAND, borderRadius: 2 }} />
      </div>
    </div>
  )
}

function HookSzene({
  kicker,
  logoUrl,
  ticker,
  value,
  label,
  satz2Ab,
}: {
  kicker: string
  logoUrl: string | null
  ticker: string
  value: string
  label: string
  /** Lokaler Frame, an dem Satz 2 und die Hero-Zahl starten. */
  satz2Ab: number
}) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const revealFrames = Math.max(1, Math.round(0.25 * fps))
  const countFrames = Math.max(1, Math.round(0.35 * fps))
  const ende = Math.max(satz2Ab + 1, durationInFrames - 1)
  const logoScale =
    frame < satz2Ab
      ? interpolate(frame, [0, satz2Ab], [1, 1.04], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      : interpolate(frame, [satz2Ab, satz2Ab + revealFrames], [1.04, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const heroScale =
    frame < satz2Ab
      ? 1
      : interpolate(frame, [satz2Ab, ende], [1, 1.05], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const lokal = Math.max(0, frame - satz2Ab)
  const ein = spring({
    frame: lokal,
    fps,
    config: { damping: 16, mass: 0.55, stiffness: 220 },
    durationInFrames: revealFrames,
  })
  const y = interpolate(ein, [0, 1], [42, 0])
  const deckkraft = interpolate(lokal, [0, revealFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const zahlGang = interpolate(lokal, [0, countFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  })
  const kickerGroesse = kicker.length <= 16 ? 64 : kicker.length <= 24 ? 52 : 44
  const buehneOben = (logoUrl ? SAFE_TOP + 248 : SAFE_TOP + 36) + 64
  const zeigen = frame >= satz2Ab
  return (
    <AbsoluteFill style={{ transform: `scale(${heroScale})`, transformOrigin: `center ${SAFE_TOP + 120}px` }}>
      <div
        style={{
          position: 'absolute',
          top: SAFE_TOP + 12,
          left: SAFE_LEFT,
          right: SAFE_RIGHT,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transform: `scale(${logoScale})`,
          transformOrigin: 'center top',
        }}
      >
        {logoUrl ? (
          <div
            style={{
              width: 220,
              height: 220,
              borderRadius: 40,
              background: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 28,
              boxSizing: 'border-box',
            }}
          >
            <Img src={logoSrc(logoUrl)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        ) : null}
        <div style={{ marginTop: logoUrl ? 18 : 0, fontFamily: MONO, fontSize: 32, letterSpacing: 6, fontWeight: 700 }}>${ticker}</div>
      </div>
      {zeigen ? (
        <div
          style={{
            position: 'absolute',
            top: buehneOben,
            left: SAFE_LEFT,
            right: SAFE_RIGHT,
            bottom: MOAT_SHORT_HEIGHT - 860,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            opacity: deckkraft,
            transform: `translateY(${y}px)`,
          }}
        >
          <div style={{ fontSize: value.length > 7 ? 132 : 168, fontWeight: 900, letterSpacing: -6, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {heroAnzeige(value, zahlGang)}
          </div>
          <div style={{ marginTop: 14, fontFamily: MONO, fontSize: 26, letterSpacing: 6, color: MUTED, textTransform: 'uppercase' }}>{label}</div>
          {kicker ? (
            <div style={{ marginTop: 28, maxWidth: 820, fontSize: kickerGroesse, fontWeight: 900, letterSpacing: -1.5, lineHeight: 0.98 }}>
              {kicker}
            </div>
          ) : null}
        </div>
      ) : null}
    </AbsoluteFill>
  )
}

function PillarSzene({ pillars, starts }: { pillars: MoatShortProps['pillars']; starts: number[] }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const aktiv = starts.reduce((a, s, i) => (frame >= s ? i : a), 0)
  const p = pillars[aktiv] ?? pillars[0]
  if (!p) return null
  const lokal = frame - (starts[aktiv] ?? 0)
  const fuell = spring({ frame: Math.max(0, lokal), fps, config: { damping: 22, mass: 0.7 }, durationInFrames: 14 })
  const farbe = scoreFarbe(p.score)
  return (
    <AbsoluteFill style={{ transform: `scale(${kamera(lokal)})`, transformOrigin: `center ${INHALT_TOP}px` }}>
      <div style={{ position: 'absolute', top: INHALT_TOP + 80, left: SAFE_LEFT, right: SAFE_RIGHT }}>
        <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -1.2, lineHeight: 0.95 }}>{p.label}</div>
        <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 200, fontWeight: 700, color: farbe, lineHeight: 0.86, fontVariantNumeric: 'tabular-nums' }}>
          {p.score}
          <span style={{ color: MUTED, fontSize: 64 }}>/10</span>
        </div>
        <div style={{ marginTop: 28, height: 48, borderRadius: 24, background: 'rgba(243,241,236,0.09)', overflow: 'hidden' }}>
          <div style={{ width: `${(p.score / 10) * Math.min(1, fuell) * 100}%`, height: '100%', borderRadius: 24, background: farbe }} />
        </div>
        {p.stat ? (
          <div style={{ marginTop: 22, fontFamily: MONO, fontSize: 32, letterSpacing: 0.4 }}>
            <span style={{ color: farbe, fontWeight: 700 }}>{p.stat.value}</span>
            <span style={{ color: MUTED }}> · {p.stat.label}</span>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  )
}

function CrackSzene() {
  const frame = useCurrentFrame()
  const zeichnen = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const pfad = 'M 8 100 L 120 48 L 210 128 L 320 36 L 430 140 L 540 52 L 650 132 L 760 40 L 830 96'
  const laenge = 1400
  return (
    <AbsoluteFill style={{ transform: `scale(${kamera(frame)})`, transformOrigin: `center ${INHALT_TOP}px` }}>
      <div style={{ position: 'absolute', top: INHALT_TOP + 40, left: SAFE_LEFT, right: SAFE_RIGHT, textAlign: 'center' }}>
        <div style={{ fontFamily: MONO, fontSize: 28, letterSpacing: 8, color: VERDICT_FARBE.none }}>WHAT COULD BREAK IT</div>
        <div style={{ marginTop: 18, fontSize: 132, fontWeight: 900, letterSpacing: -4, lineHeight: 0.92 }}>The crack</div>
        <svg width="100%" height={180} viewBox="0 0 838 180" preserveAspectRatio="none" style={{ marginTop: 12 }}>
          <path d={pfad} fill="none" stroke={VERDICT_FARBE.none} strokeWidth={10} strokeLinejoin="miter" strokeDasharray={laenge} strokeDashoffset={laenge * (1 - zeichnen)} />
        </svg>
      </div>
    </AbsoluteFill>
  )
}

function VerdictSzene({ verdict, score, fadeOut }: { verdict: MoatShortVerdict; score: number; fadeOut: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const stempel = spring({ frame, fps, config: { damping: 12, mass: 0.45, stiffness: 220 } })
  const aufprall = Math.max(0, 1 - Math.abs(frame - STEMPEL_AUFPRALL) / 4)
  const wackeln = fadeOut > 0.2 ? 0 : aufprall * Math.sin(frame * 2.3) * 4
  const farbe = VERDICT_FARBE[verdict]
  return (
    <AbsoluteFill style={{ opacity: 1 - fadeOut, transform: `scale(${kamera(frame)}) translate(${wackeln}px, ${wackeln * 0.4}px)`, transformOrigin: `center ${INHALT_TOP}px` }}>
      <div style={{ position: 'absolute', top: INHALT_TOP + 80, left: SAFE_LEFT, right: SAFE_RIGHT, textAlign: 'center' }}>
        <div style={{ fontFamily: MONO, fontSize: 28, letterSpacing: 8, color: MUTED }}>VERDICT</div>
        <div
          style={{
            display: 'inline-block',
            marginTop: 28,
            padding: '22px 40px',
            border: `8px solid ${farbe}`,
            borderRadius: 24,
            color: farbe,
            fontSize: 92,
            fontWeight: 900,
            letterSpacing: -2,
            textTransform: 'uppercase',
            lineHeight: 1,
            transform: `rotate(-5deg) scale(${interpolate(stempel, [0, 1], [1.12, 1])})`,
          }}
        >
          {VERDICT_LABEL[verdict]}
        </div>
        <div style={{ marginTop: 28, fontFamily: MONO, fontSize: 48, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {score.toFixed(1)}
          <span style={{ color: MUTED, fontSize: 30 }}> / 10</span>
        </div>
        <SubscribeBadge />
      </div>
    </AbsoluteFill>
  )
}

function aktivesWort(woerter: { start: number; end: number }[], frame: number): number {
  const treffer = woerter.findIndex((w) => frame >= w.start && frame < w.end)
  if (treffer >= 0) return treffer
  let last = 0
  for (let i = 0; i < woerter.length; i++) if (frame >= woerter[i]!.start) last = i
  return last
}

function Caption({ text, woerter, top }: { text: string; woerter: { text: string; start: number; end: number }[]; top: number }) {
  const frame = useCurrentFrame()
  const aktiv = aktivesWort(woerter, frame)
  return (
    <div
      style={{
        position: 'absolute',
        top: Math.min(top, MOAT_SHORT_HEIGHT - SAFE_BOTTOM - 180),
        left: SAFE_LEFT,
        right: SAFE_RIGHT,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth: '100%',
          textAlign: 'center',
          background: 'rgba(0, 0, 0, 0.72)',
          padding: '10px 22px 16px',
          borderRadius: 18,
        }}
      >
        <span
          style={{
            display: 'block',
            width: '100%',
            fontFamily: SANS,
            fontSize: CAPTION_SIZE,
            fontWeight: 800,
            letterSpacing: -0.5,
            lineHeight: CAPTION_LINE,
            textAlign: 'center',
          }}
        >
          <Wortzeile text={text} farbeFuer={(_w, i) => (i === aktiv ? CAPTION_YELLOW : TEXT)} />
        </span>
      </div>
    </div>
  )
}

function Koernung() {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const amJoin = frame < 2 || frame >= durationInFrames - 2
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)' }} />
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.07, mixBlendMode: 'overlay' }}>
        <filter id="moat-korn">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={amJoin ? 0 : Math.floor(frame / 2) % 6} stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#moat-korn)" />
      </svg>
    </AbsoluteFill>
  )
}

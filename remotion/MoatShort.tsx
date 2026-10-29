import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadInterTight } from '@remotion/google-fonts/InterTight'
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono'
import { Audio } from '@remotion/media'
import { mouseClick, shutterModern, shutterOld, whoosh } from '@remotion/sfx'
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
import { ohneKennzahlId, ohneKiBindestrich } from '../lib/youtube/moat-short-script'
import { logoPlaySrc } from '../lib/youtube/moat-short-media-src'
import { berechneMoatShortTimeline } from './moat-short-timeline'
import { MOAT_SHORT_HEIGHT, type MoatShortBeat, type MoatShortProps, type MoatShortVerdict } from './moat-short-types'

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
/** YouTube-UI: oben 15 %, unten 22 %, rechts 15 % für die Buttons. */
const SAFE_TOP = Math.round(MOAT_SHORT_HEIGHT * 0.15)
const SAFE_BOTTOM = Math.round(MOAT_SHORT_HEIGHT * 0.22)
const SAFE_LEFT = 80
const SAFE_RIGHT = Math.round(1080 * 0.15)
const CAPTION_YELLOW = '#FFE14A'
const CAPTION_SIZE = 76
const CAPTION_LINE = 1.05
/** Alle 2 s ein harter Zoom, liegt in der Spanne 1,5–2,5 s. */
const SCHNITT_FRAMES = 60
/** Balken-Feder ist bei Frame 15 angekommen. */
const PILLAR_ZAHL_FRAME = 15

function saubereProps(p: MoatShortProps): MoatShortProps {
  return {
    ...p,
    kicker: ohneKennzahlId(ohneKiBindestrich(p.kicker)),
    hook: ohneKennzahlId(ohneKiBindestrich(p.hook)),
    proof: ohneKennzahlId(ohneKiBindestrich(p.proof)),
    hookLoop: ohneKennzahlId(ohneKiBindestrich(p.hookLoop)),
    business: ohneKennzahlId(ohneKiBindestrich(p.business)),
    crack: ohneKennzahlId(ohneKiBindestrich(p.crack)),
    closing: ohneKennzahlId(ohneKiBindestrich(p.closing)),
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
          value={props.metricValue}
          label={props.metricLabel}
          saeule={props.pillars[0] ?? null}
          proofAb={proof && proof.text.trim() ? proof.from - hook.from : 0}
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
          <Caption text={c.text} woerter={c.woerter} unterZahl={Boolean(proof && p0.from > proof.from && frame >= proof.from && frame < p0.from)} />
        </Sequence>
      ))}

      <Ton
        musicSrc={props.musicSrc}
        musicGain={props.musicGain}
        musicTrim={props.musicTrim ?? 0}
        sfx={props.sfx}
        voiceSrc={props.voiceSrc}
        voiceTrim={timeline.voiceTrimFrames}
        beats={beats}
        sprache={captions.flatMap((c) => c.woerter.map((w) => ({ from: c.from + w.start, to: c.from + w.end })))}
      />
    </AbsoluteFill>
  )
}

function Ton({
  musicSrc,
  musicGain,
  musicTrim,
  sfx,
  voiceSrc,
  voiceTrim,
  beats,
  sprache,
}: {
  musicSrc: string | null
  musicGain: number
  musicTrim: number
  sfx: boolean
  voiceSrc: string | null
  voiceTrim: number
  beats: MoatShortBeat[]
  sprache: { from: number; to: number }[]
}) {
  const crack = beats.find((b) => b.id === 'crack')
  /** SFX leise unter der Stimme. Der erste Frame bleibt ohne Whoosh, damit das erste Wort frei ist. */
  const sfxPegel = 0.21
  const whooshPegel = 0.1
  const cues: { from: number; src: string; volume: number }[] = []
  for (const b of beats) {
    if (b.from > 0 && b.id !== 'proof' && b.id !== 'crack') cues.push({ from: b.from, src: whoosh, volume: whooshPegel })
    if (b.id === 'proof') cues.push({ from: b.from, src: mouseClick, volume: sfxPegel })
    if (b.duration > 75 && b.id !== 'crack') {
      const zoom = b.from + SCHNITT_FRAMES
      if (zoom > 0 && zoom < b.from + b.duration - 8) cues.push({ from: zoom, src: whoosh, volume: whooshPegel * 0.8 })
    }
    if (b.id.startsWith('pillar')) cues.push({ from: b.from + PILLAR_ZAHL_FRAME, src: mouseClick, volume: sfxPegel * 0.7 })
    if (b.id === 'crack') cues.push({ from: b.from, src: shutterOld, volume: 0.48 })
    if (b.id === 'verdict') cues.push({ from: b.from + STEMPEL_AUFPRALL - 1, src: shutterModern, volume: sfxPegel })
  }

  const musikVolume = (f: number) => {
    const crackEnde = crack ? crack.from + crack.duration : 0
    const duck =
      crack && crack.from >= 4
        ? interpolate(f, [crack.from - 4, crack.from + 6, crackEnde - 6, crackEnde + 4], [1, 0.4, 0.4, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        : 1
    // Pause = bisheriger Sprach-Deckel. Während eines Wortes nochmal −13 dB, in den Lücken wieder anheben.
    const pause = voiceSrc ? 0.063 : 0.126
    const spricht = voiceSrc ? (sprache.length ? sprache.some((b) => f >= b.from && f < b.to) : true) : false
    const nah = voiceSrc && sprache.some((b) => f >= b.from - 2 && f < b.to + 2)
    const pegel = spricht ? pause * 10 ** (-13 / 20) : nah ? pause * 10 ** (-6 / 20) : pause
    const relativ = Math.max(0, musicGain) / 0.5
    return Math.max(0, Math.min(1, pegel * relativ * duck))
  }

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
      {voiceSrc ? <Audio src={stimmeAudioSrc(voiceSrc)} volume={1} trimBefore={voiceTrim > 0 ? voiceTrim : undefined} /> : null}
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

function stimmeAudioSrc(src: string): string {
  if (/^(blob:|data:|https?:)/i.test(src) || src.startsWith('/api/')) return src
  return src
}

function musikAudioSrc(src: string): string {
  if (/^(blob:|data:|https?:)/i.test(src) || src.startsWith('/api/')) return src
  const datei = src.split('/').pop() ?? src
  if (typeof window !== 'undefined' && !('remotion_staticBase' in window && window.remotion_staticBase) && datei) {
    return `${window.location.origin}/api/youtube/musik/datei/${encodeURIComponent(datei)}`
  }
  return staticFile(src.replace(/^\/+/, ''))
}

function kamera(frame: number): number {
  const block = Math.floor(frame / SCHNITT_FRAMES)
  const lokal = frame - block * SCHNITT_FRAMES
  const start = block === 0 ? 1 : 1.1
  const ende = block === 0 ? 1.06 : 1.15
  return interpolate(lokal, [0, SCHNITT_FRAMES], [start, ende], { extrapolateRight: 'clamp' })
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
  value,
  label,
  saeule,
  proofAb,
}: {
  kicker: string
  logoUrl: string | null
  value: string
  label: string
  saeule: MoatShortProps['pillars'][number] | null
  /** Frame, ab dem die Zahl als Antwort hart einschlägt. */
  proofAb: number
}) {
  const frame = useCurrentFrame()
  const zahlAn = proofAb <= 0 || frame >= proofAb
  const zahlScale = !zahlAn ? 1 : interpolate(frame - proofAb, [0, 4], [1.12, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const kickerGroesse = kicker.length <= 16 ? 84 : kicker.length <= 24 ? 70 : 56
  const fuell = proofAb > 6 ? Math.min(1, frame / proofAb) : 1
  const balkenFarbe = saeule ? scoreFarbe(saeule.score) : BRAND
  return (
    <AbsoluteFill style={{ transform: `scale(${kamera(frame)})`, transformOrigin: 'center center' }}>
      {logoUrl ? (
        <div
          style={{
            position: 'absolute',
            top: SAFE_TOP + 12,
            left: SAFE_LEFT,
            right: SAFE_RIGHT,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
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
        </div>
      ) : null}
      {!zahlAn ? (
        <div
          style={{
            position: 'absolute',
            top: logoUrl ? SAFE_TOP + 256 : '18%',
            left: SAFE_LEFT,
            right: SAFE_RIGHT,
            textAlign: 'center',
            fontSize: kickerGroesse,
            fontWeight: 900,
            letterSpacing: -1.5,
            lineHeight: 0.98,
          }}
        >
          {kicker}
        </div>
      ) : null}
      {!zahlAn && saeule ? (
        <div style={{ position: 'absolute', top: logoUrl ? SAFE_TOP + 390 : 520, left: SAFE_LEFT, right: SAFE_RIGHT }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
            <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: -0.4 }}>{saeule.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 36, fontWeight: 700, color: balkenFarbe, fontVariantNumeric: 'tabular-nums' }}>
              {saeule.score}
              <span style={{ color: MUTED, fontSize: 22 }}>/10</span>
            </span>
          </div>
          <div style={{ marginTop: 14, height: 18, borderRadius: 9, background: 'rgba(243,241,236,0.09)', overflow: 'hidden' }}>
            <div style={{ width: `${(saeule.score / 10) * fuell * 100}%`, height: '100%', borderRadius: 9, background: balkenFarbe }} />
          </div>
        </div>
      ) : null}
      {zahlAn ? (
        <div
          style={{
            position: 'absolute',
            top: '40%',
            left: SAFE_LEFT,
            right: SAFE_RIGHT,
            textAlign: 'center',
            transform: `scale(${zahlScale})`,
            transformOrigin: 'center top',
          }}
        >
          <div style={{ fontSize: value.length > 7 ? 120 : 148, fontWeight: 900, letterSpacing: -6, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </div>
          <div style={{ marginTop: 14, fontFamily: MONO, fontSize: 26, letterSpacing: 6, color: MUTED, textTransform: 'uppercase' }}>{label}</div>
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
    <AbsoluteFill style={{ transform: `scale(${kamera(lokal)})`, transformOrigin: 'center center' }}>
      <div style={{ position: 'absolute', top: '18%', left: SAFE_LEFT, right: SAFE_RIGHT }}>
        <div style={{ fontFamily: MONO, fontSize: 26, letterSpacing: 7, color: MUTED }}>FOUR PILLARS</div>
        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 24 }}>
          <span style={{ fontSize: 64, fontWeight: 800, letterSpacing: -0.6 }}>{p.label}</span>
          <span style={{ fontFamily: MONO, fontSize: 52, fontWeight: 700, color: farbe, fontVariantNumeric: 'tabular-nums' }}>
            {p.score}
            <span style={{ color: MUTED, fontSize: 28 }}>/10</span>
          </span>
        </div>
        <div style={{ marginTop: 18, height: 16, borderRadius: 8, background: 'rgba(243,241,236,0.09)', overflow: 'hidden' }}>
          <div style={{ width: `${(p.score / 10) * Math.min(1, fuell) * 100}%`, height: '100%', borderRadius: 8, background: farbe }} />
        </div>
        {p.stat ? (
          <div style={{ marginTop: 16, fontFamily: MONO, fontSize: 28, letterSpacing: 1 }}>
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
  const pfad = 'M -20 70 L 150 40 L 260 105 L 400 30 L 520 120 L 660 50 L 780 110 L 900 35 L 1100 90'
  const laenge = 1600
  return (
    <AbsoluteFill style={{ transform: `scale(${kamera(frame)})`, transformOrigin: 'center center' }}>
      <div style={{ position: 'absolute', top: '18%', left: SAFE_LEFT, right: SAFE_RIGHT, textAlign: 'center' }}>
        <div style={{ fontFamily: MONO, fontSize: 28, letterSpacing: 8, color: VERDICT_FARBE.none }}>WHAT COULD BREAK IT</div>
        <div style={{ marginTop: 16, fontSize: 120, fontWeight: 900, letterSpacing: -4, lineHeight: 1 }}>The crack</div>
        <svg width={1080} height={160} viewBox="0 0 1080 160" style={{ position: 'absolute', left: '50%', marginLeft: -540, top: 150 }}>
          <path d={pfad} fill="none" stroke={VERDICT_FARBE.none} strokeWidth={9} strokeLinejoin="miter" strokeDasharray={laenge} strokeDashoffset={laenge * (1 - zeichnen)} />
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
    <AbsoluteFill style={{ opacity: 1 - fadeOut, transform: `scale(${kamera(frame)}) translate(${wackeln}px, ${wackeln * 0.4}px)`, transformOrigin: 'center center' }}>
      <div style={{ position: 'absolute', top: '20%', left: SAFE_LEFT, right: SAFE_RIGHT, textAlign: 'center' }}>
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

function Caption({ text, woerter, unterZahl }: { text: string; woerter: { text: string; start: number; end: number }[]; unterZahl: boolean }) {
  const frame = useCurrentFrame()
  const aktiv = aktivesWort(woerter, frame)
  return (
    <div
      style={{
        position: 'absolute',
        top: Math.min(unterZahl ? MOAT_SHORT_HEIGHT * 0.56 : MOAT_SHORT_HEIGHT * 0.46, MOAT_SHORT_HEIGHT - SAFE_BOTTOM - 160),
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
          <Wortzeile
            text={text}
            farbeFuer={(_w, i) => (i === aktiv ? CAPTION_YELLOW : TEXT)}
            gewichtFuer={(_w, i) => (i === aktiv ? 900 : 700)}
          />
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

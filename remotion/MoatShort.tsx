import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadInterTight } from '@remotion/google-fonts/InterTight'
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono'
import { Audio } from '@remotion/media'
import { mouseClick, shutterModern, uiSwitch, whip, whoosh } from '@remotion/sfx'
import { useMemo, useState } from 'react'
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
import { ohneKiBindestrich } from '../lib/youtube/moat-short-script'
import { logoPlaySrc } from '../lib/youtube/moat-short-media-src'
import { berechneMoatShortTimeline, MOAT_SHORT_LOOP_FRAMES } from './moat-short-timeline'
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
/** YouTube-UI: oben Suche, unten Titel/Abo, rechts Buttons. */
const SAFE_TOP = 300
const SAFE_LEFT = 72
const SAFE_RIGHT = 200
/** YouTube-UI unten. Hero-Szenen füllen die Fläche darüber. */
const SAFE_BOTTOM = 360
/** Untertitel im unteren Drittel, unter der großen Zahl, über der YouTube-Leiste. */
const CAPTION_TOP = 1200
/** Gleicher Rand links und rechts, sonst hängt Schrift und Pill optisch links. */
const CONTENT_SIDE = 88
const CAPTION_SIDE = 88
const PILLAR_BOTTOM_PAD = MOAT_SHORT_HEIGHT - (CAPTION_TOP - 32)
const CAPTION_YELLOW = '#FFC700'
const CAPTION_SIZE = 58
const CAPTION_LINE = 1.25
/** Ab Frame 2, damit der Loop-Join auf der fertigen Zahl steht. Landung bei 0,4 s. */
const HOOK_ZAHL_AB = 2
const HOOK_ZAHL_FRAME = 12
/** Balken-Feder ist bei Frame 15 angekommen. */
const PILLAR_ZAHL_FRAME = 15

function saubereProps(p: MoatShortProps): MoatShortProps {
  return {
    ...p,
    hook: ohneKiBindestrich(p.hook),
    hookLoop: ohneKiBindestrich(p.hookLoop),
    business: ohneKiBindestrich(p.business),
    crack: ohneKiBindestrich(p.crack),
    closing: ohneKiBindestrich(p.closing),
    pillars: p.pillars.map((x) => ({ ...x, line: ohneKiBindestrich(x.line) })),
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
  const teaser = beats.find((b) => b.id === 'teaser')
  const business = beat(beats, 'business')
  const p0 = beat(beats, 'pillar0')
  const p3 = beat(beats, 'pillar3')
  const crack = beat(beats, 'crack')
  const verdict = beat(beats, 'verdict')
  const loop = beats.find((b) => b.id === 'loop')
  const crackEnde = crack.from + crack.duration
  const loopFrom = loop?.from ?? durationInFrames - MOAT_SHORT_LOOP_FRAMES
  const loopDauer = loop?.duration ?? MOAT_SHORT_LOOP_FRAMES
  const loopBlend = interpolate(frame, [loopFrom, loopFrom + 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

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
      <Sequence from={hook.from} durationInFrames={hook.duration + (teaser?.duration ?? 0)} layout="none">
        <HookSzene headline={props.hook} value={props.metricValue} label={props.metricLabel} teaserAb={teaser ? teaser.from - hook.from : null} />
      </Sequence>
      <Sequence from={business.from} durationInFrames={business.duration} layout="none">
        <BusinessSzene ticker={props.ticker} name={props.firmenname} logoUrl={props.logoUrl} />
      </Sequence>
      <Sequence from={p0.from} durationInFrames={p3.from + p3.duration - p0.from} layout="none">
        <PillarSzene pillars={props.pillars} starts={[0, 1, 2, 3].map((i) => beat(beats, `pillar${i}` as MoatShortBeat['id']).from - p0.from)} />
      </Sequence>
      <Sequence from={crack.from} durationInFrames={crack.duration} layout="none">
        <CrackSzene />
      </Sequence>
      <Sequence from={verdict.from} durationInFrames={verdict.duration + loopDauer} layout="none">
        <VerdictSzene verdict={props.verdict} score={props.score} fadeOut={loopBlend} />
      </Sequence>
      <Sequence from={loopFrom} durationInFrames={loopDauer} layout="none">
        <AbsoluteFill style={{ opacity: loopBlend }}>
          <HookSzene headline={props.hook} value={props.metricValue} label={props.metricLabel} teaserAb={null} ruhe />
        </AbsoluteFill>
      </Sequence>

      <Kopfzeile
        ticker={props.ticker}
        logoUrl={props.logoUrl}
        fortschritt={frame / Math.max(1, durationInFrames - 1)}
        balkenSichtbar={frame > 3 && frame < durationInFrames - 12}
      />
      <Koernung />

      {captions.map((c, i) => (
        <Sequence key={i} from={c.from} durationInFrames={c.duration} layout="none">
          <Caption text={c.text} />
        </Sequence>
      ))}

      <Ton
        musicSrc={props.musicSrc}
        musicGain={props.musicGain}
        musicTrim={props.musicTrim ?? 0}
        sfx={props.sfx}
        beats={beats}
      />
    </AbsoluteFill>
  )
}

function Ton({
  musicSrc,
  musicGain,
  musicTrim,
  sfx,
  beats,
}: {
  musicSrc: string | null
  musicGain: number
  musicTrim: number
  sfx: boolean
  beats: MoatShortBeat[]
}) {
  const crack = beats.find((b) => b.id === 'crack')
  const cues: { from: number; src: string; volume: number }[] = []
  for (const b of beats) {
    if (b.id === 'hook') cues.push({ from: b.from + HOOK_ZAHL_FRAME, src: mouseClick, volume: 0.34 })
    if (b.id === 'business') cues.push({ from: Math.max(0, b.from - 4), src: whoosh, volume: 0.28 })
    if (b.id.startsWith('pillar')) {
      cues.push({ from: b.from, src: uiSwitch, volume: 0.22 })
      cues.push({ from: b.from + PILLAR_ZAHL_FRAME, src: mouseClick, volume: 0.2 })
    }
    if (b.id === 'crack') cues.push({ from: b.from + 2, src: whip, volume: 0.4 })
    if (b.id === 'verdict') cues.push({ from: b.from + STEMPEL_AUFPRALL - 1, src: shutterModern, volume: 1 })
  }

  const musikVolume = (f: number) => {
    const crackEnde = crack ? crack.from + crack.duration : 0
    const duck =
      crack && crack.from >= 4
        ? interpolate(f, [crack.from - 4, crack.from + 6, crackEnde - 6, crackEnde + 4], [1, 0.35, 0.35, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        : 1
    return Math.max(0, Math.min(1, musicGain)) * duck
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
      {sfx
        ? cues.map((c, i) => (
            <Sequence key={i} from={c.from} durationInFrames={60} layout="none">
              <Audio src={c.src} volume={c.volume} />
            </Sequence>
          ))
        : null}
    </>
  )
}

function logoSrc(url: string): string {
  const play = logoPlaySrc(url)
  if (play && (play.startsWith('http') || play.startsWith('/api/'))) return play
  return staticFile((play ?? url).replace(/^\/+/, ''))
}

function musikAudioSrc(src: string): string {
  if (/^https?:\/\//i.test(src) || src.startsWith('/api/')) return src
  const datei = src.split('/').pop() ?? src
  if (typeof window !== 'undefined' && !('remotion_staticBase' in window && window.remotion_staticBase) && datei) {
    return `${window.location.origin}/api/youtube/musik/datei/${encodeURIComponent(datei)}`
  }
  return staticFile(src.replace(/^\/+/, ''))
}

function Kopfzeile({
  ticker,
  logoUrl,
  fortschritt,
  balkenSichtbar,
}: {
  ticker: string
  logoUrl: string | null
  fortschritt: number
  balkenSichtbar: boolean
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
      <div style={{ marginTop: 26, height: 3, background: 'rgba(243,241,236,0.1)', borderRadius: 2, opacity: balkenSichtbar ? 1 : 0 }}>
        <div style={{ width: `${Math.min(0.92, fortschritt) * 100}%`, height: '100%', background: BRAND, borderRadius: 2 }} />
      </div>
    </div>
  )
}

/** Zählt die Ziffern hoch, Präfix/Suffix bleiben stehen — am Ende exakt der Originalstring. */
function zaehleHoch(value: string, t: number): string {
  if (t >= 1) return value
  const m = /^(.*?)(-?\d+(?:\.\d+)?)(.*)$/.exec(value)
  if (!m) return value
  const nachkomma = (m[2]!.split('.')[1] ?? '').length
  return `${m[1]}${(Number(m[2]) * t).toFixed(nachkomma)}${m[3]}`
}

function HookSzene({
  headline,
  value,
  label,
  teaserAb,
  ruhe,
}: {
  headline: string
  value: string
  label: string
  teaserAb: number | null
  ruhe?: boolean
}) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const amJoin = ruhe || frame < HOOK_ZAHL_AB
  const pop = amJoin
    ? 1
    : spring({ frame: frame - HOOK_ZAHL_AB, fps, config: { damping: 10, mass: 0.35, stiffness: 240 }, durationInFrames: 14 })
  const zahlT = amJoin
    ? 1
    : interpolate(frame, [HOOK_ZAHL_AB, HOOK_ZAHL_FRAME], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      })
  const schub = amJoin ? 1 : interpolate(frame, [2, durationInFrames], [1, 1.04], { easing: Easing.out(Easing.quad), extrapolateRight: 'clamp' })
  const teaser = teaserAb == null || ruhe ? 0 : interpolate(frame, [teaserAb, teaserAb + 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const headlineGroesse = headline.length <= 55 ? 78 : headline.length <= 85 ? 66 : 56
  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${SAFE_TOP + 40}px ${CONTENT_SIDE}px ${SAFE_BOTTOM}px ${CONTENT_SIDE}px`,
        boxSizing: 'border-box',
        transform: `scale(${schub})`,
        transformOrigin: 'center center',
      }}
    >
      <div
        style={{
          width: '100%',
          boxSizing: 'border-box',
          fontSize: headlineGroesse,
          fontWeight: 800,
          letterSpacing: -0.4,
          wordSpacing: '0.06em',
          lineHeight: 1.12,
          textAlign: 'center',
          opacity: 1 - 0.6 * teaser,
        }}
      >
        <Wortzeile text={headline} farbeFuer={(w) => (/\d/.test(w) ? BRAND : TEXT)} />
      </div>
      <div style={{ width: '100%', marginTop: 90, textAlign: 'center', transform: `scale(${amJoin ? 1 : 1 + (1 - pop) * 0.2})` }}>
        <div style={{ fontSize: value.length > 7 ? 180 : 230, fontWeight: 900, letterSpacing: -8, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {zaehleHoch(value, zahlT)}
        </div>
        <div style={{ marginTop: 30, fontFamily: MONO, fontSize: 32, letterSpacing: 7, color: MUTED, textTransform: 'uppercase' }}>{label}</div>
      </div>
    </AbsoluteFill>
  )
}

function BusinessSzene({ ticker, name, logoUrl }: { ticker: string; name: string; logoUrl: string | null }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const [logoKaputt, setLogoKaputt] = useState(false)
  const tile = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 12 })
  const text = spring({ frame: frame - 4, fps, config: { damping: 200 }, durationInFrames: 12 })
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingTop: SAFE_TOP, paddingBottom: SAFE_BOTTOM }}>
      <div
        style={{
          width: 340,
          height: 340,
          borderRadius: 72,
          background: logoUrl && !logoKaputt ? '#FFFFFF' : BRAND,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: tile,
          transform: `translateY(${interpolate(tile, [0, 1], [40, 0])}px)`,
          boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
          overflow: 'hidden',
        }}
      >
        {logoUrl && !logoKaputt ? (
          <Img
            src={logoSrc(logoUrl)}
            onError={() => setLogoKaputt(true)}
            style={{ width: 250, height: 250, objectFit: 'contain' }}
          />
        ) : (
          <span style={{ fontSize: Math.min(100, Math.floor(300 / Math.max(1, ticker.length))), fontWeight: 900, color: BG, letterSpacing: -2 }}>{ticker}</span>
        )}
      </div>
      <div style={{ marginTop: 56, textAlign: 'center', opacity: text, transform: `translateY(${interpolate(text, [0, 1], [24, 0])}px)` }}>
        <div style={{ fontSize: name.length > 22 ? 70 : 88, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05, maxWidth: 900 }}>{name}</div>
        <div style={{ marginTop: 18, fontFamily: MONO, fontSize: 32, letterSpacing: 6, color: MUTED }}>WHAT THEY SELL</div>
      </div>
    </AbsoluteFill>
  )
}

function PillarSzene({ pillars, starts }: { pillars: MoatShortProps['pillars']; starts: number[] }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const aktiv = starts.reduce((a, s, i) => (frame >= s ? i : a), 0)
  const eintritt = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 10 })
  const mitStats = pillars.some((p) => p.stat)
  return (
    <AbsoluteFill style={{ padding: `${SAFE_TOP + 130}px ${CONTENT_SIDE}px ${PILLAR_BOTTOM_PAD}px ${CONTENT_SIDE}px`, opacity: eintritt }}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontFamily: MONO, fontSize: 28, letterSpacing: 7, color: MUTED, marginBottom: mitStats ? 18 : 22, flexShrink: 0 }}>
          FOUR PILLARS
        </div>
        {pillars.slice(0, 4).map((p, i) => {
          const lokal = frame - (starts[i] ?? 0)
          const fuell = spring({ frame: lokal, fps, config: { damping: 22, mass: 0.7 }, durationInFrames: 18 })
          const gestartet = lokal >= 0
          const opacity = !gestartet ? 0.22 : i === aktiv ? 1 : 0.5
          const farbe = scoreFarbe(p.score)
          const anzeige = gestartet ? Math.round(p.score * Math.min(1, fuell)) : 0
          const atem = spring({
            frame: Math.max(0, lokal - PILLAR_ZAHL_FRAME),
            fps,
            config: { damping: 200 },
            durationInFrames: 40,
          })
          const scale = lokal >= PILLAR_ZAHL_FRAME ? 1 + 0.02 * atem : 1
          return (
            <div
              key={p.id}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                minHeight: 0,
                opacity,
                transform: `scale(${scale})`,
                transformOrigin: 'center center',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 50, fontWeight: 800, letterSpacing: -0.4 }}>{p.label}</span>
                <span style={{ fontFamily: MONO, fontSize: 40, fontWeight: 700, color: gestartet ? farbe : MUTED, fontVariantNumeric: 'tabular-nums' }}>
                  {anzeige}
                  <span style={{ color: MUTED, fontSize: 26 }}>/10</span>
                </span>
              </div>
              <div style={{ marginTop: 12, height: 14, borderRadius: 7, background: 'rgba(243,241,236,0.09)', overflow: 'hidden' }}>
                <div style={{ width: `${gestartet ? (p.score / 10) * fuell * 100 : 0}%`, height: '100%', borderRadius: 7, background: farbe }} />
              </div>
              {mitStats ? (
                <div
                  style={{
                    marginTop: 8,
                    height: 26,
                    fontFamily: MONO,
                    fontSize: 24,
                    letterSpacing: 1,
                    opacity: p.stat && gestartet ? interpolate(lokal, [6, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0,
                  }}
                >
                  <span style={{ color: farbe, fontWeight: 700 }}>{p.stat?.value}</span>
                  <span style={{ color: MUTED }}> · {p.stat?.label}</span>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

function CrackSzene() {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const zeichnen = interpolate(frame, [2, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const zurueck = interpolate(frame, [0, durationInFrames], [1.07, 1], { easing: Easing.out(Easing.quad), extrapolateRight: 'clamp' })
  const pfad = 'M -20 70 L 150 40 L 260 105 L 400 30 L 520 120 L 660 50 L 780 110 L 900 35 L 1100 90'
  const laenge = 1600
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingTop: SAFE_TOP, paddingBottom: SAFE_BOTTOM, transform: `scale(${zurueck})` }}>
      <div style={{ fontFamily: MONO, fontSize: 32, letterSpacing: 8, color: VERDICT_FARBE.none, opacity: interpolate(frame, [0, 5], [0, 1], { extrapolateRight: 'clamp' }) }}>
        WHAT COULD BREAK IT
      </div>
      <div style={{ position: 'relative', marginTop: 30 }}>
        <div style={{ fontSize: 200, fontWeight: 900, letterSpacing: -8, lineHeight: 1 }}>The crack</div>
        <svg width={1080} height={160} viewBox="0 0 1080 160" style={{ position: 'absolute', left: -150, top: 30 }}>
          <path d={pfad} fill="none" stroke={VERDICT_FARBE.none} strokeWidth={9} strokeLinejoin="miter" strokeDasharray={laenge} strokeDashoffset={laenge * (1 - zeichnen)} />
        </svg>
      </div>
    </AbsoluteFill>
  )
}

function VerdictSzene({ verdict, score, fadeOut }: { verdict: MoatShortVerdict; score: number; fadeOut: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const stempel = spring({ frame: frame - 3, fps, config: { damping: 11, mass: 0.6, stiffness: 180 } })
  const aufprall = Math.max(0, 1 - Math.abs(frame - STEMPEL_AUFPRALL) / 4)
  const wackeln = fadeOut > 0.2 ? 0 : aufprall * Math.sin(frame * 2.3) * 7
  const farbe = VERDICT_FARBE[verdict]
  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: SAFE_TOP,
        paddingBottom: SAFE_BOTTOM,
        opacity: 1 - fadeOut,
        transform: `translate(${wackeln}px, ${wackeln * 0.6}px)`,
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 32, letterSpacing: 8, color: MUTED, opacity: interpolate(frame, [0, 4], [0, 1], { extrapolateRight: 'clamp' }) }}>
        VERDICT
      </div>
      <div
        style={{
          marginTop: 44,
          padding: '34px 56px',
          border: `10px solid ${farbe}`,
          borderRadius: 30,
          color: farbe,
          fontSize: 124,
          fontWeight: 900,
          letterSpacing: -3,
          textTransform: 'uppercase',
          lineHeight: 1,
          opacity: Math.min(1, stempel * 1.4),
          transform: `rotate(-5deg) scale(${interpolate(stempel, [0, 1], [1.8, 1])})`,
        }}
      >
        {VERDICT_LABEL[verdict]}
      </div>
      <div style={{ marginTop: 60, fontFamily: MONO, fontSize: 60, fontWeight: 700, fontVariantNumeric: 'tabular-nums', opacity: interpolate(frame, [10, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
        {score.toFixed(1)}
        <span style={{ color: MUTED, fontSize: 38 }}> / 10</span>
      </div>
    </AbsoluteFill>
  )
}

function gesprochnesWortIndex(text: string, frame: number, dauer: number): number {
  const woerter = text.trim().split(/\s+/).filter(Boolean)
  if (!woerter.length) return 0
  const progress = frame / Math.max(1, dauer)
  return Math.min(woerter.length - 1, Math.floor(progress * woerter.length))
}

function Caption({ text }: { text: string }) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const rein = interpolate(frame, [0, 3], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const punch = spring({ frame, fps, config: { damping: 14, mass: 0.55, stiffness: 180 } })
  const aktiv = gesprochnesWortIndex(text, frame, durationInFrames)
  return (
    <div
      style={{
        position: 'absolute',
        top: CAPTION_TOP,
        left: 0,
        right: 0,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        pointerEvents: 'none',
        paddingLeft: CAPTION_SIDE,
        paddingRight: CAPTION_SIDE,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'inline-block',
          marginLeft: 'auto',
          marginRight: 'auto',
          maxWidth: '100%',
          textAlign: 'center',
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          padding: '16px 28px 28px',
          borderRadius: 16,
          overflow: 'visible',
          opacity: rein,
          transform: `translateY(${interpolate(rein, [0, 1], [16, 0])}px) scale(${interpolate(punch, [0, 1], [1.08, 1])})`,
        }}
      >
        <span
          style={{
            display: 'block',
            width: '100%',
            fontFamily: SANS,
            fontSize: CAPTION_SIZE,
            fontWeight: 700,
            letterSpacing: 0,
            lineHeight: CAPTION_LINE,
            textAlign: 'center',
          }}
        >
          <Wortzeile text={text} farbeFuer={(_w, i) => (i === aktiv ? CAPTION_YELLOW : TEXT)} gewichtFuer={() => 700} />
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

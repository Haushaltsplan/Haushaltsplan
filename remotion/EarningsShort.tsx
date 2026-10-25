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
import { ohneKennzahlId, ohneKiBindestrich } from '../lib/youtube/moat-short-script'
import { logoPlaySrc } from '../lib/youtube/moat-short-media-src'
import { berechneEarningsShortTimeline, EARNINGS_SHORT_LOOP_FRAMES } from './earnings-short-timeline'
import { type EarningsShortBeat, type EarningsShortBeatArt, type EarningsShortKarte, type EarningsShortProps } from './earnings-short-types'
import {
  SHORT_BG,
  SHORT_BG_CRACK,
  SHORT_BRAND,
  SHORT_CAPTION_LINE,
  SHORT_CAPTION_SIDE,
  SHORT_CAPTION_SIZE,
  SHORT_CAPTION_TOP,
  SHORT_CAPTION_YELLOW,
  SHORT_CONTENT_SIDE,
  SHORT_CRACK_DUCK,
  SHORT_DISPLAY,
  SHORT_GRUEN,
  SHORT_HOOK_ZAHL_AB,
  SHORT_HOOK_ZAHL_FRAME,
  SHORT_MONO,
  SHORT_MUSIK_MIT_STIMME,
  SHORT_MUSIK_OHNE_STIMME,
  SHORT_MUTED,
  SHORT_ROT,
  SHORT_SAFE_BOTTOM,
  SHORT_SAFE_LEFT,
  SHORT_SAFE_RIGHT,
  SHORT_SAFE_TOP,
  SHORT_SANS,
  SHORT_SFX_PEGEL,
  SHORT_STEMPEL_AUFPRALL,
  SHORT_TEXT,
} from './short-look'

const BEAT_FARBE: Record<EarningsShortBeatArt, string> = { beat: SHORT_GRUEN, miss: SHORT_ROT, inline: SHORT_BRAND }
const BEAT_LABEL: Record<EarningsShortBeatArt, string> = { beat: 'Beat', miss: 'Miss', inline: 'Inline' }

function saubereProps(p: EarningsShortProps): EarningsShortProps {
  return {
    ...p,
    hook: ohneKennzahlId(ohneKiBindestrich(p.hook)),
    numbers: ohneKennzahlId(ohneKiBindestrich(p.numbers)),
    call0: ohneKennzahlId(ohneKiBindestrich(p.call0)),
    call1: ohneKennzahlId(ohneKiBindestrich(p.call1)),
    filing: ohneKennzahlId(ohneKiBindestrich(p.filing)),
    takeaway: ohneKennzahlId(ohneKiBindestrich(p.takeaway)),
  }
}

function beat(beats: EarningsShortBeat[], id: EarningsShortBeat['id']): EarningsShortBeat {
  return beats.find((b) => b.id === id) ?? { id, text: '', from: 0, duration: 1 }
}

export const EarningsShort: React.FC<EarningsShortProps> = (roh) => {
  const props = saubereProps(roh)
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const { beats, captions } = useMemo(() => berechneEarningsShortTimeline(props), [props])
  const hook = beat(beats, 'hook')
  const numbers = beat(beats, 'numbers')
  const call0 = beat(beats, 'call0')
  const call1 = beat(beats, 'call1')
  const filing = beat(beats, 'filing')
  const takeaway = beat(beats, 'takeaway')
  const loop = beats.find((b) => b.id === 'loop')
  const loopFrom = loop?.from ?? durationInFrames - EARNINGS_SHORT_LOOP_FRAMES
  const loopDauer = loop?.duration ?? EARNINGS_SHORT_LOOP_FRAMES
  const loopBlend = interpolate(frame, [loopFrom, loopFrom + 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const callStart = call0.from
  const filingEnde = filing.from + filing.duration
  const bg =
    callStart > 0
      ? interpolateColors(frame, [callStart, callStart + 6, filingEnde - 4, filingEnde], [SHORT_BG, SHORT_BG_CRACK, SHORT_BG_CRACK, SHORT_BG])
      : SHORT_BG

  return (
    <AbsoluteFill style={{ backgroundColor: bg, color: SHORT_TEXT, fontFamily: SHORT_DISPLAY }}>
      <Sequence from={hook.from} durationInFrames={hook.duration} layout="none">
        <HookSzene headline={props.hook} value={props.metricValue} label={props.metricLabel} />
      </Sequence>
      <Sequence from={numbers.from} durationInFrames={numbers.duration} layout="none">
        <ZahlenSzene eps={props.eps} umsatz={props.umsatz} quartal={props.quartalLabel} />
      </Sequence>
      <Sequence from={call0.from} durationInFrames={call0.duration} layout="none">
        <ThemaSzene kicker="THE CALL" titel="What they said" />
      </Sequence>
      <Sequence from={call1.from} durationInFrames={call1.duration} layout="none">
        <ThemaSzene kicker="THE CALL" titel="The other tell" />
      </Sequence>
      <Sequence from={filing.from} durationInFrames={filing.duration} layout="none">
        <ThemaSzene kicker="THE FILING" titel="In the report" />
      </Sequence>
      <Sequence from={takeaway.from} durationInFrames={takeaway.duration + loopDauer} layout="none">
        <StempelSzene art={props.beat} quartal={props.quartalLabel} fadeOut={loopBlend} />
      </Sequence>
      <Sequence from={loopFrom} durationInFrames={loopDauer} layout="none">
        <AbsoluteFill style={{ opacity: loopBlend }}>
          <HookSzene headline={props.hook} value={props.metricValue} label={props.metricLabel} ruhe />
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
        voiceSrc={props.voiceSrc}
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
  voiceSrc,
  beats,
}: {
  musicSrc: string | null
  musicGain: number
  musicTrim: number
  sfx: boolean
  voiceSrc: string | null
  beats: EarningsShortBeat[]
}) {
  const call0 = beats.find((b) => b.id === 'call0')
  const filing = beats.find((b) => b.id === 'filing')
  const cues: { from: number; src: string; volume: number }[] = []
  for (const b of beats) {
    if (b.id === 'hook') cues.push({ from: b.from + SHORT_HOOK_ZAHL_FRAME, src: mouseClick, volume: SHORT_SFX_PEGEL })
    if (b.id === 'numbers') cues.push({ from: Math.max(0, b.from - 4), src: whoosh, volume: SHORT_SFX_PEGEL })
    if (b.id === 'call0' || b.id === 'call1') cues.push({ from: b.from, src: uiSwitch, volume: SHORT_SFX_PEGEL })
    if (b.id === 'filing') cues.push({ from: b.from + 2, src: whip, volume: SHORT_SFX_PEGEL })
    if (b.id === 'takeaway') cues.push({ from: b.from + SHORT_STEMPEL_AUFPRALL - 1, src: shutterModern, volume: SHORT_SFX_PEGEL })
  }

  const musikVolume = (f: number) => {
    const duckStart = call0?.from ?? 0
    const duckEnde = filing ? filing.from + filing.duration : 0
    const duck =
      call0 && duckStart >= 4
        ? interpolate(f, [duckStart - 4, duckStart + 6, duckEnde - 6, duckEnde + 4], [1, SHORT_CRACK_DUCK, SHORT_CRACK_DUCK, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        : 1
    const deckel = voiceSrc ? SHORT_MUSIK_MIT_STIMME : SHORT_MUSIK_OHNE_STIMME
    const relativ = Math.max(0, musicGain) / 0.5
    return Math.max(0, Math.min(1, deckel * relativ * duck))
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
      {voiceSrc ? <Audio src={stimmeAudioSrc(voiceSrc)} volume={1} /> : null}
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

function Wortzeile({
  text,
  farbeFuer,
  gewichtFuer,
}: {
  text: string
  farbeFuer?: (wort: string, i: number) => string
  gewichtFuer?: (wort: string, i: number) => number
}) {
  const teile = text.trim().split(/\s+/).filter(Boolean)
  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '0.28em', rowGap: 0, lineHeight: SHORT_CAPTION_LINE }}>
      {teile.map((w, i) => (
        <span key={i} style={{ color: farbeFuer?.(w, i), fontWeight: gewichtFuer?.(w, i), lineHeight: SHORT_CAPTION_LINE, paddingBottom: 8 }}>
          {w}
        </span>
      ))}
    </span>
  )
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
    <div style={{ position: 'absolute', top: SHORT_SAFE_TOP, left: SHORT_SAFE_LEFT, right: SHORT_SAFE_RIGHT }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: SHORT_MONO, fontSize: 28, letterSpacing: 6, fontWeight: 700 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ width: 14, height: 14, borderRadius: 7, background: SHORT_BRAND }} />
          EARNINGS CHECK
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 14, color: SHORT_MUTED }}>
          {logoUrl ? (
            <Img src={logoSrc(logoUrl)} style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 10, background: '#FFFFFF', padding: 4 }} />
          ) : null}
          ${ticker}
        </span>
      </div>
      <div style={{ marginTop: 26, height: 3, background: 'rgba(243,241,236,0.1)', borderRadius: 2, opacity: balkenSichtbar ? 1 : 0 }}>
        <div style={{ width: `${Math.min(0.92, fortschritt) * 100}%`, height: '100%', background: SHORT_BRAND, borderRadius: 2 }} />
      </div>
    </div>
  )
}

function zaehleHoch(value: string, schritt: number, schritte: number): string {
  if (schritt >= schritte) return value
  const m = /^(.*?)(-?\d+(?:\.\d+)?)(.*)$/.exec(value)
  if (!m) return value
  const raw = m[2]!
  const nachkomma = (raw.split('.')[1] ?? '').length
  const faktor = 10 ** nachkomma
  const ziel = Math.round(Number(raw) * faktor)
  const aktuell = Math.round((ziel * Math.max(0, schritt)) / schritte)
  return `${m[1]}${(aktuell / faktor).toFixed(nachkomma)}${m[3]}`
}

function GezaehlteZahl({ value, schritt, schritte }: { value: string; schritt: number; schritte: number }) {
  const gezeigt = zaehleHoch(value, schritt, schritte)
  const ziel = /^(.*?)(-?\d+(?:\.\d+)?)(.*)$/.exec(value)
  const ist = /^(.*?)(-?\d+(?:\.\d+)?)(.*)$/.exec(gezeigt)
  if (!ziel || !ist) return <>{gezeigt}</>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', justifyContent: 'center', fontVariantNumeric: 'tabular-nums' }}>
      {ziel[1] ? <span>{ziel[1]}</span> : null}
      <span style={{ position: 'relative', display: 'inline-block' }}>
        <span style={{ visibility: 'hidden' }}>{ziel[2]}</span>
        <span style={{ position: 'absolute', right: 0, top: 0 }}>{ist[2]}</span>
      </span>
      {ziel[3] ? <span>{ziel[3]}</span> : null}
    </span>
  )
}

function HookSzene({
  headline,
  value,
  label,
  ruhe,
}: {
  headline: string
  value: string
  label: string
  ruhe?: boolean
}) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const amJoin = ruhe || frame < SHORT_HOOK_ZAHL_AB
  const pop = amJoin
    ? 1
    : spring({ frame: frame - SHORT_HOOK_ZAHL_AB, fps, config: { damping: 10, mass: 0.35, stiffness: 240 }, durationInFrames: 14 })
  const zahlSchritte = SHORT_HOOK_ZAHL_FRAME - SHORT_HOOK_ZAHL_AB
  const zahlSchritt = amJoin ? zahlSchritte : Math.max(0, Math.min(zahlSchritte, frame - SHORT_HOOK_ZAHL_AB))
  const schub = amJoin ? 1 : interpolate(frame, [2, durationInFrames], [1, 1.04], { easing: Easing.out(Easing.quad), extrapolateRight: 'clamp' })
  const headlineGroesse = headline.length <= 55 ? 78 : headline.length <= 85 ? 66 : 56
  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${SHORT_SAFE_TOP + 40}px ${SHORT_CONTENT_SIDE}px ${SHORT_SAFE_BOTTOM}px ${SHORT_CONTENT_SIDE}px`,
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
        }}
      >
        <Wortzeile text={headline} farbeFuer={(w) => (/\d/.test(w) ? SHORT_BRAND : SHORT_TEXT)} />
      </div>
      <div style={{ width: '100%', marginTop: 90, textAlign: 'center', transform: `scale(${amJoin ? 1 : 1 + (1 - pop) * 0.2})` }}>
        <div style={{ fontSize: value.length > 7 ? 180 : 230, fontWeight: 900, letterSpacing: -8, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          <GezaehlteZahl value={value} schritt={zahlSchritt} schritte={zahlSchritte} />
        </div>
        <div style={{ marginTop: 30, fontFamily: SHORT_MONO, fontSize: 32, letterSpacing: 7, color: SHORT_MUTED, textTransform: 'uppercase' }}>{label}</div>
      </div>
    </AbsoluteFill>
  )
}

function ZahlenSzene({ eps, umsatz, quartal }: { eps: EarningsShortKarte; umsatz: EarningsShortKarte; quartal: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const tile = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 12 })
  const text = spring({ frame: frame - 4, fps, config: { damping: 200 }, durationInFrames: 12 })
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingTop: SHORT_SAFE_TOP, paddingBottom: SHORT_SAFE_BOTTOM }}>
      <div style={{ fontFamily: SHORT_MONO, fontSize: 28, letterSpacing: 7, color: SHORT_MUTED, opacity: text }}>{quartal.toUpperCase()}</div>
      <div style={{ marginTop: 48, width: 900, display: 'flex', flexDirection: 'column', gap: 36, opacity: tile, transform: `translateY(${interpolate(tile, [0, 1], [40, 0])}px)` }}>
        <ZahlKarte karte={eps} />
        <ZahlKarte karte={umsatz} />
      </div>
    </AbsoluteFill>
  )
}

function ZahlKarte({ karte }: { karte: EarningsShortKarte }) {
  return (
    <div
      style={{
        padding: '36px 44px',
        borderRadius: 28,
        background: 'rgba(243,241,236,0.05)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
      }}
    >
      <div style={{ fontFamily: SHORT_MONO, fontSize: 26, letterSpacing: 5, color: SHORT_MUTED }}>{karte.label.toUpperCase()}</div>
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 92, fontWeight: 900, letterSpacing: -3, fontVariantNumeric: 'tabular-nums' }}>{karte.ist}</span>
        <span style={{ fontFamily: SHORT_MONO, fontSize: 28, color: SHORT_MUTED }}>vs {karte.schaetzung}</span>
      </div>
      <div style={{ marginTop: 8, fontFamily: SHORT_MONO, fontSize: 28, letterSpacing: 2, color: SHORT_BRAND }}>{karte.anzeige}</div>
    </div>
  )
}

function ThemaSzene({ kicker, titel }: { kicker: string; titel: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const eintritt = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 10 })
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingTop: SHORT_SAFE_TOP, paddingBottom: SHORT_SAFE_BOTTOM, opacity: eintritt }}>
      <div style={{ fontFamily: SHORT_MONO, fontSize: 32, letterSpacing: 8, color: SHORT_BRAND }}>{kicker}</div>
      <div style={{ marginTop: 36, fontSize: titel.length > 18 ? 88 : 120, fontWeight: 900, letterSpacing: -4, lineHeight: 1, textAlign: 'center', maxWidth: 900 }}>
        {titel}
      </div>
    </AbsoluteFill>
  )
}

function StempelSzene({ art, quartal, fadeOut }: { art: EarningsShortBeatArt; quartal: string; fadeOut: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const stempel = spring({ frame: frame - 3, fps, config: { damping: 11, mass: 0.6, stiffness: 180 } })
  const aufprall = Math.max(0, 1 - Math.abs(frame - SHORT_STEMPEL_AUFPRALL) / 4)
  const wackeln = fadeOut > 0.2 ? 0 : aufprall * Math.sin(frame * 2.3) * 7
  const farbe = BEAT_FARBE[art]
  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: SHORT_SAFE_TOP,
        paddingBottom: SHORT_SAFE_BOTTOM,
        opacity: 1 - fadeOut,
        transform: `translate(${wackeln}px, ${wackeln * 0.6}px)`,
      }}
    >
      <div style={{ fontFamily: SHORT_MONO, fontSize: 32, letterSpacing: 8, color: SHORT_MUTED, opacity: interpolate(frame, [0, 4], [0, 1], { extrapolateRight: 'clamp' }) }}>
        {quartal.toUpperCase()}
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
        {BEAT_LABEL[art]}
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
        top: SHORT_CAPTION_TOP,
        left: 0,
        right: 0,
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        pointerEvents: 'none',
        paddingLeft: SHORT_CAPTION_SIDE,
        paddingRight: SHORT_CAPTION_SIDE,
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
            fontFamily: SHORT_SANS,
            fontSize: SHORT_CAPTION_SIZE,
            fontWeight: 700,
            letterSpacing: 0,
            lineHeight: SHORT_CAPTION_LINE,
            textAlign: 'center',
          }}
        >
          <Wortzeile text={text} farbeFuer={(_w, i) => (i === aktiv ? SHORT_CAPTION_YELLOW : SHORT_TEXT)} gewichtFuer={() => 700} />
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
        <filter id="earnings-korn">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={amJoin ? 0 : Math.floor(frame / 2) % 6} stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#earnings-korn)" />
      </svg>
    </AbsoluteFill>
  )
}

import { loadFont as loadInterTight } from '@remotion/google-fonts/InterTight'
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono'
import { Audio } from '@remotion/media'
import { shutterModern, uiSwitch, whip, whoosh } from '@remotion/sfx'
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
import { berechneMoatShortTimeline } from './moat-short-timeline'
import type { MoatShortBeat, MoatShortProps, MoatShortVerdict } from './moat-short-types'

const { fontFamily: DISPLAY } = loadInterTight('normal', { weights: ['600', '800', '900'], subsets: ['latin'] })
const { fontFamily: MONO } = loadMono('normal', { weights: ['500', '700'], subsets: ['latin'] })

const BG = '#0C0C0E'
const BG_CRACK = '#1D0E0C'
const TEXT = '#F3F1EC'
const MUTED = 'rgba(243, 241, 236, 0.52)'
const BRAND = '#E9B44C'
const VERDICT_FARBE: Record<MoatShortVerdict, string> = { wide: '#6FD39A', narrow: '#E9B44C', none: '#EF6A5A' }
const VERDICT_LABEL: Record<MoatShortVerdict, string> = { wide: 'Wide moat', narrow: 'Narrow moat', none: 'No moat' }
const STEMPEL_AUFPRALL = 9

function scoreFarbe(score: number): string {
  if (score >= 8) return VERDICT_FARBE.wide
  if (score >= 6) return VERDICT_FARBE.narrow
  return VERDICT_FARBE.none
}

function beat(beats: MoatShortBeat[], id: MoatShortBeat['id']): MoatShortBeat {
  return beats.find((b) => b.id === id) ?? { id, text: '', from: 0, duration: 1 }
}

export const MoatShort: React.FC<MoatShortProps> = (props) => {
  const frame = useCurrentFrame()
  const timeline = useMemo(() => berechneMoatShortTimeline(props), [props])
  const { beats, captions, durationInFrames } = timeline

  const hook = beat(beats, 'hook')
  const teaser = beats.find((b) => b.id === 'teaser')
  const business = beat(beats, 'business')
  const p0 = beat(beats, 'pillar0')
  const p3 = beat(beats, 'pillar3')
  const crack = beat(beats, 'crack')
  const verdict = beat(beats, 'verdict')
  const crackEnde = crack.from + crack.duration

  const bg = interpolateColors(
    frame,
    [crack.from, crack.from + 6, crackEnde - 4, crackEnde],
    [BG, BG_CRACK, BG_CRACK, BG],
  )

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
      <Sequence from={verdict.from} durationInFrames={verdict.duration} layout="none">
        <VerdictSzene verdict={props.verdict} score={props.score} />
      </Sequence>

      {captions.map((c, i) => (
        <Sequence key={i} from={c.from} durationInFrames={c.duration} layout="none">
          <Caption text={c.text} />
        </Sequence>
      ))}

      <Kopfzeile ticker={props.ticker} logoUrl={props.logoUrl} fortschritt={frame / Math.max(1, durationInFrames - 1)} />
      <Koernung />
      <Ton
        musicSrc={props.musicSrc}
        musicGain={props.musicGain}
        musicTrim={props.musicTrim ?? 0}
        sfx={props.sfx}
        beats={beats}
        dauer={durationInFrames}
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
  dauer,
}: {
  musicSrc: string | null
  musicGain: number
  musicTrim: number
  sfx: boolean
  beats: MoatShortBeat[]
  dauer: number
}) {
  const crack = beats.find((b) => b.id === 'crack')
  const cues: { from: number; src: string; volume: number }[] = []
  for (const b of beats) {
    if (b.id === 'hook') cues.push({ from: b.from, src: whip, volume: 0.35 })
    if (b.id === 'business') cues.push({ from: Math.max(0, b.from - 4), src: whoosh, volume: 0.35 })
    if (b.id.startsWith('pillar')) cues.push({ from: b.from, src: uiSwitch, volume: 0.25 })
    if (b.id === 'crack') cues.push({ from: b.from + 2, src: whip, volume: 0.4 })
    if (b.id === 'verdict') cues.push({ from: b.from + STEMPEL_AUFPRALL - 1, src: shutterModern, volume: 1 })
  }

  const musikVolume = (f: number) => {
    const rein = interpolate(f, [0, 6], [0, 1], { extrapolateRight: 'clamp' })
    const raus = interpolate(f, [dauer - 30, dauer - 1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    const crackEnde = crack ? crack.from + crack.duration : 0
    const duck =
      crack && crack.from >= 4
        ? interpolate(f, [crack.from - 4, crack.from + 6, crackEnde - 6, crackEnde + 4], [1, 0.35, 0.35, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        : 1
    return Math.min(1, musicGain) * rein * raus * duck
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
  if (url.startsWith('/api/') || url.includes('/api/youtube/logo')) {
    if (url.startsWith('http')) return url
    return typeof window !== 'undefined' ? `${window.location.origin}${url}` : url
  }
  if (/^https?:\/\//i.test(url) && typeof window !== 'undefined' && !('remotion_staticBase' in window && window.remotion_staticBase)) {
    return `${window.location.origin}/api/youtube/logo?u=${encodeURIComponent(url)}`
  }
  if (/^https?:\/\//i.test(url)) return url
  return staticFile(url.replace(/^\/+/, ''))
}

function musikAudioSrc(src: string): string {
  if (/^https?:\/\//i.test(src) || src.startsWith('/api/')) return src
  const datei = src.split('/').pop() ?? src
  if (typeof window !== 'undefined' && !('remotion_staticBase' in window && window.remotion_staticBase) && datei) {
    return `${window.location.origin}/api/youtube/musik/datei/${encodeURIComponent(datei)}`
  }
  return staticFile(src.replace(/^\/+/, ''))
}

function Kopfzeile({ ticker, logoUrl, fortschritt }: { ticker: string; logoUrl: string | null; fortschritt: number }) {
  return (
    <div style={{ position: 'absolute', top: 132, left: 90, right: 90 }}>
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
        <div style={{ width: `${Math.min(1, fortschritt) * 100}%`, height: '100%', background: BRAND, borderRadius: 2 }} />
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

function HookSzene({ headline, value, label, teaserAb }: { headline: string; value: string; label: string; teaserAb: number | null }) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const einschlag = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 9 })
  const zaehlen = interpolate(frame, [0, 16], [0.45, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const schub = interpolate(frame, [0, durationInFrames], [1, 1.05], { easing: Easing.out(Easing.quad), extrapolateRight: 'clamp' })
  const teaser = teaserAb == null ? 0 : interpolate(frame, [teaserAb, teaserAb + 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const headlineGroesse = headline.length <= 55 ? 78 : headline.length <= 85 ? 66 : 56
  return (
    <AbsoluteFill style={{ alignItems: 'center', padding: '300px 90px 0', transform: `scale(${schub})` }}>
      <div style={{ fontSize: headlineGroesse, fontWeight: 800, letterSpacing: -2, lineHeight: 1.08, textAlign: 'center', opacity: 1 - 0.6 * teaser }}>
        {headline.split(' ').map((w, i) => (
          <span key={i} style={{ color: /\d/.test(w) ? BRAND : TEXT }}>
            {i > 0 ? ' ' : ''}
            {w}
          </span>
        ))}
      </div>
      <div style={{ marginTop: 110, textAlign: 'center', transform: `scale(${interpolate(einschlag, [0, 1], [1.15, 1])})` }}>
        <div style={{ fontSize: value.length > 7 ? 180 : 230, fontWeight: 900, letterSpacing: -8, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {zaehleHoch(value, zaehlen)}
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
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingBottom: 300 }}>
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
    <AbsoluteFill style={{ padding: '310px 90px 0', opacity: eintritt }}>
      <div style={{ fontFamily: MONO, fontSize: 30, letterSpacing: 7, color: MUTED, marginBottom: mitStats ? 40 : 54 }}>FOUR PILLARS</div>
      {pillars.slice(0, 4).map((p, i) => {
        const lokal = frame - (starts[i] ?? 0)
        const fuell = spring({ frame: lokal, fps, config: { damping: 22, mass: 0.7 }, durationInFrames: 18 })
        const gestartet = lokal >= 0
        const opacity = !gestartet ? 0.22 : i === aktiv ? 1 : 0.5
        const farbe = scoreFarbe(p.score)
        const anzeige = gestartet ? Math.round(p.score * Math.min(1, fuell)) : 0
        return (
          <div key={p.id} style={{ marginBottom: mitStats ? 40 : 58, opacity }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 58, fontWeight: 800, letterSpacing: -1.5 }}>{p.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 46, fontWeight: 700, color: gestartet ? farbe : MUTED, fontVariantNumeric: 'tabular-nums' }}>
                {anzeige}
                <span style={{ color: MUTED, fontSize: 30 }}>/10</span>
              </span>
            </div>
            <div style={{ marginTop: 20, height: 18, borderRadius: 9, background: 'rgba(243,241,236,0.09)', overflow: 'hidden' }}>
              <div style={{ width: `${gestartet ? (p.score / 10) * fuell * 100 : 0}%`, height: '100%', borderRadius: 9, background: farbe }} />
            </div>
            {mitStats ? (
              <div
                style={{
                  marginTop: 14,
                  height: 34,
                  fontFamily: MONO,
                  fontSize: 28,
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
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingBottom: 300, transform: `scale(${zurueck})` }}>
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

function VerdictSzene({ verdict, score }: { verdict: MoatShortVerdict; score: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const stempel = spring({ frame: frame - 3, fps, config: { damping: 11, mass: 0.6, stiffness: 180 } })
  const aufprall = Math.max(0, 1 - Math.abs(frame - STEMPEL_AUFPRALL) / 4)
  const wackeln = aufprall * Math.sin(frame * 2.3) * 7
  const farbe = VERDICT_FARBE[verdict]
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingBottom: 300, transform: `translate(${wackeln}px, ${wackeln * 0.6}px)` }}>
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
      <div style={{ position: 'absolute', bottom: 430, fontFamily: MONO, fontSize: 24, letterSpacing: 3, color: MUTED }}>NOT INVESTMENT ADVICE</div>
    </AbsoluteFill>
  )
}

function Caption({ text }: { text: string }) {
  const frame = useCurrentFrame()
  const rein = interpolate(frame, [0, 4], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  return (
    <div style={{ position: 'absolute', top: 1290, left: 90, right: 90, textAlign: 'center' }}>
      <span
        style={{
          display: 'inline-block',
          fontSize: 72,
          fontWeight: 800,
          letterSpacing: -1.5,
          lineHeight: 1.1,
          opacity: rein,
          transform: `translateY(${interpolate(rein, [0, 1], [14, 0])}px)`,
          textShadow: '0 4px 24px rgba(0,0,0,0.55)',
        }}
      >
        {text.split(' ').map((w, i) => (
          <span key={i} style={{ color: /\d/.test(w) ? BRAND : TEXT }}>
            {i > 0 ? ' ' : ''}
            {w}
          </span>
        ))}
      </span>
    </div>
  )
}

function Koernung() {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)' }} />
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.07, mixBlendMode: 'overlay' }}>
        <filter id="moat-korn">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={Math.floor(frame / 2) % 6} stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#moat-korn)" />
      </svg>
    </AbsoluteFill>
  )
}

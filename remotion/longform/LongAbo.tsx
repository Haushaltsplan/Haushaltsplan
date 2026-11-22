/** YouTuber-Style Abo-Karte: DailyMoat-Logo, Like + Subscribe, Cursor-Klick. */
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { LONGFORM_KANAL_LOGO, LONGFORM_KANAL_NAME, LONGFORM_KANAL_TAGLINE } from '../../lib/youtube/longform/longform-kanal'
import { oeffentlichSrc } from './long-bausteine'
import { LONG_MONO, LONG_SANS, LONG_SERIF_KURSIV, LONG_TEXT, mitAlpha } from './long-look'

export const ABO_KLICK_LIKE = 52
export const ABO_KLICK_ABO = 98

function Cursor({ x, y, druck }: { x: number; y: number; druck: number }) {
  return (
    <svg
      width={56}
      height={56}
      viewBox="0 0 24 24"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `scale(${1 - druck * 0.18})`,
        transformOrigin: '4px 2px',
        filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.55))',
      }}
    >
      <path d="M4 2 L4 19 L8.5 15 L11.5 21.5 L14 20.5 L11 14 L17 14 Z" fill="#fff" stroke="#111" strokeWidth={1.3} strokeLinejoin="round" />
    </svg>
  )
}

export function LongAbo({
  dauer,
  text,
  akzent,
  kanalName = LONGFORM_KANAL_NAME,
  kanalLogoUrl = LONGFORM_KANAL_LOGO,
  tagline = LONGFORM_KANAL_TAGLINE,
}: {
  dauer: number
  text: string
  akzent: string
  kanalName?: string
  kanalLogoUrl?: string | null
  tagline?: string
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const rein = spring({ frame, fps, config: { damping: 16, mass: 0.8 } })
  const raus = interpolate(frame, [dauer - 16, dauer], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const y = (1 - rein) * 260 + raus * 260

  const geliked = frame >= ABO_KLICK_LIKE
  const abonniert = frame >= ABO_KLICK_ABO
  const druck = (k: number) => interpolate(frame, [k - 3, k, k + 5], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const glocke = frame >= ABO_KLICK_ABO + 18

  const like = { x: 92, y: 128 }
  const abo = { x: 268, y: 128 }
  const pfad = [
    { f: 14, x: 640, y: 250 },
    { f: ABO_KLICK_LIKE - 4, x: like.x, y: like.y },
    { f: ABO_KLICK_LIKE + 14, x: like.x, y: like.y },
    { f: ABO_KLICK_ABO - 4, x: abo.x, y: abo.y },
    { f: ABO_KLICK_ABO + 22, x: abo.x + 88, y: abo.y + 4 },
  ]
  const cx = interpolate(frame, pfad.map((q) => q.f), pfad.map((q) => q.x), {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => t * t * (3 - 2 * t),
  })
  const cy = interpolate(frame, pfad.map((q) => q.f), pfad.map((q) => q.y), {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => t * t * (3 - 2 * t),
  })

  const logoSrc = kanalLogoUrl ? oeffentlichSrc(kanalLogoUrl) : null

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', right: 64, bottom: 56, width: 640, transform: `translateY(${y}px)`, opacity: 1 - raus }}>
        <div style={{ fontFamily: LONG_SERIF_KURSIV, fontSize: 32, color: LONG_TEXT, marginBottom: 16, textShadow: '0 2px 14px rgba(0,0,0,0.85)' }}>
          {text}
        </div>
        <div
          style={{
            position: 'relative',
            height: 210,
            borderRadius: 24,
            background: 'rgba(20,20,23,0.94)',
            border: '1px solid rgba(243,241,236,0.14)',
            boxShadow: '0 24px 70px rgba(0,0,0,0.6)',
            padding: '26px 30px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {logoSrc ? (
              <Img
                src={logoSrc}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  objectFit: 'cover',
                  border: '2px solid rgba(243,241,236,0.2)',
                }}
              />
            ) : (
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  background: mitAlpha(akzent, 0.9),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: LONG_MONO,
                  fontWeight: 700,
                  fontSize: 18,
                  color: '#0C0C0E',
                }}
              >
                DM
              </div>
            )}
            <div>
              <div style={{ fontFamily: LONG_SANS, fontWeight: 800, fontSize: 28, color: LONG_TEXT, letterSpacing: -0.3 }}>{kanalName}</div>
              <div style={{ fontFamily: LONG_MONO, fontSize: 16, color: 'rgba(243,241,236,0.55)', marginTop: 4 }}>{tagline}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 26, alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 24px',
                borderRadius: 999,
                background: geliked ? mitAlpha(akzent, 0.22) : 'rgba(243,241,236,0.1)',
                color: geliked ? akzent : LONG_TEXT,
                fontFamily: LONG_SANS,
                fontWeight: 700,
                fontSize: 24,
                transform: `scale(${1 + druck(ABO_KLICK_LIKE) * 0.08})`,
              }}
            >
              <svg width={28} height={28} viewBox="0 0 24 24">
                <path
                  d="M2 21h4V9H2v12zm20-11c0-1.1-.9-2-2-2h-6.3l1-4.6v-.3c0-.4-.2-.8-.4-1.1L13.2 1 6.6 7.6C6.2 8 6 8.5 6 9v10c0 1.1.9 2 2 2h9c.8 0 1.5-.5 1.8-1.2l3-7.1c.1-.2.2-.5.2-.7v-2z"
                  fill={geliked ? akzent : 'none'}
                  stroke={geliked ? akzent : LONG_TEXT}
                  strokeWidth={1.6}
                />
              </svg>
              Like
            </div>
            <div
              style={{
                padding: '12px 28px',
                borderRadius: 999,
                background: abonniert ? 'rgba(243,241,236,0.14)' : '#CC0000',
                color: abonniert ? LONG_TEXT : '#fff',
                fontFamily: LONG_SANS,
                fontWeight: 800,
                fontSize: 24,
                transform: `scale(${1 + druck(ABO_KLICK_ABO) * 0.08})`,
                boxShadow: abonniert ? undefined : '0 6px 18px rgba(204,0,0,0.35)',
              }}
            >
              {abonniert ? 'Subscribed' : 'Subscribe'}
            </div>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: glocke ? mitAlpha(akzent, 0.2) : 'rgba(243,241,236,0.08)',
                opacity: frame >= ABO_KLICK_ABO ? 1 : 0.35,
                transform: `scale(${1 + (glocke ? druck(ABO_KLICK_ABO + 18) : 0) * 0.1})`,
              }}
            >
              <svg width={26} height={26} viewBox="0 0 24 24" fill={glocke ? akzent : LONG_TEXT}>
                <path d="M12 22a2.2 2.2 0 0 0 2.2-2.2h-4.4A2.2 2.2 0 0 0 12 22zm6.4-6.2V11a6.4 6.4 0 1 0-12.8 0v4.8L4 17.4V19h16v-1.6l-1.6-1.6z" />
              </svg>
            </div>
          </div>
          <Cursor x={cx} y={cy} druck={Math.max(druck(ABO_KLICK_LIKE), druck(ABO_KLICK_ABO))} />
        </div>
        <div style={{ marginTop: 12, fontFamily: LONG_MONO, fontSize: 15, color: 'rgba(243,241,236,0.45)', textAlign: 'right' }}>
          Next deep dive · Playlist
        </div>
      </div>
    </AbsoluteFill>
  )
}

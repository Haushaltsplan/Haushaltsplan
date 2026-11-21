/** Bild-im-Bild: kleines Fenster mit Like- und Abo-Knopf, ein Cursor klickt beide. */
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { LONG_MONO, LONG_SANS, LONG_SERIF_KURSIV, LONG_TEXT, mitAlpha } from './long-look'

export const ABO_KLICK_LIKE = 52
export const ABO_KLICK_ABO = 98

function Cursor({ x, y, druck }: { x: number; y: number; druck: number }) {
  return (
    <svg width={44} height={44} viewBox="0 0 24 24" style={{ position: 'absolute', left: x, top: y, transform: `scale(${1 - druck * 0.18})`, transformOrigin: '4px 2px', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.5))' }}>
      <path d="M4 2 L4 19 L8.5 15 L11.5 21.5 L14 20.5 L11 14 L17 14 Z" fill="#fff" stroke="#111" strokeWidth={1.3} strokeLinejoin="round" />
    </svg>
  )
}

export function LongAbo({ dauer, text, akzent, ticker }: { dauer: number; text: string; akzent: string; ticker: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const rein = spring({ frame, fps, config: { damping: 16, mass: 0.8 } })
  const raus = interpolate(frame, [dauer - 16, dauer], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const y = (1 - rein) * 260 + raus * 260

  const geliked = frame >= ABO_KLICK_LIKE
  const abonniert = frame >= ABO_KLICK_ABO
  const druck = (k: number) => interpolate(frame, [k - 3, k, k + 5], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  // Knopfpositionen innerhalb der Karte (links oben = 0,0).
  const like = { x: 82, y: 104 }
  const abo = { x: 238, y: 104 }
  const pfad = [
    { f: 14, x: 640, y: 230 },
    { f: ABO_KLICK_LIKE - 4, x: like.x, y: like.y },
    { f: ABO_KLICK_LIKE + 14, x: like.x, y: like.y },
    { f: ABO_KLICK_ABO - 4, x: abo.x, y: abo.y },
    { f: ABO_KLICK_ABO + 20, x: abo.x + 30, y: abo.y + 40 },
  ]
  const cx = interpolate(frame, pfad.map((q) => q.f), pfad.map((q) => q.x), { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: (t) => t * t * (3 - 2 * t) })
  const cy = interpolate(frame, pfad.map((q) => q.f), pfad.map((q) => q.y), { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: (t) => t * t * (3 - 2 * t) })

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', right: 72, bottom: 64, width: 600, transform: `translateY(${y}px)`, opacity: 1 - raus }}>
        <div style={{ fontFamily: LONG_SERIF_KURSIV, fontSize: 30, color: LONG_TEXT, marginBottom: 14, textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}>{text}</div>
        <div
          style={{
            position: 'relative',
            height: 170,
            borderRadius: 22,
            background: 'rgba(20,20,23,0.92)',
            border: '1px solid rgba(243,241,236,0.12)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
            padding: '24px 28px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 24, background: mitAlpha(akzent, 0.9), display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: LONG_MONO, fontWeight: 700, fontSize: 16, color: '#0C0C0E' }}>
              {ticker.slice(0, 3)}
            </div>
            <div style={{ fontFamily: LONG_SANS, fontWeight: 700, fontSize: 24, color: LONG_TEXT }}>Deep-dive stock analysis</div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 22 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 22px',
                borderRadius: 999,
                background: geliked ? mitAlpha(akzent, 0.22) : 'rgba(243,241,236,0.1)',
                color: geliked ? akzent : LONG_TEXT,
                fontFamily: LONG_SANS,
                fontWeight: 700,
                fontSize: 24,
                transform: `scale(${1 + druck(ABO_KLICK_LIKE) * 0.08})`,
              }}
            >
              <svg width={26} height={26} viewBox="0 0 24 24">
                <path d="M2 21h4V9H2v12zm20-11c0-1.1-.9-2-2-2h-6.3l1-4.6v-.3c0-.4-.2-.8-.4-1.1L13.2 1 6.6 7.6C6.2 8 6 8.5 6 9v10c0 1.1.9 2 2 2h9c.8 0 1.5-.5 1.8-1.2l3-7.1c.1-.2.2-.5.2-.7v-2z" fill={geliked ? akzent : 'none'} stroke={geliked ? akzent : LONG_TEXT} strokeWidth={1.6} />
              </svg>
              Like
            </div>
            <div
              style={{
                padding: '10px 26px',
                borderRadius: 999,
                background: abonniert ? 'rgba(243,241,236,0.14)' : '#F3F1EC',
                color: abonniert ? LONG_TEXT : '#0C0C0E',
                fontFamily: LONG_SANS,
                fontWeight: 700,
                fontSize: 24,
                transform: `scale(${1 + druck(ABO_KLICK_ABO) * 0.08})`,
              }}
            >
              {abonniert ? 'Subscribed ✓' : 'Subscribe'}
            </div>
          </div>
          <Cursor x={cx} y={cy} druck={Math.max(druck(ABO_KLICK_LIKE), druck(ABO_KLICK_ABO))} />
        </div>
      </div>
    </AbsoluteFill>
  )
}

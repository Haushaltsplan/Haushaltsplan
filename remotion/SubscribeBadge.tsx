import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { SHORT_MONO } from './short-look'

/** Auf dem 1080er-Frame, damit die Zeile unter dem Stempel lesbar bleibt. */
const SCHRIFT = 26

/**
 * Erscheint kurz nach dem Verdict-Stempel.
 * Die Frame-Animation trägt das Bild; die Klassen halten das Terminal-Aussehen.
 */
export function SubscribeBadge() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const start = 12
  const sprung = spring({
    frame: frame - start,
    fps,
    config: { damping: 16, mass: 0.55, stiffness: 140 },
  })
  const opacity = interpolate(frame, [start, start + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const y = interpolate(frame, [start, start + 14], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  })
  const scale = interpolate(sprung, [0, 1], [0.94, 1])
  const zyklus = 40
  const t = frame % zyklus
  const pingScale = interpolate(t, [0, zyklus], [1, 1.85])
  const pingOpacity = interpolate(t, [0, zyklus], [0.55, 0])

  return (
    <div
      className="mx-auto mt-4 inline-flex items-center gap-2.5 rounded-full border border-neutral-800 bg-neutral-950/90 px-4 py-2 font-mono uppercase tracking-wider text-neutral-200 shadow-lg backdrop-blur-sm"
      style={{
        marginTop: 16,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 18px',
        borderRadius: 999,
        border: '1px solid #262626',
        background: 'rgba(10, 10, 10, 0.9)',
        boxShadow: '0 10px 24px rgba(0, 0, 0, 0.35)',
        backdropFilter: 'blur(6px)',
        fontFamily: SHORT_MONO,
        fontSize: SCHRIFT,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: '#E5E5E5',
        opacity,
        transform: `translateY(${y}px) scale(${scale})`,
      }}
    >
      <span className="relative inline-flex h-2.5 w-2.5" style={{ position: 'relative', width: 12, height: 12, flex: '0 0 auto' }}>
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            background: '#10b981',
            opacity: pingOpacity,
            transform: `scale(${pingScale})`,
          }}
        />
        <span
          className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"
          style={{ position: 'absolute', inset: 2, borderRadius: 999, background: '#10b981' }}
        />
      </span>
      <span className="text-emerald-400" style={{ color: '#34d399', fontWeight: 700, lineHeight: 1 }} aria-hidden>
        +
      </span>
      <span style={{ lineHeight: 1 }}>Subscribe for daily moat checks</span>
    </div>
  )
}

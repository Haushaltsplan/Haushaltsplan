'use client'

import { RingWert, WhoopProgressArc, ringGradientFuer, type WhoopRingKind } from '@/components/fitnessdaten/whoop-ring'
import { WHOOP_COLORS, recoveryColorToken, withAlpha } from '@/components/fitnessdaten/whoop-design-tokens'

function kindAus(max: number, color?: string): WhoopRingKind {
  if (max === 21) return 'strain'
  if (color == null) return 'recovery'
  return 'custom'
}

export function WhoopBigRing({
  value,
  max = 100,
  label,
  sublabel,
  color,
  kind,
  size = 208,
}: {
  value: number | null
  max?: number
  label: string
  sublabel?: string
  color?: string
  kind?: WhoopRingKind
  size?: number
}) {
  const k = kind ?? kindAus(max, color)
  const gradient = ringGradientFuer(k, value, color)
  const akzent = k === 'recovery' ? recoveryColorToken(value) : gradient[1]

  return (
    <div className="relative flex flex-col items-center py-4">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: withAlpha(akzent, value == null ? 0 : 0.14) }}
      />
      <WhoopProgressArc size={size} stroke={13} pct={value == null ? null : value / max} gradient={gradient}>
        <span className="text-[10px] font-bold tracking-[0.24em] text-[#6B7280]">OMNIA</span>
        <span className="mt-1">
          <RingWert value={value} max={max} gross />
        </span>
        <span className="mt-1.5 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: akzent }}>
          {label}
        </span>
        {sublabel ? <span className="mt-0.5 text-[11px] tabular-nums text-[#8B93A1]">{sublabel}</span> : null}
      </WhoopProgressArc>
    </div>
  )
}

export function WhoopMiniRings({ strain, sleep }: { strain: number | null; sleep: number | null }) {
  return (
    <div className="flex justify-center gap-8">
      <MiniRing value={strain} max={21} label="Belastung" kind="strain" />
      <MiniRing value={sleep} max={100} label="Schlaf" kind="sleep" />
    </div>
  )
}

function MiniRing({
  value,
  max,
  label,
  kind,
}: {
  value: number | null
  max: number
  label: string
  kind: WhoopRingKind
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <WhoopProgressArc size={72} stroke={5} pct={value == null ? null : value / max} gradient={ringGradientFuer(kind, value)} glow={false}>
        <RingWert value={value} max={max} gross={false} />
      </WhoopProgressArc>
      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: WHOOP_COLORS.textMuted }}>
        {label}
      </span>
    </div>
  )
}

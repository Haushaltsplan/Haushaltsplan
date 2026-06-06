'use client'

import type { FitnessHrPoint } from '@/lib/fitnessdaten/types'

type Props = {
  points: FitnessHrPoint[]
  height?: number
  live?: boolean
}

export function WhoopHrChart({ points, height = 120, live = false }: Props) {
  if (points.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]"
        style={{ height }}
      >
        <p className="text-xs text-zinc-600">
          {live ? 'Warte auf Pulsdaten …' : 'Kein Verlauf — WHOOP verbinden'}
        </p>
      </div>
    )
  }

  const width = 400
  const pad = 8
  const bpms = points.map((p) => p.bpm)
  const min = Math.max(40, Math.min(...bpms) - 8)
  const max = Math.min(200, Math.max(...bpms) + 8)
  const range = max - min || 1

  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (width - pad * 2)
    const y = pad + (1 - (p.bpm - min) / range) * (height - pad * 2)
    return { x, y }
  })

  const poly = coords.map((c) => `${c.x},${c.y}`).join(' ')
  const last = coords[coords.length - 1]!

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="whoopHrFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          points={poly}
          fill="none"
          stroke="#ef4444"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polygon
          points={`${pad},${height - pad} ${poly} ${width - pad},${height - pad}`}
          fill="url(#whoopHrFill)"
        />
        <circle cx={last.x} cy={last.y} r="4" fill="#ef4444" />
      </svg>
      <div className="absolute bottom-2 left-3 flex gap-3 text-[10px] tabular-nums text-zinc-600">
        <span>min {min}</span>
        <span>max {max}</span>
        <span className="text-red-400/80">live {points[points.length - 1]!.bpm} bpm</span>
      </div>
    </div>
  )
}

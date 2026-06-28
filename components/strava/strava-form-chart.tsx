'use client'

import { appTableScrollInlineClassName } from '@/components/page-shell'
import { STRAVA_COLORS } from '@/components/strava/design-tokens'
import { StravaCard, StravaSectionTitle } from '@/components/strava/strava-card'
import { formLabel, type FormPoint } from '@/lib/strava/strava-training-load'
import { useMemo } from 'react'

export function StravaFormChart({ data, current }: { data: FormPoint[]; current: FormPoint | null }) {
  const h = 160
  const w = Math.max(400, data.length * 5)
  const slice = data.slice(-56)

  const { maxVal } = useMemo(() => {
    const vals = slice.flatMap((p) => [p.ctl, p.atl])
    return { maxVal: Math.max(...vals, 50) }
  }, [slice])

  const coords = slice.map((p, i) => {
    const x = 20 + (i / Math.max(slice.length - 1, 1)) * (w - 40)
    const ctlY = 24 + (1 - p.ctl / maxVal) * (h - 48)
    const atlY = 24 + (1 - p.atl / maxVal) * (h - 48)
    return { x, ctlY, atlY, ...p }
  })

  const status = current ? formLabel(current.tsb) : null

  return (
    <StravaCard padding="md" accent="cyan">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <StravaSectionTitle title="Fitness · Fatigue · Form" subtitle="CTL / ATL / TSB (12 Wochen)" />
        {current && status ? (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-[var(--app-text-muted)]">Form (TSB)</p>
            <p className="text-lg font-bold tabular-nums" style={{ color: status.color }}>
              {current.tsb > 0 ? '+' : ''}
              {current.tsb}
            </p>
            <p className="text-[10px]" style={{ color: status.color }}>
              {status.label}
            </p>
          </div>
        ) : null}
      </div>
      <div className="mb-2 flex gap-4 text-[10px] text-[var(--app-text-muted)]">
        <span className="flex items-center gap-1">
          <span className="h-2 w-4 rounded-sm" style={{ background: STRAVA_COLORS.cyan }} />
          CTL (Fitness)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-4 rounded-sm" style={{ background: STRAVA_COLORS.orange }} />
          ATL (Fatigue)
        </span>
      </div>
      <div className={appTableScrollInlineClassName}>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ minWidth: w, width: '100%', height: h }}>
          {coords.length >= 2 ? (
            <>
              <polyline
                points={coords.map((c) => `${c.x},${c.ctlY}`).join(' ')}
                fill="none"
                stroke={STRAVA_COLORS.cyan}
                strokeWidth={2}
              />
              <polyline
                points={coords.map((c) => `${c.x},${c.atlY}`).join(' ')}
                fill="none"
                stroke={STRAVA_COLORS.orange}
                strokeWidth={2}
                opacity={0.85}
              />
            </>
          ) : null}
        </svg>
      </div>
      {current ? (
        <p className="mt-2 text-[11px] text-[var(--app-text-muted)]">
          CTL {current.ctl} · ATL {current.atl} · Wochen-TSS {current.tss}
        </p>
      ) : null}
    </StravaCard>
  )
}

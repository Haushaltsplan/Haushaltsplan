'use client'

import { STRAVA_COLORS, STRAVA_INTERACTIVE } from '@/components/strava/design-tokens'
import { StravaCard } from '@/components/strava/strava-card'
import type { KpiMetric, KpiPeriod } from '@/lib/strava/strava-dashboard-analytics'

type Props = {
  kpis: KpiMetric[]
  period: KpiPeriod
  onPeriodChange: (p: KpiPeriod) => void
}

const KPI_ACCENT: Record<KpiMetric['key'], string> = {
  distance: STRAVA_COLORS.orange,
  time: STRAVA_COLORS.cyan,
  elevation: STRAVA_COLORS.green,
  count: STRAVA_COLORS.yellow,
}

function ChangeBadge({ metric }: { metric: KpiMetric }) {
  if (metric.changePct == null) {
    return <span className="text-[10px] text-[var(--app-text-muted)]">{metric.changeLabel}</span>
  }
  const positive = metric.changePct >= 0
  const color = positive ? STRAVA_COLORS.positive : STRAVA_COLORS.negative
  return (
    <span className="text-[10px] font-medium tabular-nums" style={{ color }}>
      {metric.changeLabel}
    </span>
  )
}

export function StravaKpiBar({ kpis, period, onPeriodChange }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--app-text-muted)]">Performance Summary</p>
        <div className="flex rounded-full border border-white/[0.08] bg-black/40 p-0.5">
          {(['week', 'month'] as KpiPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPeriodChange(p)}
              className={[
                'rounded-full px-3 py-1 text-[11px] font-semibold capitalize',
                STRAVA_INTERACTIVE,
                period === p
                  ? 'bg-[#FC4C02]/20 text-orange-200 ring-1 ring-[#FC4C02]/35'
                  : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]',
              ].join(' ')}
            >
              {p === 'week' ? 'Woche' : 'Monat'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((m) => (
          <StravaCard key={m.key} accent="none" padding="md" hover className="relative overflow-hidden">
            <div
              className="absolute inset-x-0 top-0 h-0.5 opacity-80"
              style={{ background: KPI_ACCENT[m.key] }}
            />
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">{m.label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-[var(--app-text)]">{m.value}</p>
            <div className="mt-2">
              <ChangeBadge metric={m} />
            </div>
          </StravaCard>
        ))}
      </div>
    </div>
  )
}

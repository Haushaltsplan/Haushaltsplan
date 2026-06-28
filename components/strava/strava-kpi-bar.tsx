'use client'

import { STRAVA_COLORS, STRAVA_INTERACTIVE } from '@/components/strava/design-tokens'
import { StravaCard, StravaPanelEyebrow } from '@/components/strava/strava-card'
import { StravaInfoTip } from '@/components/strava/strava-info-tip'
import { STRAVA_PANEL_INFO } from '@/lib/strava/strava-panel-info'
import type { KpiMetric, KpiPeriod } from '@/lib/strava/strava-dashboard-analytics'

type Props = {
  kpis: KpiMetric[]
  period: KpiPeriod
  onPeriodChange: (p: KpiPeriod) => void
}

const KPI_INFO: Record<KpiMetric['key'], string> = {
  distance: STRAVA_PANEL_INFO.kpiDistance,
  time: STRAVA_PANEL_INFO.kpiTime,
  elevation: STRAVA_PANEL_INFO.kpiElevation,
  count: STRAVA_PANEL_INFO.kpiCount,
}

const KPI_ACCENT: Record<KpiMetric['key'], string> = {
  distance: STRAVA_COLORS.orange,
  time: STRAVA_COLORS.cyan,
  elevation: STRAVA_COLORS.green,
  count: STRAVA_COLORS.yellow,
}

function ChangeBadge({ metric }: { metric: KpiMetric }) {
  if (metric.changePct == null) {
    return <span className="text-[10px] text-zinc-500">{metric.changeLabel}</span>
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <StravaPanelEyebrow>Performance Summary</StravaPanelEyebrow>
          <StravaInfoTip text={STRAVA_PANEL_INFO.kpiSummary} variant="compact" />
        </div>
        <div className="flex rounded-full border border-white/[0.06] bg-black/30 p-0.5 backdrop-blur-sm">
          {(
            [
              ['week', 'Woche'],
              ['month', 'Monat'],
              ['quarter', 'Quartal'],
              ['ytd', 'YTD'],
            ] as const
          ).map(([p, label]) => (
            <button
              key={p}
              type="button"
              onClick={() => onPeriodChange(p)}
              className={[
                'rounded-full px-2.5 py-1 text-[10px] font-semibold sm:px-3 sm:text-[11px]',
                STRAVA_INTERACTIVE,
                period === p
                  ? 'bg-[#FC4C02]/20 text-orange-200 ring-1 ring-[#FC4C02]/35'
                  : 'text-zinc-500 hover:text-zinc-200',
              ].join(' ')}
            >
              {label}
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
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{m.label}</p>
              <StravaInfoTip text={KPI_INFO[m.key]} variant="compact" />
            </div>
            <p className="mt-2 text-2xl font-light tabular-nums tracking-tight text-zinc-100">{m.value}</p>
            <div className="mt-2">
              <ChangeBadge metric={m} />
            </div>
          </StravaCard>
        ))}
      </div>
    </div>
  )
}

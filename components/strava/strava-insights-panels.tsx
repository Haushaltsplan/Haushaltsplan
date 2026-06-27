'use client'

import { STRAVA_COLORS, STRAVA_INTERACTIVE } from '@/components/strava/design-tokens'
import { StravaCard, StravaSectionTitle } from '@/components/strava/strava-card'
import type {
  ClimbingWeek,
  ConsistencyStats,
  IntensityMix,
  YearCompare,
} from '@/lib/strava/strava-insights'

export function StravaConsistencyPanel({ stats }: { stats: ConsistencyStats }) {
  return (
    <StravaCard padding="md" hover>
      <StravaSectionTitle title="Konsistenz" subtitle="Trainingsdisziplin" />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Aktuelle Streak</p>
          <p className="text-2xl font-bold tabular-nums text-zinc-50">{stats.currentStreakWeeks}</p>
          <p className="text-[10px] text-zinc-500">Wochen</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Rekord-Streak</p>
          <p className="text-2xl font-bold tabular-nums text-zinc-50">{stats.longestStreakWeeks}</p>
          <p className="text-[10px] text-zinc-500">Wochen</p>
        </div>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[10px] text-zinc-500">
          <span>{stats.weeksWithRide} / {stats.totalWeeks} Wochen aktiv</span>
          <span>{Math.round(stats.consistencyPct)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${stats.consistencyPct}%`, background: STRAVA_COLORS.green }}
          />
        </div>
      </div>
    </StravaCard>
  )
}

export function StravaIntensityPanel({ mix }: { mix: IntensityMix }) {
  const segments = [
    { label: 'Easy (Z1-2)', pct: mix.easyPct, color: '#22c55e' },
    { label: 'Moderate (Z3)', pct: mix.moderatePct, color: '#eab308' },
    { label: 'Hard (Z4-5)', pct: mix.hardPct, color: '#f97316' },
  ]
  return (
    <StravaCard padding="md" hover>
      <StravaSectionTitle title="Intensitäts-Mix" subtitle="Polarisation · 28 Tage" />
      <div className="flex h-3 overflow-hidden rounded-full">
        {segments.map((s) =>
          s.pct > 0 ? (
            <div key={s.label} style={{ width: `${s.pct}%`, background: s.color }} title={`${s.label}: ${s.pct.toFixed(0)}%`} />
          ) : null,
        )}
      </div>
      <div className="mt-3 space-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-zinc-400">
              <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="tabular-nums text-zinc-300">{s.pct.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </StravaCard>
  )
}

export function StravaClimbingPanel({ data }: { data: ClimbingWeek[] }) {
  const peak = Math.max(...data.map((d) => d.hm), 1)
  const h = 100
  const w = Math.max(320, data.length * 24)
  return (
    <StravaCard padding="md">
      <StravaSectionTitle title="Kletter-Profil" subtitle="Höhenmeter pro Woche" />
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} style={{ minWidth: w, width: '100%', height: h }}>
          {data.map((d, i) => {
            const barW = Math.max(10, w / data.length - 4)
            const x = i * (w / data.length) + 2
            const barH = (d.hm / peak) * (h - 28)
            return (
              <g key={d.label}>
                {d.hm > 0 ? (
                  <text x={x + barW / 2} y={12} textAnchor="middle" fill={STRAVA_COLORS.green} fontSize="7">
                    {d.hm}
                  </text>
                ) : null}
                <rect x={x} y={h - 20 - barH} width={barW} height={Math.max(barH, d.hm > 0 ? 2 : 0)} fill={STRAVA_COLORS.green} rx={2} opacity={0.85} />
                <text x={x + barW / 2} y={h - 4} textAnchor="middle" fill="#71717a" fontSize="6">
                  {d.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </StravaCard>
  )
}

export function StravaYearComparePanel({ items }: { items: YearCompare[] }) {
  return (
    <StravaCard padding="md">
      <StravaSectionTitle title="Jahresvergleich" subtitle="YTD vs. Vorjahr" />
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className={`flex items-center justify-between rounded-lg px-2 py-1.5 ${STRAVA_INTERACTIVE} hover:bg-white/[0.03]`}>
            <span className="text-xs text-zinc-400">{item.label}</span>
            <div className="text-right">
              <span className="text-sm font-semibold tabular-nums text-zinc-100">{item.current}</span>
              {item.changePct != null ? (
                <span
                  className="ml-2 text-[10px] font-medium tabular-nums"
                  style={{ color: item.changePct >= 0 ? STRAVA_COLORS.positive : STRAVA_COLORS.negative }}
                >
                  {item.changePct >= 0 ? '+' : ''}
                  {item.changePct.toFixed(0)}%
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </StravaCard>
  )
}

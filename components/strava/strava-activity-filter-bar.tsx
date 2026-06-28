'use client'

import { STRAVA_COLORS, STRAVA_INTERACTIVE } from '@/components/strava/design-tokens'
import { StravaCard } from '@/components/strava/strava-card'
import {
  activitiesToCsv,
  filterActivities,
  type AnalyticsFilter,
} from '@/lib/strava/strava-advanced-metrics'
import type { StravaExtendedAnalytics } from '@/lib/strava/strava-extended-analytics'
import {
  transformSortedFeed,
  type ActivitySortKey,
} from '@/lib/strava/strava-activity-filters'
import { printSeasonReview } from '@/lib/strava/strava-season-export'
import type { StravaActivityRow, StravaAthleteProfile } from '@/lib/strava/strava-types'
import { useCallback, useMemo } from 'react'

export type FilterBarState = AnalyticsFilter & {
  sortKey: ActivitySortKey
  sortDesc: boolean
}

type Props = {
  state: FilterBarState
  onChange: (next: FilterBarState) => void
  activities: StravaActivityRow[]
  filteredCount: number
  athlete: StravaAthleteProfile | null
  analytics: StravaExtendedAnalytics
}

const RANGE_OPTIONS: { label: string; days: number | null }[] = [
  { label: '4 Wochen', days: 28 },
  { label: '12 Wochen', days: 84 },
  { label: '6 Monate', days: 182 },
  { label: '1 Jahr', days: 365 },
  { label: 'Alles', days: null },
]

const SORT_OPTIONS: { key: ActivitySortKey; label: string }[] = [
  { key: 'date', label: 'Datum' },
  { key: 'distance', label: 'Distanz' },
  { key: 'time', label: 'Zeit' },
  { key: 'watts', label: 'Leistung' },
  { key: 'wkg', label: 'W/kg' },
  { key: 'elevation', label: 'HM' },
  { key: 'tss', label: 'TSS' },
]

function chip(active: boolean) {
  return [
    'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors',
    STRAVA_INTERACTIVE,
    active
      ? 'border-orange-500/40 bg-orange-500/15 text-orange-300'
      : 'border-white/10 bg-black/30 text-[var(--app-text-muted)] hover:border-white/20',
  ].join(' ')
}

export function StravaActivityFilterBar({
  state,
  onChange,
  activities,
  filteredCount,
  athlete,
  analytics,
}: Props) {
  const weightKg = athlete?.omnia_weight_kg ?? null

  const exportCsv = useCallback(() => {
    const csv = activitiesToCsv(activities, weightKg)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `strava-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [activities, weightKg])

  const exportPdf = useCallback(() => {
    printSeasonReview(activities, athlete, analytics)
  }, [activities, athlete, analytics])

  return (
    <StravaCard padding="md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--app-text)]">Filter & Export</p>
          <p className="text-[11px] text-[var(--app-text-muted)]">
            {filteredCount} Aktivitäten in der Auswahl
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className={`rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-semibold text-[var(--app-text)] ${STRAVA_INTERACTIVE}`}
          >
            CSV
          </button>
          <button
            type="button"
            onClick={exportPdf}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${STRAVA_INTERACTIVE}`}
            style={{ background: STRAVA_COLORS.orange }}
          >
            Saison-Review (PDF)
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="self-center text-[10px] uppercase tracking-wider text-[var(--app-text-muted)]">
          Zeitraum
        </span>
        {RANGE_OPTIONS.map((o) => (
          <button
            key={o.label}
            type="button"
            className={chip(state.rangeDays === o.days)}
            onClick={() => onChange({ ...state, rangeDays: o.days })}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className={chip(state.ridesOnly)}
          onClick={() => onChange({ ...state, ridesOnly: !state.ridesOnly })}
        >
          Nur Rad
        </button>
        <button
          type="button"
          className={chip(state.outdoorOnly)}
          onClick={() => onChange({ ...state, outdoorOnly: !state.outdoorOnly })}
        >
          Outdoor
        </button>
        <button
          type="button"
          className={chip(!state.ridesOnly && !state.outdoorOnly)}
          onClick={() => onChange({ ...state, ridesOnly: false, outdoorOnly: false })}
        >
          Alle Sportarten
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-[var(--app-text-muted)]">
          Feed sortieren
        </span>
        {SORT_OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            className={chip(state.sortKey === o.key)}
            onClick={() =>
              onChange({
                ...state,
                sortKey: o.key,
                sortDesc: state.sortKey === o.key ? !state.sortDesc : true,
              })
            }
          >
            {o.label}
            {state.sortKey === o.key ? (state.sortDesc ? ' ↓' : ' ↑') : ''}
          </button>
        ))}
      </div>
    </StravaCard>
  )
}

export function useFilteredActivities(
  activities: StravaActivityRow[],
  filter: AnalyticsFilter,
): StravaActivityRow[] {
  return useMemo(() => filterActivities(activities, filter), [activities, filter])
}

export function useSortedFeed(
  activities: StravaActivityRow[],
  sortKey: ActivitySortKey,
  sortDesc: boolean,
  weightKg: number | null = null,
  limit = 50,
) {
  return useMemo(
    () => transformSortedFeed(activities, sortKey, sortDesc, weightKg, limit),
    [activities, sortKey, sortDesc, weightKg, limit],
  )
}

'use client'

import { TRAININGS_ZIEL } from '@/lib/trainingsplan/profile'
import {
  fortschrittProzent,
  tageBisZiel,
  zeitFortschrittProzent,
  wochenBisZiel,
} from '@/lib/trainingsplan/progress'
import { formatDeDate } from '@/lib/trainingsplan/date-utils'
import type { TrainingsStats } from '@/lib/trainingsplan/types'

export function ProgressTimeline({ stats }: { stats: TrainingsStats }) {
  const workoutPct = fortschrittProzent(stats.workoutsAbsolviert)
  const timePct = zeitFortschrittProzent()
  const daysLeft = tageBisZiel()
  const weeksLeft = wochenBisZiel()

  return (
    <section className="app-section-shell">
      <div className="app-surface-card-header px-4 py-3 sm:px-5">
        <h2 className="text-base font-semibold tracking-tight text-[var(--app-text)]">
          Countdown & Fortschritt
        </h2>
        <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
          Ziel: {formatDeDate(TRAININGS_ZIEL.datumIso)} · {daysLeft} Tage · {weeksLeft} Wochen
        </p>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        <ProgressBar
          label="Workouts bis Februar"
          value={workoutPct}
          detail={`${stats.workoutsAbsolviert} / ${stats.workoutsGeplant}`}
          color="bg-orange-400"
        />
        <ProgressBar
          label="Zeitverlauf"
          value={timePct}
          detail={`${timePct} % der Strecke`}
          color="bg-teal-400"
        />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="Kraft-Einheiten" value={String(stats.kraftAbsolviert)} emoji="🏋️" />
          <StatTile label="Rad-km (geschätzt)" value={`${stats.radKm}`} emoji="🚴" />
          <StatTile label="Streak" value={`${stats.streakTage} Tage`} emoji="🔥" />
          <StatTile label="Wochen übrig" value={String(weeksLeft)} emoji="📅" />
        </div>
      </div>
    </section>
  )
}

function ProgressBar({
  label,
  value,
  detail,
  color,
}: {
  label: string
  value: number
  detail: string
  color: string
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-[var(--app-text)]">{label}</span>
        <span className="text-[11px] text-[var(--app-text-muted)]">
          {detail} · {value} %
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--app-chart-track)]">
        <div
          className={`h-full rounded-full ${color} transition-[width] duration-500 ease-out`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  )
}

function StatTile({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)]/50 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--app-text-muted)]">
        <span className="mr-1" aria-hidden>
          {emoji}
        </span>
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--app-text)]">{value}</p>
    </div>
  )
}

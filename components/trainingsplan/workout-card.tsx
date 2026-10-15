'use client'

import { formatDeDate, weekdayName } from '@/lib/trainingsplan/date-utils'
import { kindAccent, kindEmoji } from '@/lib/trainingsplan/weekly-plan'
import type { DaySession } from '@/lib/trainingsplan/types'

export function WorkoutCard({
  session,
  isToday,
  onStart,
  onPostpone,
  onCompleteEasy,
}: {
  session: DaySession
  isToday: boolean
  onStart: () => void
  onPostpone: () => void
  onCompleteEasy: () => void
}) {
  const accent = kindAccent(session.kind)
  const canTrain = session.kind === 'kraft1' || session.kind === 'kraft2'
  const canMark =
    !session.completed && (session.kind === 'rennrad' || session.kind === 'ruhe' || canTrain)

  return (
    <article
      className={`rounded-2xl border bg-[var(--app-surface-muted)]/40 p-4 transition ${
        isToday
          ? 'border-orange-400/40 shadow-[0_0_0_1px_rgb(251_146_60/0.15)]'
          : 'border-[var(--app-border)]'
      } ${session.completed ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg" aria-hidden>
              {kindEmoji(session.kind)}
            </span>
            <p className="text-xs font-medium text-[var(--app-text-muted)]">
              {weekdayName(session.dateIso)} · {formatDeDate(session.dateIso)}
            </p>
            {isToday ? (
              <span className="rounded-md bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-300">
                Heute
              </span>
            ) : null}
            {session.completed ? (
              <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                Erledigt
              </span>
            ) : null}
          </div>
          <h3 className={`mt-1.5 text-sm font-semibold tracking-tight sm:text-base ${accent}`}>
            {session.title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-[var(--app-text-muted)]">
            {session.subtitle}
          </p>
          {session.durationMin > 0 ? (
            <p className="mt-2 text-[11px] text-[var(--app-text-muted)]">
              ca. {session.durationMin} Min.
              {session.postponedFrom ? ' · verschoben' : ''}
            </p>
          ) : null}
        </div>
      </div>

      {!session.completed && session.kind !== 'ruhe' ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {canTrain ? (
            <button
              type="button"
              onClick={onStart}
              className="rounded-xl bg-orange-500/90 px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-400"
            >
              Mit-Trainieren
            </button>
          ) : null}
          {session.kind === 'rennrad' ? (
            <button
              type="button"
              onClick={onCompleteEasy}
              className="rounded-xl bg-rose-500/80 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-400"
            >
              Fahrt erledigt
            </button>
          ) : null}
          <button
            type="button"
            onClick={onPostpone}
            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs font-medium text-[var(--app-text-muted)] transition hover:text-[var(--app-text)]"
          >
            Auf morgen verschieben
          </button>
        </div>
      ) : null}

      {!session.completed && session.kind === 'ruhe' && canMark ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={onCompleteEasy}
            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs font-medium text-[var(--app-text-muted)] transition hover:text-[var(--app-text)]"
          >
            Ruhe abhaken
          </button>
        </div>
      ) : null}

      {canTrain && session.exercises && session.exercises.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-[var(--app-border)] pt-3">
          {session.exercises.map((ex) => (
            <li key={ex.id} className="flex items-center gap-2 text-xs text-[var(--app-text-muted)]">
              <span aria-hidden>{ex.emoji}</span>
              <span className="min-w-0 flex-1 truncate text-[var(--app-text)]">{ex.name}</span>
              <span className="shrink-0 tabular-nums">
                {ex.sets}× {ex.reps}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}

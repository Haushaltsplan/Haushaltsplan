'use client'

import { formatDeDate, weekdayName } from '@/lib/trainingsplan/date-utils'
import { sumRideKm } from '@/lib/trainingsplan/strava-rides'
import { istTrainierbareKraft, kindAccent, kindEmoji } from '@/lib/trainingsplan/weekly-plan'
import type { DaySession } from '@/lib/trainingsplan/types'

export function WorkoutCard({
  session,
  isToday,
  onStart,
  onPostpone,
  onShift,
  onSetFlexMode,
  onCompleteEasy,
  onClaimStravaRide,
  onAutoCompleteFromStrava,
}: {
  session: DaySession
  isToday: boolean
  onStart: () => void
  onPostpone: () => void
  onShift: (dir: 'vor' | 'zurueck') => void
  onSetFlexMode: (mode: 'ruhe' | 'aktiv') => void
  onCompleteEasy: () => void
  onClaimStravaRide: () => void
  onAutoCompleteFromStrava: () => void
}) {
  const accent = kindAccent(session.kind)
  const canTrain = istTrainierbareKraft(session.kind)
  const stravaKm = sumRideKm(session.stravaRides)
  const hasStrava = stravaKm > 0
  const canClaimRide =
    !session.completed && hasStrava && (session.kind === 'ruhe' || session.kind === 'aktiv')
  const canTakeStravaRad =
    !session.completed && hasStrava && session.kind === 'rennrad'

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
            {session.isFlexDay ? (
              <span className="rounded-md bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-300">
                Flex
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

      {hasStrava ? (
        <div className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-rose-300">Strava</p>
          {session.stravaRides!.map((r) => (
            <p key={r.stravaId} className="mt-1 text-xs text-[var(--app-text)]">
              <span className="font-medium">{r.name}</span>
              {' · '}
              {r.distanceKm} km · {r.movingTimeMin} Min.
              {r.avgWatts != null ? ` · ${Math.round(r.avgWatts)} W` : ''}
              {r.avgWkg != null ? ` · ${r.avgWkg} W/kg` : ''}
              {r.elevationM != null && r.elevationM > 0 ? ` · ${Math.round(r.elevationM)} hm` : ''}
            </p>
          ))}
        </div>
      ) : null}

      {!session.completed ? (
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

          {canTakeStravaRad ? (
            <button
              type="button"
              onClick={onAutoCompleteFromStrava}
              className="rounded-xl bg-rose-500/90 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-400"
            >
              Strava übernehmen ({stravaKm} km)
            </button>
          ) : null}

          {session.kind === 'rennrad' && !hasStrava ? (
            <button
              type="button"
              onClick={onCompleteEasy}
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
            >
              Manuell erledigt
            </button>
          ) : null}

          {canClaimRide ? (
            <button
              type="button"
              onClick={onClaimStravaRide}
              className="rounded-xl bg-rose-500/90 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-400"
            >
              Als Rad-Einheit werten ({stravaKm} km)
            </button>
          ) : null}

          {session.isFlexDay && !session.completed ? (
            <div className="flex w-full flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onSetFlexMode('aktiv')}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  session.kind === 'aktiv'
                    ? 'bg-teal-500/90 text-white'
                    : 'border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                }`}
              >
                Als Kurz-Kraft
              </button>
              <button
                type="button"
                onClick={() => onSetFlexMode('ruhe')}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  session.kind === 'ruhe'
                    ? 'bg-slate-500/80 text-white'
                    : 'border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                }`}
              >
                Als Extra-Ruhe
              </button>
            </div>
          ) : null}

          {session.kind === 'ruhe' || session.kind === 'aktiv' || session.isFlexDay ? (
            <>
              <button
                type="button"
                onClick={() => onShift('vor')}
                className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs font-medium text-[var(--app-text-muted)] transition hover:text-[var(--app-text)]"
              >
                ← Nach vorne
              </button>
              <button
                type="button"
                onClick={() => onShift('zurueck')}
                className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs font-medium text-[var(--app-text-muted)] transition hover:text-[var(--app-text)]"
              >
                Nach hinten →
              </button>
              {session.kind === 'ruhe' ? (
                <button
                  type="button"
                  onClick={onCompleteEasy}
                  className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs font-medium text-[var(--app-text-muted)] transition hover:text-[var(--app-text)]"
                >
                  Ruhe abhaken
                </button>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              onClick={onPostpone}
              className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-xs font-medium text-[var(--app-text-muted)] transition hover:text-[var(--app-text)]"
            >
              Auf morgen verschieben
            </button>
          )}
        </div>
      ) : null}

      {canTrain && session.exercises && session.exercises.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-[var(--app-border)] pt-3">
          {session.exercises.map((ex) => (
            <li key={ex.id} className="flex items-center gap-2 text-xs text-[var(--app-text-muted)]">
              {ex.demoGifUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ex.demoGifUrl}
                  alt=""
                  className="!h-8 !w-8 shrink-0 rounded-md object-cover object-center ring-1 ring-[var(--app-border)]"
                  loading="lazy"
                />
              ) : (
                <span aria-hidden>{ex.emoji}</span>
              )}
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

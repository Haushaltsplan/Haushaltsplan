'use client'

import { useEffect, useMemo, useState } from 'react'
import { CoachBanner } from '@/components/trainingsplan/coach-banner'
import { ProgressTimeline } from '@/components/trainingsplan/progress-timeline'
import { WorkoutCard } from '@/components/trainingsplan/workout-card'
import { WorkoutModeModal } from '@/components/trainingsplan/workout-mode-modal'
import {
  PageChrome,
  PageHero,
  PageSection,
  PageSectionPanel,
} from '@/components/page-shell'
import { heuteIsoLocal } from '@/lib/trainingsplan/date-utils'
import {
  TRAININGS_EQUIPMENT,
  TRAININGS_PROFIL,
  TRAININGS_ZIEL,
} from '@/lib/trainingsplan/profile'
import { berechneStats } from '@/lib/trainingsplan/progress'
import { verschiebeAufMorgen } from '@/lib/trainingsplan/reschedule'
import {
  createFreshState,
  loadTrainingsState,
  saveTrainingsState,
} from '@/lib/trainingsplan/storage'
import { buildDefaultWeek } from '@/lib/trainingsplan/weekly-plan'
import type { DaySession, TrainingsPersistState } from '@/lib/trainingsplan/types'
import { supabase } from '@/lib/supabase'

export function TrainingsplanClient() {
  const [state, setState] = useState<TrainingsPersistState | null>(null)
  const [activeWorkout, setActiveWorkout] = useState<DaySession | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const base = loadTrainingsState()

    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      const meta = data.user?.user_metadata as { full_name?: string; name?: string } | undefined
      const fromAuth =
        meta?.full_name?.split(' ')[0] ||
        meta?.name?.split(' ')[0] ||
        data.user?.email?.split('@')[0]
      if (fromAuth && base.coachName === TRAININGS_PROFIL.defaultName) {
        const next = { ...base, coachName: fromAuth }
        saveTrainingsState(next)
        setState(next)
      } else {
        setState(base)
      }
    })

    setState(base)
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!state) return
    saveTrainingsState(state)
  }, [state])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(t)
  }, [toast])

  const heute = heuteIsoLocal()
  const stats = useMemo(
    () => (state ? berechneStats(state.days, state.completedHistory, heute) : null),
    [state, heute],
  )

  const heuteSession = state?.days.find((d) => d.dateIso === heute)
  const weekDays = useMemo(() => {
    if (!state) return []
    return [...state.days].sort((a, b) => a.dateIso.localeCompare(b.dateIso))
  }, [state])

  function patch(updater: (s: TrainingsPersistState) => TrainingsPersistState) {
    setState((prev) => {
      if (!prev) return prev
      return updater(prev)
    })
  }

  function markComplete(dateIso: string) {
    patch((s) => {
      const days = s.days.map((d) => (d.dateIso === dateIso ? { ...d, completed: true } : d))
      const done = days.find((d) => d.dateIso === dateIso)
      const history = [...s.completedHistory]
      if (done && done.kind !== 'ruhe') {
        const key = `${done.dateIso}:${done.kind}`
        if (!history.some((h) => `${h.dateIso}:${h.kind}` === key)) {
          history.push({ dateIso: done.dateIso, kind: done.kind })
        }
      }
      return { ...s, days, completedHistory: history, lastRescheduleNote: null }
    })
    setToast('Einheit gespeichert — stark!')
  }

  function postpone(dateIso: string) {
    if (!state) return
    const result = verschiebeAufMorgen(state.days, dateIso, heute)
    setToast(result.note)
    if (!result.ok) return
    setState({ ...state, days: result.days, lastRescheduleNote: result.note })
  }

  function resetWeek() {
    if (!state) return
    if (!window.confirm('Wochenplan auf Standard zurücksetzen? Fortschritt in der History bleibt.')) {
      return
    }
    setState({
      ...state,
      days: buildDefaultWeek(state.weekStartIso),
      lastRescheduleNote: null,
    })
    setToast('Wochenplan zurückgesetzt.')
  }

  if (!state || !stats) {
    return (
      <PageChrome density="compact" className="max-w-3xl">
        <p className="text-sm text-[var(--app-text-muted)]">Trainingsplan wird geladen …</p>
      </PageChrome>
    )
  }

  return (
    <PageChrome density="compact" className="max-w-3xl">
      <PageHero
        density="compact"
        eyebrow="Personal Coach"
        title="Trainingsplan"
        description={`${TRAININGS_PROFIL.alter} J. · ${TRAININGS_PROFIL.groesseCm} cm · ~${TRAININGS_PROFIL.gewichtKg} kg · Ziel ${TRAININGS_ZIEL.label}`}
        actions={
          <button
            type="button"
            onClick={resetWeek}
            className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-xs text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
          >
            Woche reset
          </button>
        }
      />

      <CoachBanner
        heute={heuteSession}
        name={state.coachName}
        rescheduleNote={state.lastRescheduleNote}
      />

      <ProgressTimeline stats={stats} />

      <PageSection titleId="tp-woche" title="Diese Woche" density="compact">
        <PageSectionPanel density="compact">
          <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-[var(--app-text-muted)]">
            <span className="rounded-lg border border-[var(--app-border)] px-2 py-1">
              Equipment: {TRAININGS_EQUIPMENT.join(' · ')}
            </span>
          </div>
          <div className="space-y-3">
            {weekDays.map((session) => (
              <WorkoutCard
                key={session.id}
                session={session}
                isToday={session.dateIso === heute}
                onStart={() => setActiveWorkout(session)}
                onPostpone={() => postpone(session.dateIso)}
                onCompleteEasy={() => markComplete(session.dateIso)}
              />
            ))}
          </div>
        </PageSectionPanel>
      </PageSection>

      <PageSection titleId="tp-ziele" title="Kernziele" density="compact">
        <PageSectionPanel density="compact">
          <ul className="space-y-2 text-sm text-[var(--app-text-muted)]">
            {TRAININGS_ZIEL.kernziele.map((z) => (
              <li key={z} className="flex gap-2">
                <span className="text-orange-400" aria-hidden>
                  ▸
                </span>
                <span>{z}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-[var(--app-text-muted)]">
            Rennrad ~{TRAININGS_PROFIL.rennradKmJahr} km/Jahr — Kraft ohne unnötige Masse, damit W/kg
            am Berg stimmt.
          </p>
        </PageSectionPanel>
      </PageSection>

      {toast ? (
        <div
          className="fixed bottom-[calc(var(--app-mobile-bottom-nav)+0.75rem)] left-1/2 z-[70] max-w-sm -translate-x-1/2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-center text-sm text-[var(--app-text)] shadow-xl md:bottom-6"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      {activeWorkout ? (
        <WorkoutModeModal
          session={activeWorkout}
          coachName={state.coachName}
          onClose={() => setActiveWorkout(null)}
          onFinish={() => markComplete(activeWorkout.dateIso)}
        />
      ) : null}
    </PageChrome>
  )
}

/** Für SSR/Tests ohne Side-Effects. */
export function trainingsplanEmptyState() {
  return createFreshState()
}

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
import {
  setzeFlexTag,
  verschiebeAufMorgen,
  verschiebeTag,
  werteAlsRennrad,
} from '@/lib/trainingsplan/reschedule'
import {
  createFreshState,
  loadTrainingsState,
  saveTrainingsState,
} from '@/lib/trainingsplan/storage'
import { attachStravaToDays, ridesByDate, sumRideKm } from '@/lib/trainingsplan/strava-rides'
import { buildDefaultWeek } from '@/lib/trainingsplan/weekly-plan'
import type {
  DaySession,
  FlexDayMode,
  LinkedStravaRide,
  TrainingsPersistState,
} from '@/lib/trainingsplan/types'
import type { StravaActivityRow } from '@/lib/strava/strava-types'
import { stravaApiFetch } from '@/lib/strava/strava-api-fetch'
import { supabase } from '@/lib/supabase'

function stripStrava(days: DaySession[]): DaySession[] {
  return days.map(({ stravaRides: _r, ...rest }) => rest)
}

export function TrainingsplanClient() {
  const [state, setState] = useState<TrainingsPersistState | null>(null)
  const [stravaMap, setStravaMap] = useState<Map<string, LinkedStravaRide[]>>(new Map())
  const [activeWorkout, setActiveWorkout] = useState<DaySession | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [stravaStatus, setStravaStatus] = useState<'idle' | 'loading' | 'ok' | 'off'>('idle')

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
    saveTrainingsState({ ...state, days: stripStrava(state.days) })
  }, [state])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    let cancelled = false
    setStravaStatus('loading')

    void (async () => {
      try {
        const res = await stravaApiFetch('/api/strava/activities')
        if (!res.ok) {
          if (!cancelled) setStravaStatus('off')
          return
        }
        const json = (await res.json()) as {
          activities?: StravaActivityRow[]
          omnia_weight_kg?: number | null
        }
        const activities = json.activities ?? []
        if (cancelled) return
        setStravaMap(ridesByDate(activities, json.omnia_weight_kg ?? TRAININGS_PROFIL.gewichtKg))
        setStravaStatus('ok')
      } catch {
        if (!cancelled) setStravaStatus('off')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const heute = heuteIsoLocal()

  const daysWithStrava = useMemo(() => {
    if (!state) return []
    return attachStravaToDays(state.days, stravaMap)
  }, [state, stravaMap])

  const stats = useMemo(
    () => (state ? berechneStats(daysWithStrava, state.completedHistory, heute) : null),
    [state, daysWithStrava, heute],
  )

  const heuteSession = daysWithStrava.find((d) => d.dateIso === heute)
  const weekDays = useMemo(
    () => [...daysWithStrava].sort((a, b) => a.dateIso.localeCompare(b.dateIso)),
    [daysWithStrava],
  )

  function withStrava(days: DaySession[]) {
    return attachStravaToDays(days, stravaMap)
  }

  function patch(updater: (s: TrainingsPersistState) => TrainingsPersistState) {
    setState((prev) => {
      if (!prev) return prev
      return updater(prev)
    })
  }

  function markComplete(dateIso: string) {
    const enriched = daysWithStrava.find((d) => d.dateIso === dateIso)
    patch((s) => {
      const days = s.days.map((d) => (d.dateIso === dateIso ? { ...d, completed: true } : d))
      const history = [...s.completedHistory]
      const kind = enriched?.kind ?? days.find((d) => d.dateIso === dateIso)?.kind
      if (kind && kind !== 'ruhe') {
        const key = `${dateIso}:${kind}`
        if (!history.some((h) => `${h.dateIso}:${h.kind}` === key)) {
          history.push({
            dateIso,
            kind,
            radKm: sumRideKm(enriched?.stravaRides) || undefined,
          })
        }
      }
      return { ...s, days, completedHistory: history, lastRescheduleNote: null }
    })
    setToast('Einheit gespeichert — stark!')
  }

  function postpone(dateIso: string) {
    if (!state) return
    const result = verschiebeAufMorgen(withStrava(state.days), dateIso, heute)
    setToast(result.note)
    if (!result.ok) return
    setState({ ...state, days: stripStrava(result.days), lastRescheduleNote: result.note })
  }

  function shiftDay(dateIso: string, dir: 'vor' | 'zurueck') {
    if (!state) return
    const result = verschiebeTag(withStrava(state.days), dateIso, dir, heute)
    setToast(result.note)
    if (!result.ok) return
    setState({ ...state, days: stripStrava(result.days), lastRescheduleNote: result.note })
  }

  function setFlexMode(mode: FlexDayMode) {
    if (!state) return
    const result = setzeFlexTag(state.days, mode)
    setToast(result.note)
    if (!result.ok) return
    setState({
      ...state,
      days: stripStrava(result.days),
      flexDayMode: mode,
      lastRescheduleNote: result.note,
    })
  }

  function claimStravaAsRide(dateIso: string) {
    if (!state) return
    const result = werteAlsRennrad(withStrava(state.days), dateIso)
    setToast(result.note)
    if (!result.ok) return
    const done = result.days.find((d) => d.dateIso === dateIso)
    const history = [...state.completedHistory]
    if (done) {
      const key = `${done.dateIso}:${done.kind}`
      if (!history.some((h) => `${h.dateIso}:${h.kind}` === key)) {
        history.push({
          dateIso: done.dateIso,
          kind: done.kind,
          radKm: sumRideKm(done.stravaRides),
        })
      }
    }
    setState({
      ...state,
      days: stripStrava(result.days),
      completedHistory: history,
      lastRescheduleNote: result.note,
    })
  }

  function resetWeek() {
    if (!state) return
    if (!window.confirm('Wochenplan auf Standard zurücksetzen? Fortschritt in der History bleibt.')) {
      return
    }
    setState({
      ...state,
      days: buildDefaultWeek(state.weekStartIso, state.flexDayMode ?? 'aktiv'),
      lastRescheduleNote: null,
    })
    setToast('Wochenplan zurückgesetzt — 1 Ruhe · 3 Rad · 2 Kraft · 1 Flex.')
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
          <div className="flex flex-wrap gap-2">
            <span className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-[11px] text-[var(--app-text-muted)]">
              Strava:{' '}
              {stravaStatus === 'loading'
                ? 'lädt…'
                : stravaStatus === 'ok'
                  ? 'verbunden'
                  : stravaStatus === 'off'
                    ? 'nicht verfügbar'
                    : '—'}
            </span>
            <button
              type="button"
              onClick={resetWeek}
              className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-xs text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
            >
              Woche reset
            </button>
          </div>
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
            <span className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-2 py-1 text-teal-200/90">
              1 Ruhe · 3 Rad · 2 Kraft · Flex = Ruhe oder Kurz-Kraft
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
                onShift={(dir) => shiftDay(session.dateIso, dir)}
                onSetFlexMode={setFlexMode}
                onCompleteEasy={() => markComplete(session.dateIso)}
                onClaimStravaRide={() => claimStravaAsRide(session.dateIso)}
                onAutoCompleteFromStrava={() => markComplete(session.dateIso)}
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
            Rennrad ~{TRAININGS_PROFIL.rennradKmJahr} km/Jahr — nie zwei Radtage hintereinander.
            Flex-Tag wählbar als Extra-Ruhe oder Kurz-Kraft. km aus Strava.
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

export function trainingsplanEmptyState() {
  return createFreshState()
}

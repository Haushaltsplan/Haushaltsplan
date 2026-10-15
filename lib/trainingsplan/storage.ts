import { TRAININGS_PROFIL } from '@/lib/trainingsplan/profile'
import { heuteIsoLocal, weekStartMontag } from '@/lib/trainingsplan/date-utils'
import { buildDefaultWeek } from '@/lib/trainingsplan/weekly-plan'
import type { TrainingsPersistState } from '@/lib/trainingsplan/types'

export const TRAININGS_STORAGE_KEY = 'omnia-trainingsplan-v1'

export function createFreshState(coachName?: string): TrainingsPersistState {
  const weekStartIso = weekStartMontag()
  return {
    version: 1,
    weekStartIso,
    days: buildDefaultWeek(weekStartIso),
    completedHistory: [],
    lastRescheduleNote: null,
    coachName: coachName?.trim() || TRAININGS_PROFIL.defaultName,
  }
}

export function loadTrainingsState(): TrainingsPersistState {
  if (typeof window === 'undefined') return createFreshState()
  try {
    const raw = localStorage.getItem(TRAININGS_STORAGE_KEY)
    if (!raw) return createFreshState()
    const parsed = JSON.parse(raw) as TrainingsPersistState
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.days)) {
      return createFreshState()
    }
    return syncWeekIfNeeded(parsed)
  } catch {
    return createFreshState()
  }
}

export function saveTrainingsState(state: TrainingsPersistState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(TRAININGS_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore quota */
  }
}

/**
 * Neue Kalenderwoche → Template neu, History behalten.
 * Innerhalb derselben Woche bleibt der (ggf. umgebaute) Plan unangetastet.
 */
export function syncWeekIfNeeded(state: TrainingsPersistState): TrainingsPersistState {
  const currentStart = weekStartMontag(heuteIsoLocal())
  if (state.weekStartIso === currentStart && state.days.length > 0) {
    return state
  }

  const history = [...state.completedHistory]
  for (const d of state.days) {
    if (!d.completed || d.kind === 'ruhe') continue
    const key = `${d.dateIso}:${d.kind}`
    if (history.some((h) => `${h.dateIso}:${h.kind}` === key)) continue
    history.push({ dateIso: d.dateIso, kind: d.kind })
  }

  return {
    ...state,
    weekStartIso: currentStart,
    days: buildDefaultWeek(currentStart),
    completedHistory: history,
    lastRescheduleNote: null,
  }
}

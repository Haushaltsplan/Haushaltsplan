import { TRAININGS_PROFIL } from '@/lib/trainingsplan/profile'
import { heuteIsoLocal, weekStartMontag } from '@/lib/trainingsplan/date-utils'
import { buildDefaultWeek } from '@/lib/trainingsplan/weekly-plan'
import type { TrainingsPersistState } from '@/lib/trainingsplan/types'

export const TRAININGS_STORAGE_KEY = 'omnia-trainingsplan-v1'
export const TRAININGS_STATE_VERSION = 2 as const

export function createFreshState(coachName?: string): TrainingsPersistState {
  const weekStartIso = weekStartMontag()
  return {
    version: TRAININGS_STATE_VERSION,
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
    const parsed = JSON.parse(raw) as TrainingsPersistState & { version?: number }
    if (!parsed || !Array.isArray(parsed.days)) {
      return createFreshState()
    }
    // v1 → v2: neuer Wochenplan (Aktiv-Tag statt 2. Ruhe)
    if (parsed.version !== TRAININGS_STATE_VERSION) {
      const migrated = createFreshState(parsed.coachName)
      migrated.completedHistory = parsed.completedHistory ?? []
      // Completed-Flags nach Datum übernehmen, wo möglich
      const doneDates = new Set(
        (parsed.days ?? []).filter((d) => d.completed).map((d) => d.dateIso),
      )
      migrated.days = migrated.days.map((d) =>
        doneDates.has(d.dateIso) ? { ...d, completed: true } : d,
      )
      return syncWeekIfNeeded(migrated)
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
    history.push({
      dateIso: d.dateIso,
      kind: d.kind,
      radKm: d.stravaRides?.reduce((s, r) => s + r.distanceKm, 0),
    })
  }

  return {
    ...state,
    version: TRAININGS_STATE_VERSION,
    weekStartIso: currentStart,
    days: buildDefaultWeek(currentStart),
    completedHistory: history,
    lastRescheduleNote: null,
  }
}

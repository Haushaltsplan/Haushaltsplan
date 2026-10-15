import { TRAININGS_PROFIL } from '@/lib/trainingsplan/profile'
import { heuteIsoLocal, weekStartMontag } from '@/lib/trainingsplan/date-utils'
import { buildDefaultWeek } from '@/lib/trainingsplan/weekly-plan'
import type { FlexDayMode, TrainingsPersistState } from '@/lib/trainingsplan/types'

export const TRAININGS_STORAGE_KEY = 'omnia-trainingsplan-v1'
export const TRAININGS_STATE_VERSION = 3 as const
export const DEFAULT_FLEX_MODE: FlexDayMode = 'aktiv'

export function createFreshState(coachName?: string, flexDayMode: FlexDayMode = DEFAULT_FLEX_MODE): TrainingsPersistState {
  const weekStartIso = weekStartMontag()
  return {
    version: TRAININGS_STATE_VERSION,
    weekStartIso,
    days: buildDefaultWeek(weekStartIso, flexDayMode),
    completedHistory: [],
    lastRescheduleNote: null,
    coachName: coachName?.trim() || TRAININGS_PROFIL.defaultName,
    flexDayMode,
  }
}

export function loadTrainingsState(): TrainingsPersistState {
  if (typeof window === 'undefined') return createFreshState()
  try {
    const raw = localStorage.getItem(TRAININGS_STORAGE_KEY)
    if (!raw) return createFreshState()
    const parsed = JSON.parse(raw) as TrainingsPersistState & { version?: number; flexDayMode?: FlexDayMode }
    if (!parsed || !Array.isArray(parsed.days)) {
      return createFreshState()
    }
    const flexMode: FlexDayMode = parsed.flexDayMode === 'ruhe' ? 'ruhe' : 'aktiv'

    if (parsed.version !== TRAININGS_STATE_VERSION) {
      const migrated = createFreshState(parsed.coachName, flexMode)
      migrated.completedHistory = parsed.completedHistory ?? []
      const doneDates = new Set(
        (parsed.days ?? []).filter((d) => d.completed).map((d) => d.dateIso),
      )
      migrated.days = migrated.days.map((d) =>
        doneDates.has(d.dateIso) ? { ...d, completed: true } : d,
      )
      return syncWeekIfNeeded(migrated)
    }

    // Bestehende Woche: Flex-Flag nachziehen falls fehlend (Do-Slot)
    const withFlex = ensureFlexFlag(parsed)
    return syncWeekIfNeeded({ ...withFlex, flexDayMode: flexMode })
  } catch {
    return createFreshState()
  }
}

function ensureFlexFlag(state: TrainingsPersistState): TrainingsPersistState {
  if (state.days.some((d) => d.isFlexDay)) return state
  // Heuristik: Tag zwischen Kraft1 und Tempo-Rad / Donnerstag der Woche
  const days = state.days.map((d) => {
    const isThu = new Date(d.dateIso + 'T12:00:00').getDay() === 4
    if (isThu && (d.kind === 'aktiv' || d.kind === 'ruhe')) {
      return { ...d, isFlexDay: true }
    }
    return d
  })
  return { ...state, days }
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

  const flexMode = state.flexDayMode ?? DEFAULT_FLEX_MODE
  return {
    ...state,
    version: TRAININGS_STATE_VERSION,
    weekStartIso: currentStart,
    days: buildDefaultWeek(currentStart, flexMode),
    completedHistory: history,
    lastRescheduleNote: null,
    flexDayMode: flexMode,
  }
}

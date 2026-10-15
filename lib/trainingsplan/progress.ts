import {
  TRAININGS_PLAN_START_ISO,
  TRAININGS_ZIEL,
} from '@/lib/trainingsplan/profile'
import { addDaysIso, daysBetween, heuteIsoLocal } from '@/lib/trainingsplan/date-utils'
import type { DaySession, SessionKind, TrainingsStats } from '@/lib/trainingsplan/types'

/** Geplante Einheiten/Woche (ohne reine Ruhe). */
const WORKOUTS_PRO_WOCHE = 5 // 3× Rad + 2× Kraft
const KRAFT_PRO_WOCHE = 2
const RAD_KM_PRO_WOCHE_SCHAETZ = 120

export function wochenBisZiel(heute: string = heuteIsoLocal()): number {
  const days = daysBetween(heute, TRAININGS_ZIEL.datumIso)
  return Math.max(0, Math.ceil(days / 7))
}

export function tageBisZiel(heute: string = heuteIsoLocal()): number {
  return Math.max(0, daysBetween(heute, TRAININGS_ZIEL.datumIso))
}

export function geplantWorkoutsBisZiel(): number {
  const totalDays = Math.max(1, daysBetween(TRAININGS_PLAN_START_ISO, TRAININGS_ZIEL.datumIso))
  const weeks = totalDays / 7
  return Math.round(weeks * WORKOUTS_PRO_WOCHE)
}

export function fortschrittProzent(absolviert: number): number {
  const total = geplantWorkoutsBisZiel()
  if (total <= 0) return 0
  return Math.min(100, Math.round((absolviert / total) * 1000) / 10)
}

export function berechneStats(
  days: DaySession[],
  history: { dateIso: string; kind: SessionKind; radKm?: number }[],
  heute: string = heuteIsoLocal(),
): TrainingsStats {
  // History + aktuelle Woche — dedupe nach date+kind
  const seen = new Set<string>()
  let kraft = 0
  let workouts = 0
  let radKm = 0
  for (const h of history) {
    const key = `${h.dateIso}:${h.kind}`
    if (seen.has(key)) continue
    seen.add(key)
    if (h.kind === 'kraft1' || h.kind === 'kraft2') kraft++
    if (h.kind !== 'ruhe') workouts++
    if (h.kind === 'rennrad') radKm += h.radKm ?? RAD_KM_PRO_WOCHE_SCHAETZ / 3
  }
  for (const d of days) {
    if (!d.completed || d.kind === 'ruhe') continue
    const key = `${d.dateIso}:${d.kind}`
    if (seen.has(key)) continue
    seen.add(key)
    if (d.kind === 'kraft1' || d.kind === 'kraft2') kraft++
    workouts++
    if (d.kind === 'rennrad') radKm += schaetzeRadKm(d)
  }

  return {
    kraftAbsolviert: kraft,
    radKm: Math.round(radKm),
    streakTage: berechneStreak(history, days, heute),
    workoutsAbsolviert: workouts,
    workoutsGeplant: geplantWorkoutsBisZiel(),
  }
}

function schaetzeRadKm(d: DaySession): number {
  if (d.rennradFokus === 'longride') return 80
  if (d.rennradFokus === 'tempo') return 45
  return 40
}

function berechneStreak(
  history: { dateIso: string; kind: SessionKind }[],
  days: DaySession[],
  heute: string,
): number {
  const done = new Set<string>()
  for (const h of history) {
    if (h.kind !== 'ruhe') done.add(h.dateIso)
  }
  for (const d of days) {
    if (d.completed && d.kind !== 'ruhe') done.add(d.dateIso)
  }

  let streak = 0
  let cursor = heute
  // Rückwärts: Ruhe unterbricht nicht, fehlendes Workout bricht ab
  for (let i = 0; i < 60; i++) {
    const day = days.find((d) => d.dateIso === cursor)
    const isRuhe = day?.kind === 'ruhe' || (!day && new Date(cursor + 'T12:00:00').getDay() === 1)
    if (done.has(cursor)) {
      streak++
    } else if (isRuhe || cursor > heute) {
      // Ruhe / Zukunft: Streak hält
    } else if (cursor === heute && day && !day.completed) {
      // Heute noch offen: Streak hält bis zum Abend
    } else {
      break
    }
    cursor = addDaysIso(cursor, -1)
  }
  return streak
}

export function zeitFortschrittProzent(heute: string = heuteIsoLocal()): number {
  const total = daysBetween(TRAININGS_PLAN_START_ISO, TRAININGS_ZIEL.datumIso)
  const done = daysBetween(TRAININGS_PLAN_START_ISO, heute)
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((done / total) * 1000) / 10))
}

export { KRAFT_PRO_WOCHE, RAD_KM_PRO_WOCHE_SCHAETZ }

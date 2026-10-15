import {
  AKTIV_EXERCISES,
  KRAFT1_EXERCISES,
  KRAFT2_EXERCISES,
} from '@/lib/trainingsplan/exercises'
import { addDaysIso, weekStartMontag } from '@/lib/trainingsplan/date-utils'
import type { DaySession, FlexDayMode, SessionKind } from '@/lib/trainingsplan/types'

type TemplateSlot = {
  /** 0 = Montag … 6 = Sonntag */
  offset: number
  kind: SessionKind
  title: string
  subtitle: string
  durationMin: number
  rennradFokus?: DaySession['rennradFokus']
  isFlexDay?: boolean
}

/**
 * Standardwoche (immer):
 * - 1 fester Ruhetag (Mo)
 * - 3 Rennradtage (nie hintereinander: Di / Do / So)
 * - 2 schwere Krafttage (Mi / Fr) — nach Rad-Tag kommt Kraft
 * - 1 Flex-Tag (Sa): wählbar Ruhe ODER Kurz-Kraft
 */
export const WOCHEN_TEMPLATE: TemplateSlot[] = [
  {
    offset: 0,
    kind: 'ruhe',
    title: 'Ruhetag',
    subtitle: 'Feste Regeneration — Schlaf, Protein, leichte Mobility',
    durationMin: 0,
  },
  {
    offset: 1,
    kind: 'rennrad',
    title: 'Rennrad — Ausdauer / Intervalle',
    subtitle: 'Z2–Z3 mit kurzen Intervallen · Rumpfspannung im Wiegetritt · Strava zählt',
    durationMin: 75,
    rennradFokus: 'ausdauer',
  },
  {
    offset: 2,
    kind: 'kraft1',
    title: 'Kraft 1 — Druck, Schulter & Core',
    subtitle: 'Push & Core · Hanteln + Körpergewicht · ~45 Min.',
    durationMin: 45,
  },
  {
    offset: 3,
    kind: 'rennrad',
    title: 'Rennrad — Tempo / Zügig',
    subtitle: 'Tempo-Blöcke · W/kg im Blick · Strava zählt',
    durationMin: 70,
    rennradFokus: 'tempo',
  },
  {
    offset: 4,
    kind: 'kraft2',
    title: 'Kraft 2 — Rudern, Rücken, Bizeps & Grip',
    subtitle: 'Pull + Farmer’s Carry · SportPlus + Hanteln · Tag nach dem Rad',
    durationMin: 50,
  },
  {
    offset: 5,
    kind: 'aktiv',
    title: 'Flex-Tag — Kurz-Kraft',
    subtitle: 'Wahlweise: Kurz-Kraft (~20 Min.) oder zweiter Ruhetag',
    durationMin: 22,
    isFlexDay: true,
  },
  {
    offset: 6,
    kind: 'rennrad',
    title: 'Rennrad — Grundlage / Longride',
    subtitle: 'Langer Grundlagensatz · Bergfestigkeit · Strava zählt',
    durationMin: 120,
    rennradFokus: 'longride',
  },
]

export const FLEX_AKTIV_META = {
  kind: 'aktiv' as const,
  title: 'Flex-Tag — Kurz-Kraft',
  subtitle: 'Leichtes Mini-Kraft (~20 Min.) · Core & Grip — kein schwerer Oberkörper',
  durationMin: 22,
}

export const FLEX_RUHE_META = {
  kind: 'ruhe' as const,
  title: 'Flex-Tag — Extra-Ruhe',
  subtitle: 'Zweiter Ruhetag diese Woche — volle Erholung',
  durationMin: 0,
}

export function istSchwereKraft(kind: SessionKind): boolean {
  return kind === 'kraft1' || kind === 'kraft2'
}

export function istRennrad(kind: SessionKind): boolean {
  return kind === 'rennrad'
}

export function istTrainierbareKraft(kind: SessionKind): boolean {
  return kind === 'kraft1' || kind === 'kraft2' || kind === 'aktiv'
}

export function exercisesForKind(kind: SessionKind) {
  if (kind === 'kraft1') return KRAFT1_EXERCISES.map((e) => ({ ...e }))
  if (kind === 'kraft2') return KRAFT2_EXERCISES.map((e) => ({ ...e }))
  if (kind === 'aktiv') return AKTIV_EXERCISES.map((e) => ({ ...e }))
  return undefined
}

export function applyFlexMode(session: DaySession, mode: FlexDayMode): DaySession {
  if (!session.isFlexDay) return session
  const meta = mode === 'aktiv' ? FLEX_AKTIV_META : FLEX_RUHE_META
  return {
    ...session,
    kind: meta.kind,
    title: meta.title,
    subtitle: meta.subtitle,
    durationMin: meta.durationMin,
    rennradFokus: undefined,
    exercises: exercisesForKind(meta.kind),
  }
}

export function sessionFromTemplate(
  weekStart: string,
  slot: TemplateSlot,
  completed = false,
  flexMode: FlexDayMode = 'aktiv',
): DaySession {
  const dateIso = addDaysIso(weekStart, slot.offset)
  let session: DaySession = {
    id: `${dateIso}-${slot.kind}`,
    dateIso,
    weekday: (slot.offset + 1) % 7,
    kind: slot.kind,
    title: slot.title,
    subtitle: slot.subtitle,
    durationMin: slot.durationMin,
    rennradFokus: slot.rennradFokus,
    exercises: exercisesForKind(slot.kind),
    completed,
    isFlexDay: slot.isFlexDay,
  }
  if (slot.isFlexDay) {
    session = applyFlexMode(session, flexMode)
  }
  return session
}

export function buildDefaultWeek(
  weekStartIso?: string,
  flexMode: FlexDayMode = 'aktiv',
): DaySession[] {
  const start = weekStartIso ?? weekStartMontag()
  return WOCHEN_TEMPLATE.map((slot) => sessionFromTemplate(start, slot, false, flexMode))
}

export function kindLabel(kind: SessionKind): string {
  switch (kind) {
    case 'kraft1':
      return 'Kraft 1'
    case 'kraft2':
      return 'Kraft 2'
    case 'aktiv':
      return 'Kurz-Kraft'
    case 'rennrad':
      return 'Rennrad'
    case 'ruhe':
      return 'Ruhe'
  }
}

export function kindEmoji(kind: SessionKind): string {
  switch (kind) {
    case 'kraft1':
      return '🏋️'
    case 'kraft2':
      return '🚣'
    case 'aktiv':
      return '🧘'
    case 'rennrad':
      return '🚴'
    case 'ruhe':
      return '😴'
  }
}

export function kindAccent(kind: SessionKind): string {
  switch (kind) {
    case 'kraft1':
      return 'text-orange-400'
    case 'kraft2':
      return 'text-sky-400'
    case 'aktiv':
      return 'text-teal-400'
    case 'rennrad':
      return 'text-rose-400'
    case 'ruhe':
      return 'text-[var(--app-text-muted)]'
  }
}

import { KRAFT1_EXERCISES, KRAFT2_EXERCISES } from '@/lib/trainingsplan/exercises'
import { addDaysIso, weekStartMontag } from '@/lib/trainingsplan/date-utils'
import type { DaySession, SessionKind } from '@/lib/trainingsplan/types'

type TemplateSlot = {
  /** 0 = Montag … 6 = Sonntag */
  offset: number
  kind: SessionKind
  title: string
  subtitle: string
  durationMin: number
  rennradFokus?: DaySession['rennradFokus']
}

/** Standardwoche laut Spezifikation. */
export const WOCHEN_TEMPLATE: TemplateSlot[] = [
  {
    offset: 0,
    kind: 'ruhe',
    title: 'Ruhetag',
    subtitle: 'Regeneration — Schlaf, Protein, leichte Mobility',
    durationMin: 0,
  },
  {
    offset: 1,
    kind: 'rennrad',
    title: 'Rennrad — Ausdauer / Intervalle',
    subtitle: 'Z2–Z3 mit kurzen Intervallen · Rumpfspannung im Wiegetritt',
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
    kind: 'ruhe',
    title: 'Ruhetag / Aktiv-Pause',
    subtitle: 'Spaziergang, Dehnen, optional leichtes Core',
    durationMin: 20,
  },
  {
    offset: 4,
    kind: 'rennrad',
    title: 'Rennrad — Tempo / Zügig',
    subtitle: 'Tempo-Blöcke · W/kg im Blick behalten',
    durationMin: 70,
    rennradFokus: 'tempo',
  },
  {
    offset: 5,
    kind: 'kraft2',
    title: 'Kraft 2 — Rudern, Rücken, Bizeps & Grip',
    subtitle: 'Pull + Farmer’s Carry · SportPlus + Hanteln',
    durationMin: 50,
  },
  {
    offset: 6,
    kind: 'rennrad',
    title: 'Rennrad — Grundlage / Longride',
    subtitle: 'Langer Grundlagensatz · Bergfestigkeit ohne Extra-Gewicht',
    durationMin: 120,
    rennradFokus: 'longride',
  },
]

export function istSchwereKraft(kind: SessionKind): boolean {
  return kind === 'kraft1' || kind === 'kraft2'
}

export function exercisesForKind(kind: SessionKind) {
  if (kind === 'kraft1') return KRAFT1_EXERCISES.map((e) => ({ ...e }))
  if (kind === 'kraft2') return KRAFT2_EXERCISES.map((e) => ({ ...e }))
  return undefined
}

export function sessionFromTemplate(
  weekStart: string,
  slot: TemplateSlot,
  completed = false,
): DaySession {
  const dateIso = addDaysIso(weekStart, slot.offset)
  return {
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
  }
}

export function buildDefaultWeek(weekStartIso?: string): DaySession[] {
  const start = weekStartIso ?? weekStartMontag()
  return WOCHEN_TEMPLATE.map((slot) => sessionFromTemplate(start, slot))
}

export function kindLabel(kind: SessionKind): string {
  switch (kind) {
    case 'kraft1':
      return 'Kraft 1'
    case 'kraft2':
      return 'Kraft 2'
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
    case 'rennrad':
      return 'text-rose-400'
    case 'ruhe':
      return 'text-[var(--app-text-muted)]'
  }
}

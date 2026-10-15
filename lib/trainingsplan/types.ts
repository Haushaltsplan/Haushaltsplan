export type SessionKind = 'ruhe' | 'rennrad' | 'kraft1' | 'kraft2'

export type RennradFokus = 'ausdauer' | 'tempo' | 'longride'

export type ExerciseId =
  | 'pushups'
  | 'shoulder-press'
  | 'dips'
  | 'plank'
  | 'leg-raises'
  | 'rower-intervals'
  | 'db-row'
  | 'bicep-curls'
  | 'farmers-carry'
  | 'crunches'

export type WorkoutExercise = {
  id: ExerciseId
  name: string
  sets: number
  reps: string
  restSec: number
  tip: string
  /** Öffentliche Demo-Clips (autoplay/loop/muted). Fallback: animierte Form-Hilfe. */
  videoUrl?: string
  emoji: string
}

export type DaySession = {
  id: string
  dateIso: string
  weekday: number
  kind: SessionKind
  title: string
  subtitle: string
  durationMin: number
  rennradFokus?: RennradFokus
  exercises?: WorkoutExercise[]
  completed: boolean
  postponedFrom?: string
}

export type TrainingsStats = {
  kraftAbsolviert: number
  radKm: number
  streakTage: number
  workoutsAbsolviert: number
  workoutsGeplant: number
}

export type TrainingsPersistState = {
  version: 1
  weekStartIso: string
  days: DaySession[]
  completedHistory: { dateIso: string; kind: SessionKind; radKm?: number }[]
  lastRescheduleNote: string | null
  coachName: string
}

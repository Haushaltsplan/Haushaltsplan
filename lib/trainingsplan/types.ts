export type SessionKind = 'ruhe' | 'aktiv' | 'rennrad' | 'kraft1' | 'kraft2'

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
  | 'aktiv-pushups'
  | 'aktiv-plank'
  | 'aktiv-curls'
  | 'aktiv-crunches'

export type WorkoutExercise = {
  id: ExerciseId
  name: string
  sets: number
  reps: string
  restSec: number
  tip: string
  /** Looping Demo einer echten Person (GIF). */
  demoGifUrl?: string
  /** Optionaler MP4-Clip; GIF hat Vorrang wenn beides gesetzt. */
  videoUrl?: string
  emoji: string
}

export type LinkedStravaRide = {
  stravaId: number
  name: string
  distanceKm: number
  movingTimeMin: number
  elevationM: number | null
  avgWatts: number | null
  avgWkg: number | null
  startDateIso: string
}

/** Flex-Slot: wahlweise zweiter Ruhetag oder kurzer Krafttag. */
export type FlexDayMode = 'ruhe' | 'aktiv'

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
  /** Wählbarer Slot (Ruhe ↔ Kurz-Kraft), genau einer pro Woche. */
  isFlexDay?: boolean
  /** Von Strava gematchte Fahrt(en) an diesem Tag. */
  stravaRides?: LinkedStravaRide[]
}

export type TrainingsStats = {
  kraftAbsolviert: number
  radKm: number
  streakTage: number
  workoutsAbsolviert: number
  workoutsGeplant: number
}

export type TrainingsPersistState = {
  version: 3
  weekStartIso: string
  days: DaySession[]
  completedHistory: { dateIso: string; kind: SessionKind; radKm?: number }[]
  lastRescheduleNote: string | null
  coachName: string
  /** Wahl für den Flex-Tag: Ruhe oder Kurz-Kraft. */
  flexDayMode: FlexDayMode
}

import type { WorkoutExercise } from '@/lib/trainingsplan/types'

/**
 * Demo-Clips: Mixkit (lizenzfrei). Bei Ladefehler zeigt ExerciseVideoPlayer
 * eine animierte Form-Hilfe.
 */
const DEMO = {
  push: 'https://assets.mixkit.co/videos/preview/mixkit-athletic-man-doing-push-ups-40405-large.mp4',
  weights: 'https://assets.mixkit.co/videos/preview/mixkit-man-training-with-dumbbells-32846-large.mp4',
  core: 'https://assets.mixkit.co/videos/preview/mixkit-woman-doing-abdominal-exercises-on-a-mat-39766-large.mp4',
  row: 'https://assets.mixkit.co/videos/preview/mixkit-man-working-out-in-a-gym-32847-large.mp4',
} as const

export const KRAFT1_EXERCISES: WorkoutExercise[] = [
  {
    id: 'pushups',
    name: 'Liegestütze',
    sets: 4,
    reps: '10–15',
    restSec: 75,
    tip: 'Ellbogen ~45°, Rumpf fest — Qualität vor Tempo.',
    videoUrl: DEMO.push,
    emoji: '🫸',
  },
  {
    id: 'shoulder-press',
    name: 'Kurzhantel-Schulterdrücken',
    sets: 4,
    reps: '8–12',
    restSec: 90,
    tip: 'Kern angespannt, nicht ins Hohlkreuz fallen.',
    videoUrl: DEMO.weights,
    emoji: '🏋️',
  },
  {
    id: 'dips',
    name: 'Dips (Stuhlkante / Bank)',
    sets: 3,
    reps: '8–12',
    restSec: 75,
    tip: 'Schultern tief, kontrolliert — nicht zu tief bei Beschwerden.',
    videoUrl: DEMO.push,
    emoji: '🪑',
  },
  {
    id: 'plank',
    name: 'Unterarmstütz (Plank)',
    sets: 3,
    reps: '30–45 Sek.',
    restSec: 60,
    tip: 'Gesäß anspannen, Nacken lang — wie am Berg im Wiegetritt.',
    videoUrl: DEMO.core,
    emoji: '🧱',
  },
  {
    id: 'leg-raises',
    name: 'Beinheben im Liegen',
    sets: 3,
    reps: '10–15',
    restSec: 60,
    tip: 'Lendenwirbelsäule am Boden halten — Sixpack-Fokus bis Februar.',
    videoUrl: DEMO.core,
    emoji: '🦵',
  },
]

export const KRAFT2_EXERCISES: WorkoutExercise[] = [
  {
    id: 'rower-intervals',
    name: 'Rudergerät — Intervall-Züge',
    sets: 5,
    reps: '500 m kraftvoll',
    restSec: 90,
    tip: 'Beine → Rumpf → Arme. Power fürs Hausbau-Ziehen.',
    videoUrl: DEMO.row,
    emoji: '🚣',
  },
  {
    id: 'db-row',
    name: 'Einarmiges Kurzhantel-Rudern',
    sets: 4,
    reps: '8–12 / Seite',
    restSec: 75,
    tip: 'Ellbogen nah am Körper, Schulterblatt zurückziehen.',
    videoUrl: DEMO.row,
    emoji: '🔙',
  },
  {
    id: 'bicep-curls',
    name: 'Bizeps- / Hammer-Curls',
    sets: 3,
    reps: '10–12',
    restSec: 60,
    tip: 'Kein Schwung — Unterarme und Grip mitdenken.',
    videoUrl: DEMO.weights,
    emoji: '💪',
  },
  {
    id: 'farmers-carry',
    name: "Farmer's Carry",
    sets: 4,
    reps: '30–40 m',
    restSec: 75,
    tip: 'Schwere Hanteln, aufrechte Haltung — Baustellen-Grip.',
    videoUrl: DEMO.weights,
    emoji: '🏗️',
  },
  {
    id: 'crunches',
    name: 'Crunches / Klappmesser',
    sets: 3,
    reps: '12–20',
    restSec: 60,
    tip: 'Kontrolliert ausatmen bei der Verkürzung.',
    videoUrl: DEMO.core,
    emoji: '🔥',
  },
]

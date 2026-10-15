import type { WorkoutExercise } from '@/lib/trainingsplan/types'

/**
 * Demo-GIFs: echte Personen (TrainAI Creator Media).
 * Looping Form-Demos — zuverlässiger als fragile MP4-CDNs.
 */
const DEMO = {
  pushUp:
    'https://firebasestorage.googleapis.com/v0/b/personalfinanceai-cursor.appspot.com/o/trainai%2Fcreator-media%2F2026-10-07%2Ftrainai-push-up-5d1917138ec8dbbe.gif?alt=media&token=5ffaa42b-b340-4299-b808-b9994c93f8d4',
  shoulderPress:
    'https://firebasestorage.googleapis.com/v0/b/personalfinanceai-cursor.appspot.com/o/trainai%2Fcreator-media%2F2026-10-07%2Ftrainai-standing-dumbbell-shoulder-press-0db9b3923cf09e15.gif?alt=media&token=b04dcaff-ad88-43c5-9364-0326dd988c81',
  closeGripPushUp:
    'https://firebasestorage.googleapis.com/v0/b/personalfinanceai-cursor.appspot.com/o/trainai%2Fcreator-media%2F2026-10-07%2Ftrainai-close-grip-push-up-c38a2f786a7fcc9f.gif?alt=media&token=1a9c37b3-c18f-461c-b769-dec6889c8f91',
  plank:
    'https://firebasestorage.googleapis.com/v0/b/personalfinanceai-cursor.appspot.com/o/trainai%2Fcreator-media%2F2026-10-07%2Ftrainai-forearm-plank-ba1f71356fbbda2f.gif?alt=media&token=abf9279c-c754-4d5f-828b-10ccc346d9e2',
  reverseCrunch:
    'https://firebasestorage.googleapis.com/v0/b/personalfinanceai-cursor.appspot.com/o/trainai%2Fcreator-media%2F2026-10-07%2Ftrainai-reverse-crunch-786e00ff300f8578.gif?alt=media&token=384312f3-f070-419c-ad3c-f98da3580843',
  rower:
    'https://firebasestorage.googleapis.com/v0/b/personalfinanceai-cursor.appspot.com/o/trainai%2Fcreator-media%2F2026-10-07%2Ftrainai-rowing-ergometer-997b61d0dbae9671.gif?alt=media&token=4e89ff1a-4612-4168-a12e-51621375b37c',
  dbRow:
    'https://firebasestorage.googleapis.com/v0/b/personalfinanceai-cursor.appspot.com/o/trainai%2Fcreator-media%2F2026-10-07%2Ftrainai-bench-supported-one-arm-dumbbell-row-48bb524dd1537f19.gif?alt=media&token=02b24102-cc18-4a3d-a08e-05e988965b77',
  hammerCurl:
    'https://firebasestorage.googleapis.com/v0/b/personalfinanceai-cursor.appspot.com/o/trainai%2Fcreator-media%2F2026-10-07%2Ftrainai-dumbbell-hammer-curl-7e3c74033c6ca3d6.gif?alt=media&token=cbb9407d-f56b-44e0-843b-df34d64cbedb',
  farmer:
    'https://firebasestorage.googleapis.com/v0/b/personalfinanceai-cursor.appspot.com/o/trainai%2Fcreator-media%2F2026-10-07%2Ftrainai-farmer-carry-ffa5e99d2e557baa.gif?alt=media&token=9b32f1d7-ab85-45cc-b75b-d6193ea3a2ed',
  crunch:
    'https://firebasestorage.googleapis.com/v0/b/personalfinanceai-cursor.appspot.com/o/trainai%2Fcreator-media%2F2026-10-07%2Ftrainai-bicycle-crunch-f61482af46038244.gif?alt=media&token=17e3dc85-f709-49b3-9048-589c167e50b4',
} as const

export const KRAFT1_EXERCISES: WorkoutExercise[] = [
  {
    id: 'pushups',
    name: 'Liegestütze',
    sets: 4,
    reps: '10–15',
    restSec: 75,
    tip: 'Ellbogen ~45°, Rumpf fest — Qualität vor Tempo.',
    demoGifUrl: DEMO.pushUp,
    emoji: '🫸',
  },
  {
    id: 'shoulder-press',
    name: 'Kurzhantel-Schulterdrücken',
    sets: 4,
    reps: '8–12',
    restSec: 90,
    tip: 'Kern angespannt, nicht ins Hohlkreuz fallen.',
    demoGifUrl: DEMO.shoulderPress,
    emoji: '🏋️',
  },
  {
    id: 'close-grip-pushups',
    name: 'Enge Liegestütze (Trizeps)',
    sets: 3,
    reps: '8–12',
    restSec: 75,
    tip: 'Hände schulterbreit oder enger, Ellbogen nah am Körper — Trizeps ohne Bank/Dip-Barren.',
    demoGifUrl: DEMO.closeGripPushUp,
    emoji: '💪',
  },
  {
    id: 'plank',
    name: 'Unterarmstütz (Plank)',
    sets: 3,
    reps: '30–45 Sek.',
    restSec: 60,
    tip: 'Gesäß anspannen, Nacken lang — wie am Berg im Wiegetritt.',
    demoGifUrl: DEMO.plank,
    emoji: '🧱',
  },
  {
    id: 'leg-raises',
    name: 'Beinheben / Reverse Crunch',
    sets: 3,
    reps: '10–15',
    restSec: 60,
    tip: 'Lendenwirbelsäule am Boden — Sixpack-Fokus bis Februar.',
    demoGifUrl: DEMO.reverseCrunch,
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
    demoGifUrl: DEMO.rower,
    emoji: '🚣',
  },
  {
    id: 'db-row',
    name: 'Einarmiges Kurzhantel-Rudern',
    sets: 4,
    reps: '8–12 / Seite',
    restSec: 75,
    tip: 'Ellbogen nah am Körper, Schulterblatt zurückziehen.',
    demoGifUrl: DEMO.dbRow,
    emoji: '🔙',
  },
  {
    id: 'bicep-curls',
    name: 'Bizeps- / Hammer-Curls',
    sets: 3,
    reps: '10–12',
    restSec: 60,
    tip: 'Kein Schwung — Unterarme und Grip mitdenken.',
    demoGifUrl: DEMO.hammerCurl,
    emoji: '💪',
  },
  {
    id: 'farmers-carry',
    name: "Farmer's Carry",
    sets: 4,
    reps: '30–40 m',
    restSec: 75,
    tip: 'Schwere Hanteln, aufrechte Haltung — Baustellen-Grip.',
    demoGifUrl: DEMO.farmer,
    emoji: '🏗️',
  },
  {
    id: 'crunches',
    name: 'Crunches / Klappmesser',
    sets: 3,
    reps: '12–20',
    restSec: 60,
    tip: 'Kontrolliert ausatmen bei der Verkürzung.',
    demoGifUrl: DEMO.crunch,
    emoji: '🔥',
  },
]

/** Leichtes Mini-Kraft / Active Recovery (~20–25 Min.) — zählt nicht als schwere Kraft. */
export const AKTIV_EXERCISES: WorkoutExercise[] = [
  {
    id: 'aktiv-pushups',
    name: 'Liegestütze (leicht)',
    sets: 2,
    reps: '8–12',
    restSec: 45,
    tip: 'Kurz und sauber — Durchblutung, kein Muskelkater-Monster.',
    demoGifUrl: DEMO.pushUp,
    emoji: '🫸',
  },
  {
    id: 'aktiv-plank',
    name: 'Unterarmstütz',
    sets: 2,
    reps: '20–30 Sek.',
    restSec: 40,
    tip: 'Rumpf fürs Rad und Sixpack — ohne schwere Belastung.',
    demoGifUrl: DEMO.plank,
    emoji: '🧱',
  },
  {
    id: 'aktiv-curls',
    name: 'Leichte Hammer-Curls',
    sets: 2,
    reps: '10–12',
    restSec: 40,
    tip: 'Moderate Hanteln — Arme & Grip, ohne System zu überlasten.',
    demoGifUrl: DEMO.hammerCurl,
    emoji: '💪',
  },
  {
    id: 'aktiv-crunches',
    name: 'Leichte Crunches',
    sets: 2,
    reps: '12–15',
    restSec: 40,
    tip: 'Core-Pflege für Februar — kurz halten.',
    demoGifUrl: DEMO.crunch,
    emoji: '🔥',
  },
]

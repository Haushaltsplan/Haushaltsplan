import { TRAININGS_ZIEL } from '@/lib/trainingsplan/profile'
import type { DaySession, SessionKind } from '@/lib/trainingsplan/types'

function anrede(name: string): string {
  const n = name.trim()
  return n ? n : 'Champion'
}

export function coachTagesbotschaft(
  heute: DaySession | undefined,
  name: string,
  rescheduleNote: string | null,
): { headline: string; body: string; mood: 'kraft' | 'rad' | 'ruhe' | 'feier' | 'shift' } {
  const n = anrede(name)

  if (rescheduleNote) {
    return {
      headline: `${n}, Plan angepasst`,
      body: rescheduleNote,
      mood: 'shift',
    }
  }

  if (!heute) {
    return {
      headline: `Hey ${n}!`,
      body: `Dein Ziel bis ${TRAININGS_ZIEL.label}: Sixpack, Bergfestigkeit und Baustellen-Kraft. Lass uns die Woche clevern.`,
      mood: 'ruhe',
    }
  }

  if (heute.completed) {
    return {
      headline: `Stark, ${n}!`,
      body: 'Einheit abgehakt. Regeneration ist Fortschritt — Protein, Schlaf, morgen wieder da.',
      mood: 'feier',
    }
  }

  switch (heute.kind as SessionKind) {
    case 'kraft1':
      return {
        headline: `Heute stehen Brust & Schultern an, ${n}!`,
        body: `Denk an dein Ziel für Ende Februar. ${heute.durationMin} Minuten volle Konzentration — Druck & Core, ohne Extra-Speck.`,
        mood: 'kraft',
      }
    case 'kraft2':
      return {
        headline: `Rücken, Rudern & Grip, ${n}!`,
        body: 'Farmer’s Carry und SportPlus bauen die Kraft, die du in ~2 Jahren auf der Baustelle brauchst. Plus Sixpack-Fokus.',
        mood: 'kraft',
      }
    case 'rennrad':
      return {
        headline: `Ab aufs Rennrad, ${n}!`,
        body:
          heute.rennradFokus === 'longride'
            ? 'Longride: Grundlage tanken. Achte im Wiegetritt auf Rumpfspannung — W/kg schützen.'
            : heute.rennradFokus === 'tempo'
              ? 'Tempo-Tag: zügig, aber kontrolliert. Relative Leistung am Berg bleibt heilig.'
              : 'Ausdauer/Intervalle: saubere Technik, Rumpf fest — kein totes Gewicht mitschleppen.',
        mood: 'rad',
      }
    case 'ruhe':
    default:
      return {
        headline: `Ruhetag, ${n}`,
        body: 'Regeneration ist Teil des Plans. Leichte Mobility reicht — Schultern und Beine danken es dir für Mittwoch/Samstag.',
        mood: 'ruhe',
      }
  }
}

export function coachRestTip(exerciseName: string, setNr: number, totalSets: number): string {
  const tips = [
    `Satz ${setNr}/${totalSets} bei ${exerciseName} — atme ruhig, nächster Satz wird sauber.`,
    'Trink einen Schluck. Spannung im Rumpf behalten — Sixpack entsteht zwischen den Sätzen.',
    'Schultern tief, Nacken locker. Qualität schlägt Ego-Gewicht.',
    'Denk an W/kg: Kraft aufbauen, ohne dich schwerer zu machen als nötig.',
    'Grip und Haltung — das ist Baustellen-Vorbereitung in Zeitlupe.',
  ]
  return tips[(setNr + exerciseName.length) % tips.length]!
}

export function coachAbschluss(name: string, kind: SessionKind): { title: string; tip: string } {
  const n = anrede(name)
  if (kind === 'rennrad') {
    return {
      title: `Ride done, ${n}!`,
      tip: 'Beine hoch, Protein innerhalb 60 Min. Morgen (oder übermorgen) Kraft — Erholung zählt für W/kg.',
    }
  }
  if (kind === 'kraft1' || kind === 'kraft2') {
    return {
      title: `Kraft-Session geschafft, ${n}!`,
      tip: 'Leichte Dehnung für Brust/Schulter oder Lat. Schlaf ist dein Steroid-Ersatz — Ziel Februar bleibt greifbar.',
    }
  }
  return {
    title: `Gut gemacht, ${n}`,
    tip: 'Weiter so — Konsistenz schlägt Perfektion.',
  }
}

import { gesamtScoreAusPfeilern, type MoatKiBewertung, type MoatKiUrteil } from '@/lib/portfolio-analyse/moat-ki-types'
import type { MoatShortVerdict } from '@/remotion/moat-short-types'

export type MoatRichtung = 'kleiner' | 'ki' | 'groesser'

/** Gleiche Schwellen wie Stempel und Säulenfarbe: ab 8 weit, ab 6 eng, darunter keins. */
export function stufeAusScore(score: number): MoatShortVerdict {
  if (score >= 8) return 'wide'
  if (score >= 6) return 'narrow'
  return 'none'
}

const HOEHER: Record<MoatShortVerdict, MoatShortVerdict> = { none: 'narrow', narrow: 'wide', wide: 'wide' }
const TIEFER: Record<MoatShortVerdict, MoatShortVerdict> = { wide: 'narrow', narrow: 'none', none: 'none' }
const ZIEL: Record<MoatShortVerdict, number> = { wide: 8.5, narrow: 7, none: 5 }

function klemme(n: number): number {
  return Math.max(1, Math.min(10, Math.round(n)))
}

function imBand(score: number, stufe: MoatShortVerdict): boolean {
  if (stufe === 'wide') return score >= 8
  if (stufe === 'narrow') return score >= 6 && score < 8
  return score < 6
}

function schritt(scores: number[], richtung: 1 | -1): number[] | null {
  const offen = scores
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => (richtung > 0 ? s < 10 : s > 1))
    .sort((a, b) => (richtung > 0 ? a.s - b.s : b.s - a.s))
  const ziel = offen[0]
  if (!ziel) return null
  return scores.map((s, i) => (i === ziel.i ? s + richtung : s))
}

/** KI-Säulen bleiben die Form. Größer/Kleiner rückt das Mittel in die nächste Stufe. */
export function pfeilerFuerRichtung(basis: number[], richtung: MoatRichtung): number[] {
  const start = basis.map((s) => klemme(s))
  if (richtung === 'ki' || !start.length) return start
  const jetzt = stufeAusScore(gesamtScoreAusPfeilern(start))
  const zielStufe = richtung === 'groesser' ? HOEHER[jetzt] : TIEFER[jetzt]
  if (zielStufe === jetzt) {
    const delta = richtung === 'groesser' ? 1 : -1
    return start.map((s) => klemme(s + delta))
  }
  const delta = ZIEL[zielStufe] - gesamtScoreAusPfeilern(start)
  let scores = start.map((s) => klemme(s + delta))
  let score = gesamtScoreAusPfeilern(scores)
  const schrittRichtung: 1 | -1 = zielStufe === 'wide' ? 1 : zielStufe === 'none' ? -1 : score < 6 ? 1 : -1
  for (let n = 0; n < 16 && !imBand(score, zielStufe); n++) {
    const next = schritt(scores, schrittRichtung)
    if (!next) break
    scores = next
    score = gesamtScoreAusPfeilern(scores)
  }
  return scores
}

function urteilAusStufe(stufe: MoatShortVerdict): MoatKiUrteil {
  if (stufe === 'wide') return 'tief'
  if (stufe === 'narrow') return 'moderat'
  return 'schwach'
}

/** Kopie des KI-Urteils, eine Stufe höher oder niedriger. Wird nicht in den Moat-Cache geschrieben. */
export function moatMitRichtung(moat: MoatKiBewertung, richtung: 'groesser' | 'kleiner'): MoatKiBewertung {
  const scores = pfeilerFuerRichtung(
    moat.pfeiler.map((p) => p.score),
    richtung,
  )
  const pfeiler = moat.pfeiler.map((p, i) => ({ ...p, score: scores[i] ?? p.score }))
  const score = gesamtScoreAusPfeilern(pfeiler.map((p) => p.score))
  return { ...moat, pfeiler, score, urteil: urteilAusStufe(stufeAusScore(score)) }
}

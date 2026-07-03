/**
 * Nachkauf-Disziplin — Kaufhistorie & Score-Trend.
 * Steuert Ampel und Sparplan, ohne den regelbasierten Score aufzublähen.
 */

import type { NachkaufScanEintrag } from './nachkauf-radar-types'

const FRISCHE_KAUF_TAGE = 45
const SCORE_FALL_DELTA = 12
const SCORE_FALL_FENSTER = 3

/** Nach Anreicherung (Kaufhistorie + Verlauf): Ampel/Hinweise anpassen. */
export function wendeNachkaufDisziplinAn(eintraege: NachkaufScanEintrag[]): void {
  for (const e of eintraege) {
    const hinweise: string[] = []

    const tage = e.kaufhistorie?.tageSeitletztemKauf
    if (tage != null && tage < FRISCHE_KAUF_TAGE) {
      hinweise.push(
        `Zuletzt vor ${tage} Tag${tage === 1 ? '' : 'en'} gekauft — kein Doppel-Nachkauf`,
      )
      if (e.ampel === 'gruen') e.ampel = 'gelb'
    }

    const v = e.scoreVerlauf
    if (v.length >= SCORE_FALL_FENSTER) {
      const slice = v.slice(-SCORE_FALL_FENSTER)
      const delta = slice[slice.length - 1]!.score - slice[0]!.score
      if (delta <= -SCORE_FALL_DELTA) {
        hinweise.push(`Score-Trend: ${delta} Pkt. über ${SCORE_FALL_FENSTER} Scans`)
        if (e.ampel === 'gruen') e.ampel = 'gelb'
      }
    }

    e.disziplinHinweis = hinweise.length > 0 ? hinweise.join(' · ') : null
  }
}

/** Sparplan-Gewichtung: frisch gekaufte Titel runterstufen. */
export function disziplinSparplanFaktor(e: NachkaufScanEintrag): number {
  const tage = e.kaufhistorie?.tageSeitletztemKauf
  if (tage != null && tage < FRISCHE_KAUF_TAGE) return 0.35
  if (e.disziplinHinweis?.includes('Score-Trend')) return 0.65
  return 1
}

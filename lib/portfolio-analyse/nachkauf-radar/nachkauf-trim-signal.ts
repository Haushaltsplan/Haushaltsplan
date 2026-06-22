/**
 * Verkauf-/Trim-Signal-Berechnung.
 *
 * Kein LLM — rein regelbasiert wie der Nachkauf-Score.
 * Ausgelöst bei:
 *  A) Klumpenrisiko (≥ 15 % Depot) UND Score deutlich gesunken (−10 Pkt. gegenüber letztem Scan)
 *  B) Ampel = rot (aktiver Sell-Trigger) UND Depot-Gewicht > 8 %
 *  C) Bewertung extrem überzogen (KGV > 2× historischer Median) UND Depot-Gewicht > 10 %
 *  D) Score-Verfall: letzten 3 Monate konstant sinkend UND zuletzt < 35
 */

import type { NachkaufScanEintrag, TrimSignal } from './nachkauf-radar-types'
import { NACHKAUF_RADAR_WHITELIST } from './nachkauf-radar-whitelist'

export function berechneTrimSignale(eintraege: NachkaufScanEintrag[]): void {
  const whitelistMap = new Map(NACHKAUF_RADAR_WHITELIST.map((p) => [p.isin.toUpperCase(), p]))

  for (const e of eintraege) {
    const signal = berechneTrimSignalFuerEintrag(e, whitelistMap)
    if (signal) e.trimSignal = signal
  }
}

function berechneTrimSignalFuerEintrag(
  e: NachkaufScanEintrag,
  whitelistMap: Map<string, (typeof NACHKAUF_RADAR_WHITELIST)[number]>,
): TrimSignal | undefined {
  const depot = e.depotGewichtPct ?? 0
  const position = whitelistMap.get(e.isin.toUpperCase())
  const verlauf = e.scoreVerlauf

  // A) Aktiver Sell-Trigger + nennenswerte Positionsgröße
  if (e.ampel === 'rot' && !e.sellTriggerOk && depot > 8) {
    return {
      typ: 'trim',
      grund: `Sell-Trigger aktiv bei ${depot.toFixed(1)} % Depot-Anteil — Position auf Kernposition reduzieren prüfen.`,
    }
  }

  // B) Klumpenrisiko + Score deutlich gesunken
  if (e.klumpenrisiko && verlauf.length >= 2) {
    const letzterScore = verlauf.at(-1)!.score
    const vorletzterScore = verlauf.at(-2)!.score
    if (vorletzterScore - letzterScore >= 10) {
      return {
        typ: 'trim',
        grund: `Klumpenrisiko (${depot.toFixed(1)} % Depot) UND Score gesunken (${vorletzterScore} → ${letzterScore}). Position überprüfen.`,
      }
    }
    // Klumpen + Score < 35 = sehr schlecht
    if (e.score < 35) {
      return {
        typ: 'trim',
        grund: `Klumpenrisiko (${depot.toFixed(1)} % Depot) bei niedrigem Score (${e.score}/100). Positionsgröße kritisch prüfen.`,
      }
    }
  }

  // C) Extreme Überbewertung vs. historischer Median + relevante Größe
  if (position?.historischerMedianPe && e.bewertung.forwardPe && depot > 10) {
    const ratio = e.bewertung.forwardPe / position.historischerMedianPe
    if (ratio > 2.0) {
      return {
        typ: 'ueberpruefen',
        grund: `KGV ${e.bewertung.forwardPe.toFixed(0)}× = ${Math.round((ratio - 1) * 100)} % über historischem Median (${position.historischerMedianPe}×). Bei ${depot.toFixed(1)} % Depot-Anteil: Bewertung überprüfen.`,
      }
    }
    if (ratio > 1.5 && depot > 15) {
      return {
        typ: 'ueberpruefen',
        grund: `KGV ${e.bewertung.forwardPe.toFixed(0)}× liegt ${Math.round((ratio - 1) * 100)} % über historischem Median bei ${depot.toFixed(1)} % Depot-Anteil.`,
      }
    }
  }

  // D) Score-Verfall über 3 aufeinanderfolgende Monate + niedriger aktueller Score
  if (verlauf.length >= 3 && e.score < 35) {
    const letzte3 = verlauf.slice(-3)
    const konstantSinkend = letzte3[0]!.score > letzte3[1]!.score && letzte3[1]!.score > letzte3[2]!.score
    if (konstantSinkend) {
      return {
        typ: 'ueberpruefen',
        grund: `Score fällt 3 Monate in Folge (${letzte3[0]!.score} → ${letzte3[1]!.score} → ${letzte3[2]!.score}) und liegt unter 35. Investmenthypothese prüfen.`,
      }
    }
  }

  return undefined
}
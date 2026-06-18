/**
 * Regelbasierter Nachkauf-Score.
 *
 * Kein LLM — der Flash-LLM erklärt anschließend nur, was diese Funktion berechnet.
 * Anti-Halluzinations-Prinzip: Zahlen kommen aus dem Code, nicht vom Modell.
 *
 * Punkte-Verteilung (max 100):
 *  – Mantra-Qualität   0–60   (aus mantraAudit.zusammenfassung)
 *  – Bewertung         0–40   (FCF-Yield + Forward-KGV)
 *  – Sell-Trigger      -25 / -10 / 0
 */

import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import type { NachkaufAmpel, NachkaufBewertungsSignale, NachkaufScoreDetail } from './nachkauf-radar-types'

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Parsed "25,3x" oder "3,5 %" → Zahl. Gibt null bei "–" oder ungültig zurück. */
function parseMetricWert(wert: string): number | null {
  const s = wert
    .replace(/[x%\s]/g, '')
    .replace(/\./g, '')   // Tausender-Punkt entfernen
    .replace(',', '.')    // Dezimal-Komma
  const v = parseFloat(s)
  return Number.isFinite(v) && v > 0 ? v : null
}

// ---------------------------------------------------------------------------
// Bewertungssignale aus FundamentaldatenPaket extrahieren
// ---------------------------------------------------------------------------

export function extrahiereBewertungsSignale(paket: FundamentaldatenPaket): NachkaufBewertungsSignale {
  const km = paket.keyMetrics

  // Forward PE (NTM KGV)
  const fwdPeMetric = km.find((m) => m.id === 'ntm_pe')
  const forwardPe = fwdPeMetric ? parseMetricWert(fwdPeMetric.wert) : null

  // FCF Yield = 1 / (MC / FCF) * 100
  // Versuche NTM zuerst, dann LTM als Fallback
  let fcfYieldPct: number | null = null
  const ntmMcFcf = km.find((m) => m.id === 'ntm_mc_fcf')
  const ltmMcFcf = km.find((m) => m.id === 'ltm_pfcf')
  const mcFcfRaw = ntmMcFcf ?? ltmMcFcf
  if (mcFcfRaw) {
    const ratio = parseMetricWert(mcFcfRaw.wert)
    if (ratio != null && ratio > 0) fcfYieldPct = (1 / ratio) * 100
  }

  // 52w-Drawdown-Proxy: (Hoch - Tief) / Hoch * 100
  // Gibt die Schwankungsbreite an; nicht der exakte Abstand vom Hoch
  let drawdown52wPct: number | null = null
  const w52High = km.find((m) => m.id === '52w_hoch')
  const w52Low = km.find((m) => m.id === '52w_tief')
  if (w52High && w52Low) {
    const h = parseMetricWert(w52High.wert)
    const l = parseMetricWert(w52Low.wert)
    if (h != null && l != null && h > 0 && l > 0 && l < h) {
      drawdown52wPct = ((h - l) / h) * 100
    }
  }

  return { fcfYieldPct, forwardPe, drawdown52wPct }
}

// ---------------------------------------------------------------------------
// Score berechnen
// ---------------------------------------------------------------------------

export function berechneNachkaufScore(
  paket: FundamentaldatenPaket,
  signale: NachkaufBewertungsSignale,
): NachkaufScoreDetail {
  const { mantra } = paket
  const sum = mantra.zusammenfassung

  // --- Mantra-Score (0-60) ---
  let mantraScore: number
  if (sum.bewertbar > 0) {
    mantraScore = Math.round((sum.erfuellt / sum.bewertbar) * 60)
  } else {
    // Qualitative Einschätzung aus Ampel
    mantraScore = mantra.ampel === 'gruen' ? 45 : mantra.ampel === 'gelb' ? 30 : mantra.ampel === 'grau' ? 25 : 10
  }

  // --- Sell-Trigger-Penalty ---
  const hatWarnung = mantra.sellTriggerWatch.some((w) => w.status === 'warnung')
  const hatBeobachten = mantra.sellTriggerWatch.some((w) => w.status === 'beobachten')
  const sellTriggerPenalty = hatWarnung ? -25 : hatBeobachten ? -10 : 0

  // --- Bewertungs-Score (0-40) ---
  const { fcfYieldPct, forwardPe } = signale

  // FCF-Rendite (0–22 Punkte)
  let fcfPunkte = 0
  if (fcfYieldPct != null) {
    if (fcfYieldPct >= 5) fcfPunkte = 22
    else if (fcfYieldPct >= 3.5) fcfPunkte = 17
    else if (fcfYieldPct >= 2.5) fcfPunkte = 12
    else if (fcfYieldPct >= 1.5) fcfPunkte = 6
    else fcfPunkte = 0
  } else {
    fcfPunkte = 8 // neutral bei fehlenden Daten
  }

  // Forward-KGV (0–18 Punkte)
  let kgvPunkte = 0
  if (forwardPe != null) {
    if (forwardPe < 15) kgvPunkte = 18
    else if (forwardPe < 20) kgvPunkte = 14
    else if (forwardPe < 25) kgvPunkte = 9
    else if (forwardPe < 35) kgvPunkte = 4
    else kgvPunkte = 0
  } else {
    kgvPunkte = 7 // neutral bei fehlenden Daten
  }

  const bewertungsScore = fcfPunkte + kgvPunkte

  const roh = mantraScore + sellTriggerPenalty + bewertungsScore
  const gesamt = Math.max(0, Math.min(100, roh))

  return { mantraScore, bewertungsScore, sellTriggerPenalty, gesamt }
}

// ---------------------------------------------------------------------------
// Ampel ableiten
// ---------------------------------------------------------------------------

export function leiteNachkaufAmpelAb(
  paket: FundamentaldatenPaket,
  score: NachkaufScoreDetail,
  signale: NachkaufBewertungsSignale,
): NachkaufAmpel {
  const { mantra } = paket
  const hatWarnung = mantra.sellTriggerWatch.some((w) => w.status === 'warnung')

  // Rot: Sell-Trigger aktiv oder Mantra rot
  if (hatWarnung || mantra.ampel === 'rot') return 'rot'

  // Grau: Zu wenig Daten
  if (mantra.ampel === 'grau' && mantra.zusammenfassung.bewertbar === 0) return 'grau'

  const { fcfYieldPct, forwardPe } = signale

  // Bewertung zu hoch? Quality kann intakt sein, aber der Preis stimmt nicht.
  // Teuer: Beide Signale zeigen hohe Bewertung (oder nur eins, wenn das andere fehlt)
  const hatDatenFuerBewertung = fcfYieldPct != null || forwardPe != null
  if (hatDatenFuerBewertung) {
    const fcfZuTeuer = fcfYieldPct != null && fcfYieldPct < 1.5
    const kgvZuTeuer = forwardPe != null && forwardPe > 38
    const nurFcfDaten = fcfYieldPct != null && forwardPe == null
    const nurKgvDaten = forwardPe != null && fcfYieldPct == null

    if (
      (fcfZuTeuer && kgvZuTeuer) ||
      (fcfZuTeuer && nurFcfDaten) ||
      (kgvZuTeuer && nurKgvDaten)
    ) {
      // Nur als "teuer" markieren wenn operative Qualität ok ist
      // (mantra.ampel === 'rot' wurde bereits oben abgefangen)
      if (score.mantraScore >= 30) {
        return 'teuer'
      }
    }
  }

  // Grün: guter Score, keine Warnungen
  if (score.gesamt >= 65) return 'gruen'

  // Gelb: alles dazwischen
  if (score.gesamt >= 35) return 'gelb'

  return 'rot'
}

// ---------------------------------------------------------------------------
// Monatliche Empfehlung
// ---------------------------------------------------------------------------

import type { MonatsEmpfehlung, NachkaufScanEintrag } from './nachkauf-radar-types'

export function berechneMonatsEmpfehlung(ergebnisse: NachkaufScanEintrag[]): MonatsEmpfehlung {
  const gruen = ergebnisse.filter((e) => e.ampel === 'gruen')
  const teuer = ergebnisse.filter((e) => e.ampel === 'teuer')
  const gelb = ergebnisse.filter((e) => e.ampel === 'gelb')
  const rot = ergebnisse.filter((e) => e.ampel === 'rot')

  if (gruen.length > 0) {
    // Kandidaten mit Klumpenrisiko-Warnung nach hinten sortieren
    const sortiertGruen = [...gruen].sort((a, b) => {
      if (a.klumpenrisiko !== b.klumpenrisiko) return a.klumpenrisiko ? 1 : -1
      return b.score - a.score
    })
    const kandidaten = sortiertGruen.slice(0, 3).map((e) => e.ticker)
    const klumpen = sortiertGruen.filter((e) => e.klumpenrisiko).map((e) => e.ticker)

    const klumpenHinweis =
      klumpen.length > 0
        ? ` Achtung Klumpenrisiko: ${klumpen.join(', ')} bereits ≥15 % des Depots — dort nur sehr selektiv nachkaufen.`
        : ''

    return {
      typ: 'nachkauf',
      tickers: kandidaten,
      text:
        `${gruen.length} Nachkauf-Kandidat${gruen.length > 1 ? 'en' : ''} identifiziert. ` +
        `Stärkste Signale: ${kandidaten.join(', ')}. ` +
        `Deep Research vor dem Kauf empfohlen.${klumpenHinweis}`,
    }
  }

  if (teuer.length > 0 && rot.length === 0) {
    const beste = teuer.sort((a, b) => b.score - a.score)[0]!
    return {
      typ: 'sparen',
      text:
        `Alle ${teuer.length} Quality-Positionen operativ intakt, aber aktuell zu hoch bewertet. ` +
        `Liquidität halten (2,25 % p.a. auf Trade Republic). ` +
        `Erste Gelegenheit bei Rücksetzern: ${beste.ticker}.`,
    }
  }

  if (gelb.length > 0 && gruen.length === 0) {
    const kandidat = gelb.sort((a, b) => b.score - a.score)[0]!
    return {
      typ: 'beobachten',
      text:
        `${gelb.length} Titel im Beobachtungsmodus — kein klares Grün-Signal. ` +
        `Bester Kandidat für Deep Research: ${kandidat.ticker}. ` +
        `Alternativ: Zinsen sammeln bis das Signal klarer wird.`,
    }
  }

  return {
    typ: 'sparen',
    text:
      'Kein attraktiver Nachkauf-Kandidat im Depot identifiziert. ' +
      'Liquidität auf Trade Republic (2,25 % p.a.) parken bis zum nächsten Scan.',
  }
}

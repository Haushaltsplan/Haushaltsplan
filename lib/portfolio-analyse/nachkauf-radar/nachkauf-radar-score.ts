/**
 * Regelbasierter Nachkauf-Score.
 *
 * Anti-Halluzinations-Prinzip: Zahlen kommen aus dem Code, nicht vom LLM.
 * Das Flash-LLM erklärt anschließend nur, was diese Funktion berechnet.
 *
 * Punkte-Verteilung (max 100):
 *  – Mantra-Qualität             0–60   (aus mantraAudit.zusammenfassung)
 *  – Bewertung (absolut)         0–40   (FCF-Yield + Forward-KGV)
 *  – Historischer Bonus/Malus   –10 bis +10  (relativ zum 5-Jahres-Median)
 *  – Sell-Trigger               –25 / –10 / 0
 */

import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import type {
  MonatsEmpfehlung,
  NachkaufAmpel,
  NachkaufBewertungsSignale,
  NachkaufScoreDetail,
  NachkaufScanEintrag,
  SparplanPosten,
} from './nachkauf-radar-types'
import type { WhitelistPosition } from './nachkauf-radar-whitelist'
import { NACHKAUF_RADAR_WHITELIST, type RisikoKlasse } from './nachkauf-radar-whitelist'

// ---------------------------------------------------------------------------
// Risiko-Hilfsfunktion
// ---------------------------------------------------------------------------

/** Maximale monatliche Investition je Risikoklasse für den Sparplan. */
const SPARPLAN_RISIKO_CAP: Record<RisikoKlasse, number> = {
  konservativ: 350,
  moderat: 200,
  spekulativ: 100,
}

function risikoKlasseVon(isin: string): RisikoKlasse {
  return NACHKAUF_RADAR_WHITELIST.find((p) => p.isin === isin)?.risikoKlasse ?? 'moderat'
}

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

export function extrahiereBewertungsSignale(
  paket: FundamentaldatenPaket,
  position?: WhitelistPosition,
): NachkaufBewertungsSignale {
  const km = paket.keyMetrics

  // Forward PE (NTM KGV)
  const fwdPeMetric = km.find((m) => m.id === 'ntm_pe')
  const forwardPe = fwdPeMetric ? parseMetricWert(fwdPeMetric.wert) : null

  // FCF Yield = 1 / (MC / FCF) * 100
  let fcfYieldPct: number | null = null
  const ntmMcFcf = km.find((m) => m.id === 'ntm_mc_fcf')
  const ltmMcFcf = km.find((m) => m.id === 'ltm_pfcf')
  const mcFcfRaw = ntmMcFcf ?? ltmMcFcf
  if (mcFcfRaw) {
    const ratio = parseMetricWert(mcFcfRaw.wert)
    if (ratio != null && ratio > 0) fcfYieldPct = (1 / ratio) * 100
  }

  // 52w-Drawdown-Proxy
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

  // Historischer Premium/Discount
  let premiumDiscountPct: number | null = null
  if (position?.historischerMedianPe && forwardPe) {
    // Positiv = teurer als Median, Negativ = günstiger
    premiumDiscountPct = ((forwardPe - position.historischerMedianPe) / position.historischerMedianPe) * 100
  } else if (position?.historischerMedianFcfYield && fcfYieldPct) {
    // Bei FCF-Yield: höherer Yield = günstiger → invertiert
    premiumDiscountPct = ((position.historischerMedianFcfYield - fcfYieldPct) / position.historischerMedianFcfYield) * 100
  }

  return {
    fcfYieldPct,
    forwardPe,
    drawdown52wPct,
    premiumDiscountPct,
    historischerMedianFcfYield: position?.historischerMedianFcfYield ?? null,
  }
}

// ---------------------------------------------------------------------------
// Score berechnen
// ---------------------------------------------------------------------------

export function berechneNachkaufScore(
  paket: FundamentaldatenPaket,
  signale: NachkaufBewertungsSignale,
  position?: WhitelistPosition,
): NachkaufScoreDetail {
  const { mantra } = paket
  const sum = mantra.zusammenfassung

  // --- Mantra-Score (0–60) ---
  //
  // Drei Datensituationen:
  //  A) Gut bewertbar (≥3 bewertbar): Score proportional zu erfüllten Metriken.
  //  B) Wenig bewertbar (1–2): Score gedämpft — nie vollen Bonus/Penalty aus 1 Metrik.
  //  C) Nur qualitativ: halbe Kredit-Vergabe.
  //
  // "qualitativ" = Proxy-Bewertung (z. B. ROE statt ROIC, Yahoo-Marge statt Macrotrends):
  //  Zählt als 0.5 × erfüllt und 0.5 × bewertbar (Teilpunkt).
  let mantraScore: number
  const effektivErfuellt = sum.erfuellt + sum.qualitativ * 0.5
  const effektivBewertbar = sum.bewertbar + sum.qualitativ * 0.5

  if (effektivBewertbar >= 3) {
    // Gut bewertbar: voller Score
    mantraScore = Math.round((effektivErfuellt / effektivBewertbar) * 60)
  } else if (effektivBewertbar >= 1) {
    // Wenig Daten: Score dämpfen — max. 40 Punkte wenn nur 1–2 Metriken da sind
    const rohScore = (effektivErfuellt / effektivBewertbar) * 60
    const konfidenz = Math.min(1, effektivBewertbar / 3)
    const basisScore = 20 // Baseline: etablierte Qualitätsfirma hat im Zweifelsfall solide Basis
    mantraScore = Math.round(basisScore + (rohScore - basisScore) * konfidenz)
  } else {
    // Keine Daten: Ampel-basierter Fallback
    mantraScore = mantra.ampel === 'gruen' ? 40 : mantra.ampel === 'gelb' ? 28 : mantra.ampel === 'grau' ? 22 : 10
  }

  // --- Sell-Trigger-Penalty ---
  const hatWarnung = mantra.sellTriggerWatch.some((w) => w.status === 'warnung')
  const hatBeobachten = mantra.sellTriggerWatch.some((w) => w.status === 'beobachten')
  const sellTriggerPenalty = hatWarnung ? -25 : hatBeobachten ? -10 : 0

  // --- Bewertungs-Score (0–40) — absolut ---
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

  // --- Historischer Bonus/Malus (–10 bis +10) ---
  // Vergleich des aktuellen KGVs mit dem historischen 5-Jahres-Median.
  // Günstig vs. eigener Geschichte = Bonus; teuer = Malus.
  let historischerBewertungsBonus = 0
  const pd = signale.premiumDiscountPct
  if (pd !== null) {
    if (pd <= -20) historischerBewertungsBonus = 10       // ≥20 % Discount
    else if (pd <= -10) historischerBewertungsBonus = 6   // 10–20 % Discount
    else if (pd <= -5) historischerBewertungsBonus = 3    // 5–10 % Discount
    else if (pd <= 5) historischerBewertungsBonus = 0     // Nahe Median
    else if (pd <= 15) historischerBewertungsBonus = -4   // 5–15 % Premium
    else if (pd <= 25) historischerBewertungsBonus = -7   // 15–25 % Premium
    else historischerBewertungsBonus = -10                // >25 % Premium
  } else if (position?.historischerMedianPe || position?.historischerMedianFcfYield) {
    // Historischer Median vorhanden, aber aktuelle Daten fehlen → neutral
    historischerBewertungsBonus = 0
  }

  const roh = mantraScore + sellTriggerPenalty + bewertungsScore + historischerBewertungsBonus
  const gesamt = Math.max(0, Math.min(100, roh))

  return { mantraScore, bewertungsScore, sellTriggerPenalty, historischerBewertungsBonus, gesamt }
}

// ---------------------------------------------------------------------------
// Kaufzonen-Trigger prüfen
// ---------------------------------------------------------------------------

export function pruefKaufTrigger(
  signale: NachkaufBewertungsSignale,
  position: WhitelistPosition,
): { ausgeloest: boolean; text: string | null } {
  const trigger = position.kaufTrigger
  if (!trigger) return { ausgeloest: false, text: null }

  const { fcfYieldPct, forwardPe } = signale
  const bedingungen: string[] = []

  const peTrigger = trigger.peMax != null && forwardPe != null && forwardPe < trigger.peMax
  const fcfTrigger = trigger.fcfYieldMin != null && fcfYieldPct != null && fcfYieldPct >= trigger.fcfYieldMin

  if (peTrigger) bedingungen.push(`Forward P/E ${forwardPe?.toFixed(1)}× < Schwelle ${trigger.peMax}×`)
  if (fcfTrigger) bedingungen.push(`FCF-Rendite ${fcfYieldPct?.toFixed(1)} % > Schwelle ${trigger.fcfYieldMin} %`)

  if (bedingungen.length === 0) return { ausgeloest: false, text: null }

  const triggerText = [trigger.notiz ?? '', ...bedingungen].filter(Boolean).join(' — ')
  return { ausgeloest: true, text: triggerText }
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

  if (hatWarnung || mantra.ampel === 'rot') return 'rot'
  if (mantra.ampel === 'grau' && mantra.zusammenfassung.bewertbar === 0) return 'grau'

  const { fcfYieldPct, forwardPe } = signale
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
      if (score.mantraScore >= 30) return 'teuer'
    }
  }

  if (score.gesamt >= 65) return 'gruen'
  if (score.gesamt >= 35) return 'gelb'
  return 'rot'
}

// ---------------------------------------------------------------------------
// Sparplan-Allokation berechnen (500 € Monatsbudget)
// ---------------------------------------------------------------------------

const SPARPLAN_BUDGET_EUR = 500

/**
 * Verteilt das Monatsbudget proportional auf Grün-Kandidaten.
 * - Klumpenrisiko-Positionen erhalten max. 20 % des Budgets.
 * - Risikoklasse begrenzt den Maximalbetrag (konservativ 350 €, moderat 200 €, spekulativ 100 €).
 * - Trigger-Positionen erhalten einen 20 % Bonus-Gewichtung.
 * - Mindestposten: 100 € (sonst weggelassen).
 */
function berechneSparplanAllokation(gruenKandidaten: NachkaufScanEintrag[]): SparplanPosten[] {
  if (gruenKandidaten.length === 0) return []

  const gewichte = gruenKandidaten.map((e) => {
    let g = e.score
    if (e.kaufTriggerAusgeloest) g *= 1.2
    if (e.klumpenrisiko) g *= 0.5
    return { eintrag: e, gewicht: g }
  })

  const summeGewichte = gewichte.reduce((acc, gw) => acc + gw.gewicht, 0)
  if (summeGewichte <= 0) return []

  const posten: SparplanPosten[] = []
  let restBudget = SPARPLAN_BUDGET_EUR
  const maxProKlumpen = SPARPLAN_BUDGET_EUR * 0.2

  for (const { eintrag, gewicht } of gewichte) {
    const risiko = risikoKlasseVon(eintrag.isin)
    const maxBetrag = eintrag.klumpenrisiko
      ? Math.min(SPARPLAN_RISIKO_CAP[risiko], maxProKlumpen)
      : SPARPLAN_RISIKO_CAP[risiko]

    let betrag = (gewicht / summeGewichte) * SPARPLAN_BUDGET_EUR
    betrag = Math.min(betrag, maxBetrag)
    betrag = Math.round(betrag / 10) * 10

    if (betrag < 100) continue
    restBudget -= betrag

    let begruendung = `Score ${eintrag.score}/100 · Risiko: ${risiko}`
    if (eintrag.kaufTriggerAusgeloest) begruendung += ' · Kaufzone ausgelöst'
    if (eintrag.klumpenrisiko) begruendung += ' · Klumpenrisiko-Cap'

    posten.push({ ticker: eintrag.ticker, name: eintrag.name, betragEur: betrag, begruendung })
  }

  // Restbetrag dem besten konservativen Kandidaten ohne Klumpen-Cap gutschreiben
  if (restBudget >= 100 && posten.length > 0) {
    const konservativIdx = gruenKandidaten.findIndex(
      (e, i) => posten[i] && risikoKlasseVon(e.isin) === 'konservativ' && !e.klumpenrisiko,
    )
    const target = konservativIdx >= 0 ? konservativIdx : 0
    if (posten[target]) {
      const risiko = risikoKlasseVon(gruenKandidaten[target]!.isin)
      posten[target]!.betragEur = Math.min(posten[target]!.betragEur + restBudget, SPARPLAN_RISIKO_CAP[risiko])
    }
  }

  return posten
}

// ---------------------------------------------------------------------------
// Monatliche Empfehlung
// ---------------------------------------------------------------------------

export function berechneMonatsEmpfehlung(ergebnisse: NachkaufScanEintrag[]): MonatsEmpfehlung {
  const gruen = ergebnisse.filter((e) => e.ampel === 'gruen')
  const teuer = ergebnisse.filter((e) => e.ampel === 'teuer')
  const gelb = ergebnisse.filter((e) => e.ampel === 'gelb')
  const rot = ergebnisse.filter((e) => e.ampel === 'rot')

  if (gruen.length > 0) {
    const sortiertGruen = [...gruen].sort((a, b) => {
      if (a.klumpenrisiko !== b.klumpenrisiko) return a.klumpenrisiko ? 1 : -1
      if (a.kaufTriggerAusgeloest !== b.kaufTriggerAusgeloest) return a.kaufTriggerAusgeloest ? -1 : 1
      return b.score - a.score
    })

    const kandidaten = sortiertGruen.slice(0, 3)
    const kandidatenTicker = kandidaten.map((e) => e.ticker)
    const klumpen = sortiertGruen.filter((e) => e.klumpenrisiko).map((e) => e.ticker)
    const trigger = sortiertGruen.filter((e) => e.kaufTriggerAusgeloest).map((e) => e.ticker)

    const klumpenHinweis =
      klumpen.length > 0
        ? ` Achtung Klumpenrisiko: ${klumpen.join(', ')} bereits ≥15 % des Depots — dort nur sehr selektiv.`
        : ''

    const triggerHinweis =
      trigger.length > 0
        ? ` Kaufzonen-Trigger ausgelöst bei: ${trigger.join(', ')}.`
        : ''

    const sparplanAllokation = berechneSparplanAllokation(kandidaten)

    return {
      typ: 'nachkauf',
      tickers: kandidatenTicker,
      text:
        `${gruen.length} Nachkauf-Kandidat${gruen.length > 1 ? 'en' : ''} identifiziert. ` +
        `Stärkste Signale: ${kandidatenTicker.join(', ')}.${triggerHinweis}${klumpenHinweis} ` +
        `Deep Research vor dem Kauf empfohlen.`,
      sparplanAllokation,
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

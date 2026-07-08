/**
 * Regelbasierter Nachkauf-Score.
 *
 * Anti-Halluzinations-Prinzip: Zahlen kommen aus dem Code, nicht vom LLM.
 * Das Flash-LLM erklärt anschließend nur, was diese Funktion berechnet.
 *
 * Punkte-Verteilung (Ziel: 0–100):
 *  – Mantra-Qualität             0–50
 *  – Bewertung (personalisiert)  0–35
 *  – Historischer Bonus/Malus   –10 bis +10
 *  – Momentum                    0–12
 *  – Struktur & Risiko          –10 bis +5
 *  – Drawdown-Chance             0–5
 *  – Insider-Käufe               0–4
 *  – Kauftrigger-Boost           0–7
 *  – Regime / Earnings / DR     –15 bis +4
 *  – Sell-Trigger               –25 / –10 / 0
 */

import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import type { HistorischeBewertung } from '@/lib/portfolio-analyse/fundamentaldaten-historische-bewertung'
import type {
  MonatsEmpfehlung,
  NachkaufAmpel,
  NachkaufBewertungsSignale,
  NachkaufScoreDetail,
  NachkaufScanEintrag,
  InsiderKauf,
  SparplanPosten,
} from './nachkauf-radar-types'
import type { WhitelistPosition } from './nachkauf-radar-whitelist'
import { NACHKAUF_RADAR_WHITELIST, type RisikoKlasse } from './nachkauf-radar-whitelist'
import type { NachkaufZusatzSignale } from './nachkauf-zusatz-signale-server'
import { berechnePrognoseMomentumDelta } from './nachkauf-prognose-server'
import { disziplinSparplanFaktor } from './nachkauf-disziplin-server'
import {
  berechneDeepResearchMalus,
  berechneEarningsFensterMalus,
  berechneKauftriggerBoost,
  berechneKombiniertRang,
  berechnePersonalisierteBewertung,
  berechneQualitaetsRang,
  berechneRegimeDelta,
  berechneTimingRang,
  gelbSchwelle,
  istKalibriertesGruen,
  kalibrierungBonusFuerScore,
  segmentQualitaetVonQuelle,
  type NachkaufBatchKontext,
} from './nachkauf-ranking-optimierung'

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
    .replace(/[x%\s$€]/g, '')
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
  historisch?: HistorischeBewertung | null,
  zusatz?: NachkaufZusatzSignale | null,
): NachkaufBewertungsSignale {
  const km = paket.keyMetrics

  // Forward PE (NTM KGV)
  const fwdPeMetric = km.find((m) => m.id === 'ntm_pe')
  const forwardPe = fwdPeMetric ? parseMetricWert(fwdPeMetric.wert) : null

  const evEbitdaMetric = km.find((m) => m.id === 'ntm_ev_ebitda')
  const ntmEvEbitda = evEbitdaMetric ? parseMetricWert(evEbitdaMetric.wert) : null

  // FCF Yield = 1 / (MC / FCF) * 100
  let fcfYieldPct: number | null = null
  const ntmMcFcf = km.find((m) => m.id === 'ntm_mc_fcf')
  const ltmMcFcf = km.find((m) => m.id === 'ltm_pfcf')
  const mcFcfRaw = ntmMcFcf ?? ltmMcFcf
  if (mcFcfRaw) {
    const ratio = parseMetricWert(mcFcfRaw.wert)
    if (ratio != null && ratio > 0) fcfYieldPct = (1 / ratio) * 100
  }

  // Echter Drawdown: aktueller Kurs vs. 52-Wochen-Hoch
  let drawdown52wPct: number | null = null
  const w52High = km.find((m) => m.id === '52w_hoch')
  const kursAktuell = km.find((m) => m.id === 'kurs_aktuell')
  if (w52High && kursAktuell) {
    const h = parseMetricWert(w52High.wert)
    const kurs = parseMetricWert(kursAktuell.wert)
    if (h != null && kurs != null && h > 0 && kurs > 0 && kurs <= h) {
      drawdown52wPct = ((h - kurs) / h) * 100
    }
  }

  const medianPe =
    historisch?.medianPe5y ?? position?.historischerMedianPe ?? null
  const medianFcfYield =
    historisch?.medianFcfYield5y ?? position?.historischerMedianFcfYield ?? null
  let historischQuelle: 'macrotrends' | 'whitelist' | null = null
  if (historisch?.medianPe5y != null || historisch?.medianFcfYield5y != null) {
    historischQuelle = 'macrotrends'
  } else if (position?.historischerMedianPe != null || position?.historischerMedianFcfYield != null) {
    historischQuelle = 'whitelist'
  }

  // Historischer Premium/Discount — KGV und FCF-Median gleichwertig
  let premiumDiscountPct: number | null = null
  let pdPe: number | null = null
  let pdFcf: number | null = null
  if (medianPe && forwardPe) pdPe = ((forwardPe - medianPe) / medianPe) * 100
  if (medianFcfYield && fcfYieldPct) {
    pdFcf = ((medianFcfYield - fcfYieldPct) / medianFcfYield) * 100
  }
  if (pdPe != null && pdFcf != null) premiumDiscountPct = (pdPe + pdFcf) / 2
  else if (pdPe != null) premiumDiscountPct = pdPe
  else if (pdFcf != null) premiumDiscountPct = pdFcf

  return {
    fcfYieldPct,
    forwardPe,
    ntmEvEbitda,
    drawdown52wPct,
    premiumDiscountPct,
    historischerMedianPe: medianPe,
    historischerMedianFcfYield: medianFcfYield,
    historischQuelle,
    epsBeatRatePct: zusatz?.epsBeatRatePct ?? null,
    capitalAllocationScorePct: zusatz?.capitalAllocationScorePct ?? null,
    netDebtEbitda: zusatz?.netDebtEbitda ?? null,
    shortFloatPct: zusatz?.shortFloatPct ?? null,
    datenVollstaendigkeitPct: zusatz?.datenVollstaendigkeitPct ?? null,
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/** Operative Dynamik: Earnings-Treffer, CapAlloc, EPS-Wachstum (0–12). */
function berechneMomentumPunkte(zusatz: NachkaufZusatzSignale | null | undefined): number {
  if (!zusatz) return 6
  let pts = 6

  const eps8 = zusatz.epsBeatRatePct
  const eps12 = zusatz.epsBeatRate12Pct
  if (eps8 != null) {
    if (eps8 >= 75) pts += 2
    else if (eps8 >= 62) pts += 1
    else if (eps8 < 42) pts -= 3
    else if (eps8 < 52) pts -= 1
  }
  if (eps12 != null) {
    if (eps12 >= 68) pts += 1
    else if (eps12 < 42) pts -= 2
  }

  if (zusatz.epsStreakLaenge >= 3) {
    if (zusatz.epsStreakArt === 'beat') pts += 2
    else if (zusatz.epsStreakArt === 'miss') pts -= 2
  } else if (zusatz.letztesQuartalEpsBeat === false) {
    pts -= 1
  } else if (zusatz.letztesQuartalEpsBeat === true) {
    pts += 1
  }

  const ums12 = zusatz.umsatzBeatRate12Pct ?? zusatz.umsatzBeatRatePct
  if (ums12 != null) {
    if (ums12 >= 65) pts += 1
    else if (ums12 < 40) pts -= 1
  }

  if (zusatz.capitalAllocationScorePct != null) {
    if (zusatz.capitalAllocationScorePct >= 72) pts += 2
    else if (zusatz.capitalAllocationScorePct >= 55) pts += 1
    else if (zusatz.capitalAllocationScorePct < 38) pts -= 3
    else if (zusatz.capitalAllocationScorePct < 48) pts -= 1
  }

  if (zusatz.capAllocWarnungen >= 2) pts -= 1
  if (zusatz.capAllocBuyback === 'gut') pts += 1
  else if (zusatz.capAllocBuyback === 'warnung') pts -= 1
  if (zusatz.capAllocDividend === 'warnung') pts -= 1

  if (
    zusatz.aktienrueckkaufMio != null &&
    zusatz.aktienrueckkaufMio < -100 &&
    zusatz.capAllocBuyback === 'warnung'
  ) {
    pts -= 1
  }

  if (zusatz.epsWachstumFy0Pct != null) {
    if (zusatz.epsWachstumFy0Pct < -8) pts -= 2
    else if (zusatz.epsWachstumFy0Pct < 0) pts -= 1
    else if (zusatz.epsWachstumFy1Pct == null && zusatz.epsWachstumFy0Pct >= 10) pts += 1
  }

  if (zusatz.epsWachstumFy1Pct != null) {
    if (zusatz.epsWachstumFy1Pct < -8) pts -= 1
  }

  // Mehrjahres-Prognose (FY0–2027): moderat, max. ±2 über berechnePrognoseMomentumDelta
  pts += berechnePrognoseMomentumDelta(zusatz.prognoseProfil)

  if (zusatz.dividendenCagr5yPct != null) {
    if (zusatz.jahreOhneSenkung != null && zusatz.jahreOhneSenkung >= 8) pts += 1
    else if (zusatz.dividendenCagr5yPct < -2) pts -= 1
  }

  return clamp(Math.round(pts), 0, 12)
}

/** Bilanz, Kapitalstruktur, Markt-Skepsis (–10 bis +5). */
function berechneStrukturPunkte(zusatz: NachkaufZusatzSignale | null | undefined): number {
  if (!zusatz) return 0
  let pts = 0

  const nd = zusatz.netDebtEbitda
  if (nd != null) {
    if (nd > 3.5) pts -= 4
    else if (nd > 2.5) pts -= 2
    else if (nd < 0.8) pts += 1
  } else if (zusatz.nettoCashMio != null) {
    if (zusatz.nettoCashMio > 500) pts += 1
    else if (zusatz.nettoCashMio < -2_000) pts -= 2
  }

  if (zusatz.capexDaRatio != null) {
    if (zusatz.capexDaRatio > 2.8) pts -= 1
    else if (zusatz.capexDaRatio < 1.15) pts += 1
  }

  if (zusatz.goodwillAnteilPct != null && zusatz.goodwillAnteilPct >= 35) pts -= 1
  if (zusatz.segmentDatenZuverlaessig !== false) {
    if (zusatz.segmentKonzentrationPct != null && zusatz.segmentKonzentrationPct >= 55) pts -= 1
    if (zusatz.segmentShiftPct != null && Math.abs(zusatz.segmentShiftPct) >= 12) pts -= 1
  }
  if (zusatz.backlogWachstumPct != null && zusatz.backlogWachstumPct <= -8) pts -= 1

  const strukturRisiko = (zusatz.pensionVerpflichtungMio ?? 0) + (zusatz.leaseVerpflichtungMio ?? 0)
  if (strukturRisiko > 5_000) pts -= 2
  else if (strukturRisiko > 2_000) pts -= 1

  if (zusatz.shortFloatPct != null && zusatz.shortFloatPct >= 12) pts -= 2
  else if (zusatz.shortFloatPct != null && zusatz.shortFloatPct >= 8) pts -= 1

  if (zusatz.insiderNettoRichtung === 'verkauf') pts -= 2
  else if (zusatz.insiderNettoRichtung === 'kauf') pts += 1

  if (zusatz.sbcVsFcfPct != null) {
    if (zusatz.sbcVsFcfPct >= 28) pts -= 2
    else if (zusatz.sbcVsFcfPct >= 16) pts -= 1
  }

  if (zusatz.dsoTrendDelta != null && zusatz.dsoTrendDelta >= 8) pts -= 1
  if (zusatz.dioTrendDelta != null && zusatz.dioTrendDelta >= 12) pts -= 1
  if (zusatz.dpoTrendDelta != null && zusatz.dpoTrendDelta <= -10) pts -= 1

  return clamp(pts, -10, 5)
}

function berechneDrawdownBonus(
  drawdown52wPct: number | null | undefined,
  mantraScore: number,
): number {
  if (drawdown52wPct == null || mantraScore < 28) return 0
  if (drawdown52wPct >= 28) return 5
  if (drawdown52wPct >= 18) return 3
  if (drawdown52wPct >= 12) return 1
  return 0
}

export function berechneInsiderPunkte(kaeufe: InsiderKauf[]): number {
  if (kaeufe.length === 0) return 0
  const namen = new Set(kaeufe.map((k) => k.name.toLowerCase()))
  if (namen.size >= 3) return 4
  if (kaeufe.length >= 2) return 3
  return 1
}

// ---------------------------------------------------------------------------
// Score berechnen
// ---------------------------------------------------------------------------

export type NachkaufScoreOptionen = {
  kaufTriggerAusgeloest?: boolean
  batchKontext?: NachkaufBatchKontext | null
  deepResearchMemo?: string | null
  tageBisEarnings?: number | null
  ticker?: string | null
}

function summeScoreDetail(d: Omit<NachkaufScoreDetail, 'gesamt' | 'datenSignaleDelta' | 'qualitaetsRang' | 'timingRang' | 'kombiniertRang' | 'datenVollstaendigkeitPct' | 'segmentDatenQualitaet'>): number {
  return (
    d.mantraScore +
    d.sellTriggerPenalty +
    d.bewertungsScore +
    d.historischerBewertungsBonus +
    d.momentumPunkte +
    d.strukturPunkte +
    d.drawdownBonus +
    d.insiderPunkte +
    d.kauftriggerBonus +
    d.regimeDelta +
    d.earningsMalus +
    d.deepResearchMalus +
    d.klumpenMalus +
    d.sektorMalus +
    d.scoreKalibrierung
  )
}

export function berechneNachkaufScore(
  paket: FundamentaldatenPaket,
  signale: NachkaufBewertungsSignale,
  position?: WhitelistPosition,
  zusatz?: NachkaufZusatzSignale | null,
  insiderKaeufe: InsiderKauf[] = [],
  opts: NachkaufScoreOptionen = {},
): NachkaufScoreDetail {
  const { mantra } = paket
  const sum = mantra.zusammenfassung

  // --- Mantra-Score (0–50) ---
  let mantraScore: number
  const effektivErfuellt = sum.erfuellt + sum.qualitativ * 0.5
  const effektivBewertbar = sum.bewertbar + sum.qualitativ * 0.5

  if (effektivBewertbar >= 3) {
    mantraScore = Math.round((effektivErfuellt / effektivBewertbar) * 50)
  } else if (effektivBewertbar >= 1) {
    const rohScore = (effektivErfuellt / effektivBewertbar) * 50
    const konfidenz = Math.min(1, effektivBewertbar / 3)
    const basisScore = 18
    mantraScore = Math.round(basisScore + (rohScore - basisScore) * konfidenz)
  } else {
    mantraScore =
      mantra.ampel === 'gruen' ? 34 : mantra.ampel === 'gelb' ? 24 : mantra.ampel === 'grau' ? 18 : 8
  }

  // --- Sell-Trigger-Penalty ---
  const hatWarnung = mantra.sellTriggerWatch.some((w) => w.status === 'warnung')
  const hatBeobachten = mantra.sellTriggerWatch.some((w) => w.status === 'beobachten')
  const sellTriggerPenalty = hatWarnung ? -25 : hatBeobachten ? -10 : 0

  const bewertungsScore = berechnePersonalisierteBewertung(signale, position)

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
  } else if (position?.historischerMedianPe || position?.historischerMedianFcfYield || signale.historischerMedianPe) {
    // Historischer Median vorhanden, aber aktuelle Daten fehlen → neutral
    historischerBewertungsBonus = 0
  }

  const momentumPunkte = berechneMomentumPunkte(zusatz)
  const strukturPunkte = berechneStrukturPunkte(zusatz)
  const drawdownBonus = berechneDrawdownBonus(signale.drawdown52wPct, mantraScore)
  const insiderPunkte = berechneInsiderPunkte(insiderKaeufe)
  const kauftriggerBonus = berechneKauftriggerBoost(opts.kaufTriggerAusgeloest ?? false)

  const tageBis =
    opts.tageBisEarnings ??
    zusatz?.tageBisEarnings ??
    (opts.ticker && opts.batchKontext
      ? (opts.batchKontext.tageBisEarningsMap.get(opts.ticker.toUpperCase()) ?? null)
      : null)

  const regime = opts.batchKontext?.regime ?? null
  const regimeDelta = berechneRegimeDelta(regime, signale)
  const earningsMalus = berechneEarningsFensterMalus(
    tageBis,
    opts.kaufTriggerAusgeloest ?? false,
    signale.drawdown52wPct,
  )
  const deepResearchMalus = berechneDeepResearchMalus(opts.deepResearchMemo ?? null)

  const rohOhneKalibrierung =
    mantraScore +
    sellTriggerPenalty +
    bewertungsScore +
    historischerBewertungsBonus +
    momentumPunkte +
    strukturPunkte +
    drawdownBonus +
    insiderPunkte +
    kauftriggerBonus +
    regimeDelta +
    earningsMalus +
    deepResearchMalus

  const scoreKalibrierung = opts.batchKontext
    ? kalibrierungBonusFuerScore(Math.max(0, rohOhneKalibrierung), opts.batchKontext)
    : 0

  const segmentDatenQualitaet = segmentQualitaetVonQuelle(zusatz?.segmentQuelle ?? null)
  const datenSignaleDelta = momentumPunkte + strukturPunkte + drawdownBonus + insiderPunkte
  const datenVollstaendigkeitPct = zusatz?.datenVollstaendigkeitPct ?? 0

  const teile = {
    mantraScore,
    bewertungsScore,
    sellTriggerPenalty,
    historischerBewertungsBonus,
    momentumPunkte,
    strukturPunkte,
    drawdownBonus,
    insiderPunkte,
    kauftriggerBonus,
    regimeDelta,
    earningsMalus,
    deepResearchMalus,
    klumpenMalus: 0,
    sektorMalus: 0,
    scoreKalibrierung,
  }
  const gesamt = Math.max(0, Math.min(100, summeScoreDetail(teile)))

  const scoreBasis: NachkaufScoreDetail = {
    ...teile,
    gesamt,
    datenSignaleDelta,
    datenVollstaendigkeitPct,
    qualitaetsRang: 0,
    timingRang: 0,
    kombiniertRang: 0,
    segmentDatenQualitaet,
  }
  const qualitaetsRang = berechneQualitaetsRang(scoreBasis)
  const timingRang = berechneTimingRang({ ...scoreBasis, qualitaetsRang }, signale)
  const kombiniertRang = berechneKombiniertRang(qualitaetsRang, timingRang)

  return {
    ...scoreBasis,
    qualitaetsRang,
    timingRang,
    kombiniertRang,
  }
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
  opts?: { kaufTriggerAusgeloest?: boolean; regime?: NachkaufBatchKontext['regime'] },
): NachkaufAmpel {
  const { mantra } = paket
  const hatWarnung = mantra.sellTriggerWatch.some((w) => w.status === 'warnung')

  if (hatWarnung || mantra.ampel === 'rot') return 'rot'
  if (mantra.ampel === 'grau' && mantra.zusammenfassung.bewertbar === 0) return 'grau'

  const { fcfYieldPct, forwardPe } = signale
  const hatDatenFuerBewertung = fcfYieldPct != null || forwardPe != null
  const trigger = opts?.kaufTriggerAusgeloest ?? false

  if (hatDatenFuerBewertung) {
    const medianPe = signale.historischerMedianPe
    const teuerGrenze = medianPe != null ? medianPe * 1.35 : 38
    const fcfZuTeuer = fcfYieldPct != null && fcfYieldPct < 1.5
    const kgvZuTeuer = forwardPe != null && forwardPe > teuerGrenze
    const nurFcfDaten = fcfYieldPct != null && forwardPe == null
    const nurKgvDaten = forwardPe != null && fcfYieldPct == null

    if (
      (fcfZuTeuer && kgvZuTeuer) ||
      (fcfZuTeuer && nurFcfDaten) ||
      (kgvZuTeuer && nurKgvDaten)
    ) {
      if (score.mantraScore >= 25 && (score.timingRang ?? 0) < 50) return 'teuer'
    }
  }

  if (
    istKalibriertesGruen({
      scoreDetail: score,
      signale,
      regime: opts?.regime ?? null,
      kaufTriggerAusgeloest: trigger,
    })
  ) {
    return 'gruen'
  }

  if (score.gesamt >= gelbSchwelle(trigger)) return 'gelb'
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
    g *= disziplinSparplanFaktor(e)
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
    if (eintrag.disziplinHinweis) begruendung += ' · Disziplin: reduziert'

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
      const diszA = a.disziplinHinweis ? 1 : 0
      const diszB = b.disziplinHinweis ? 1 : 0
      if (diszA !== diszB) return diszA - diszB
      if (a.klumpenrisiko !== b.klumpenrisiko) return a.klumpenrisiko ? 1 : -1
      if (a.kaufTriggerAusgeloest !== b.kaufTriggerAusgeloest) return a.kaufTriggerAusgeloest ? -1 : 1
      const kombA = a.scoreDetail.kombiniertRang ?? a.score
      const kombB = b.scoreDetail.kombiniertRang ?? b.score
      if (kombA !== kombB) return kombB - kombA
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

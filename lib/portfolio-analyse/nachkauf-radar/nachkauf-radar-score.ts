/**
 * Regelbasierter Nachkauf-Score.
 *
 * Anti-Halluzinations-Prinzip: Zahlen kommen aus dem Code, nicht vom LLM.
 * Das Flash-LLM erklärt anschließend nur, was diese Funktion berechnet.
 *
 * Punkte-Verteilung (Ziel: 0–100):
 *  – Mantra-Qualität             0–50
 *  – Bewertung (personalisiert)  0–35
 *  – Historischer Bonus/Malus   –10 bis +10  (Perzentil ODER Median, nicht beides)
 *  – Momentum                    0–10  (Langfrist: Beat/Miss gedämpft)
 *  – Struktur & Risiko          –12 bis +6
 *  – Drawdown-Chance             0–3
 *  – Insider-Käufe               0–4
 *  – Kauftrigger-Boost           0–5
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
import { risikoKlasseFuerIsin, type RisikoKlasse } from './nachkauf-radar-whitelist'
import type { NachkaufZusatzSignale } from './nachkauf-zusatz-signale-server'
import { berechnePrognoseMomentumDelta } from './nachkauf-prognose-server'
import { disziplinSparplanFaktor } from './nachkauf-disziplin-server'
import { berechneStrukturMitAufschluesselung } from './nachkauf-struktur-aufschluesselung'
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
  return risikoKlasseFuerIsin(isin)
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
  const evRevMetric = km.find((m) => m.id === 'ntm_ev_rev') ?? km.find((m) => m.id === 'ltm_ev_rev')
  const ntmEvRev = evRevMetric ? parseMetricWert(evRevMetric.wert) : null

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
  const medianEvEbitda = historisch?.medianEvEbitda5y ?? null
  const medianEvRev = historisch?.medianEvRev5y ?? null
  let historischQuelle: 'macrotrends' | 'whitelist' | null = null
  if (
    historisch?.medianPe5y != null ||
    historisch?.medianFcfYield5y != null ||
    historisch?.medianEvEbitda5y != null ||
    historisch?.medianEvRev5y != null
  ) {
    historischQuelle = 'macrotrends'
  } else if (position?.historischerMedianPe != null || position?.historischerMedianFcfYield != null) {
    historischQuelle = 'whitelist'
  }

  // Historischer Premium/Discount — KGV, FCF und EV/EBITDA gleichwertig mitteln
  let premiumDiscountPct: number | null = null
  const pdTeile: number[] = []
  if (medianPe && forwardPe) pdTeile.push(((forwardPe - medianPe) / medianPe) * 100)
  if (medianFcfYield && fcfYieldPct) {
    pdTeile.push(((medianFcfYield - fcfYieldPct) / medianFcfYield) * 100)
  }
  if (medianEvEbitda && ntmEvEbitda) {
    pdTeile.push(((ntmEvEbitda - medianEvEbitda) / medianEvEbitda) * 100)
  } else if (medianEvRev && ntmEvRev) {
    pdTeile.push(((ntmEvRev - medianEvRev) / medianEvRev) * 100)
  }
  if (pdTeile.length > 0) {
    premiumDiscountPct = pdTeile.reduce((a, b) => a + b, 0) / pdTeile.length
  }

  return {
    fcfYieldPct,
    forwardPe,
    ntmEvEbitda,
    ntmEvRev,
    drawdown52wPct,
    premiumDiscountPct,
    pePerzentil5y: historisch?.pePerzentil5y ?? zusatz?.pePerzentil5y ?? null,
    pePerzentil10y: historisch?.pePerzentil10y ?? zusatz?.pePerzentil10y ?? null,
    evEbitdaPerzentil5y: historisch?.evEbitdaPerzentil5y ?? null,
    evEbitdaPerzentil10y: historisch?.evEbitdaPerzentil10y ?? null,
    evRevPerzentil5y: historisch?.evRevPerzentil5y ?? null,
    historischerMedianPe: medianPe,
    historischerMedianFcfYield: medianFcfYield,
    historischerMedianEvEbitda: medianEvEbitda,
    historischerMedianEvRev: medianEvRev,
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

/** Operative Dynamik: Earnings-Treffer, CapAlloc, EPS-Wachstum (0–10, Langfrist-Bias). */
function berechneMomentumPunkte(zusatz: NachkaufZusatzSignale | null | undefined): number {
  if (!zusatz) return 5
  let pts = 5

  const eps8 = zusatz.epsBeatRatePct
  const eps12 = zusatz.epsBeatRate12Pct
  if (eps8 != null) {
    if (eps8 >= 75) pts += 1
    else if (eps8 >= 62) pts += 1
    else if (eps8 < 42) pts -= 2
    else if (eps8 < 52) pts -= 1
  }
  if (eps12 != null) {
    if (eps12 >= 68) pts += 1
    else if (eps12 < 42) pts -= 1
  }

  // Streak nur schwach — Quartals-Beats sind kein Langfrist-Alpha
  if (zusatz.epsStreakLaenge >= 4) {
    if (zusatz.epsStreakArt === 'beat') pts += 1
    else if (zusatz.epsStreakArt === 'miss') pts -= 1
  } else if (zusatz.letztesQuartalEpsBeat === false) {
    pts -= 1
  }

  const ums12 = zusatz.umsatzBeatRate12Pct ?? zusatz.umsatzBeatRatePct
  if (ums12 != null) {
    if (ums12 >= 65) pts += 1
    else if (ums12 < 40) pts -= 1
  }

  // Capital Allocation bleibt wichtig für Langfrist
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
  }

  if (zusatz.epsWachstumFy1Pct != null) {
    if (zusatz.epsWachstumFy1Pct < -8) pts -= 1
  }

  pts += berechnePrognoseMomentumDelta(zusatz.prognoseProfil)

  if (zusatz.dividendenCagr5yPct != null) {
    if (zusatz.jahreOhneSenkung != null && zusatz.jahreOhneSenkung >= 8) pts += 1
    else if (zusatz.dividendenCagr5yPct < -2) pts -= 1
  }

  return clamp(Math.round(pts), 0, 10)
}

function berechneDrawdownBonus(
  drawdown52wPct: number | null | undefined,
  mantraScore: number,
  histBonus: number,
): number {
  if (drawdown52wPct == null || mantraScore < 28) return 0
  // Wenn hist. Bewertung schon stark belohnt: Drawdown nur noch schwach (Anti-Doppelzählung)
  const cap = histBonus >= 6 ? 1 : 3
  let bonus = 0
  if (drawdown52wPct >= 28) bonus = 3
  else if (drawdown52wPct >= 18) bonus = 2
  else if (drawdown52wPct >= 12) bonus = 1
  return Math.min(bonus, cap)
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
  // Ein Perzentil-Pfad (KGV bevorzugt, sonst EV/EBITDA) ODER Median-Premium — nicht additiv.
  let historischerBewertungsBonus = 0
  const peP = signale.pePerzentil5y ?? signale.pePerzentil10y ?? zusatz?.pePerzentil5y ?? null
  const evP = signale.evEbitdaPerzentil5y ?? signale.evEbitdaPerzentil10y ?? signale.evRevPerzentil5y ?? null
  const histPerzentil = peP ?? evP
  if (histPerzentil != null) {
    if (histPerzentil <= 15) historischerBewertungsBonus = 10
    else if (histPerzentil <= 25) historischerBewertungsBonus = 7
    else if (histPerzentil <= 35) historischerBewertungsBonus = 4
    else if (histPerzentil <= 55) historischerBewertungsBonus = 0
    else if (histPerzentil <= 70) historischerBewertungsBonus = -4
    else if (histPerzentil <= 85) historischerBewertungsBonus = -7
    else historischerBewertungsBonus = -10
  } else {
    const pd = signale.premiumDiscountPct
    if (pd !== null) {
      if (pd <= -20) historischerBewertungsBonus = 10
      else if (pd <= -10) historischerBewertungsBonus = 6
      else if (pd <= -5) historischerBewertungsBonus = 3
      else if (pd <= 5) historischerBewertungsBonus = 0
      else if (pd <= 15) historischerBewertungsBonus = -4
      else if (pd <= 25) historischerBewertungsBonus = -7
      else historischerBewertungsBonus = -10
    }
  }

  const momentumPunkte = berechneMomentumPunkte(zusatz)
  const strukturRaw = berechneStrukturMitAufschluesselung(zusatz)
  let strukturPunkte = strukturRaw.punkte
  let strukturSignale = strukturRaw.zeilen
  const insiderPunkte = berechneInsiderPunkte(insiderKaeufe)
  // Form-4-Insider und Netto-Richtung nicht doppelt zählen
  if (insiderPunkte > 0) {
    const insiderZeile = strukturSignale.find((z) => z.id === 'insider')
    if (insiderZeile && insiderZeile.delta !== 0) {
      strukturPunkte -= insiderZeile.delta
      strukturSignale = strukturSignale.map((z) =>
        z.id === 'insider' ? { ...z, delta: 0, wert: `${z.wert} (via Form-4)` } : z,
      )
      strukturPunkte = clamp(strukturPunkte, -12, 6)
    }
  }

  const drawdownBonus = berechneDrawdownBonus(
    signale.drawdown52wPct,
    mantraScore,
    historischerBewertungsBonus,
  )
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
    strukturSignale,
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
 * Verteilt das Monatsbudget proportional auf Kandidaten (regelbasiert).
 * - Klumpenrisiko-Positionen erhalten max. 20 % des Budgets.
 * - Risikoklasse begrenzt den Maximalbetrag (konservativ 350 €, moderat 200 €, spekulativ 100 €).
 * - Trigger-Positionen erhalten einen 20 % Bonus-Gewichtung.
 * - Mindestposten: 100 € (sonst weggelassen).
 * - Bewertungsrabatt wirkt nur schwach (max. +5 %), da Score schon Bewertung enthält.
 */
export function berechneRegelAllokation(
  kandidaten: NachkaufScanEintrag[],
  budgetEur: number,
): SparplanPosten[] {
  if (kandidaten.length === 0 || budgetEur < 100) return []

  const MAX_KLUMPEN = budgetEur * 0.2
  const MIN_POS = 100

  const gewichte = kandidaten.map((e) => {
    let g = e.score
    if (e.kaufTriggerAusgeloest) g *= 1.2
    if (e.klumpenrisiko) g *= 0.5
    g *= disziplinSparplanFaktor(e)
    const disc = e.bewertung.premiumDiscountPct
    if (disc != null && disc < 0) g *= 1 + Math.min(0.05, Math.abs(disc) / 400)
    return { eintrag: e, gewicht: g }
  })

  const summeGewichte = gewichte.reduce((acc, gw) => acc + gw.gewicht, 0)
  if (summeGewichte <= 0) return []

  const posten: SparplanPosten[] = []
  let restBudget = budgetEur

  for (const { eintrag, gewicht } of gewichte) {
    const risiko = risikoKlasseVon(eintrag.isin)
    const maxBetrag = eintrag.klumpenrisiko
      ? Math.min(SPARPLAN_RISIKO_CAP[risiko], MAX_KLUMPEN)
      : Math.min(SPARPLAN_RISIKO_CAP[risiko], budgetEur)

    let betrag = (gewicht / summeGewichte) * budgetEur
    betrag = Math.min(betrag, maxBetrag)
    betrag = Math.round(betrag / 10) * 10

    if (betrag < MIN_POS) continue
    restBudget -= betrag

    const teile: string[] = [`Score ${eintrag.score}`, `Risiko: ${risiko}`]
    if (eintrag.kaufTriggerAusgeloest) teile.push('Kaufzone')
    if (eintrag.klumpenrisiko) teile.push('Klumpen-Cap')
    if (eintrag.disziplinHinweis) teile.push('Disziplin')

    posten.push({
      ticker: eintrag.ticker,
      name: eintrag.name,
      betragEur: betrag,
      begruendung: teile.join(' · '),
    })
  }

  if (restBudget >= MIN_POS && posten.length > 0) {
    const konservativIdx = kandidaten.findIndex(
      (e, i) => posten[i] && risikoKlasseVon(e.isin) === 'konservativ' && !e.klumpenrisiko,
    )
    const target = konservativIdx >= 0 ? konservativIdx : 0
    if (posten[target]) {
      const risiko = risikoKlasseVon(kandidaten[target]!.isin)
      posten[target]!.betragEur = Math.min(
        posten[target]!.betragEur + restBudget,
        Math.min(SPARPLAN_RISIKO_CAP[risiko], budgetEur),
      )
    }
  }

  return posten
}

/** @deprecated Alias — nutze berechneRegelAllokation. */
function berechneSparplanAllokation(gruenKandidaten: NachkaufScanEintrag[]): SparplanPosten[] {
  return berechneRegelAllokation(gruenKandidaten, SPARPLAN_BUDGET_EUR)
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

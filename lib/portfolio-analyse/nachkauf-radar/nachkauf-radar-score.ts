/**
 * Regelbasierter Nachkauf-Score — Quality-Compounder.
 *
 * Geometrisches Kern-Modell:
 *   Q = Mantra + Sell + DR/SEC (0–100)
 *   T = Bewertung × Hist-Feintuning(±10%) × Struktur-Multiplikator (0–100)
 *   Kern = √(Q·T)
 *
 * Gates:
 *   G1 Mantra ≥ 38 → sonst Score-Cap 45
 *   G2 Trigger oder echte Unterbewertung → sonst keine Nebenpunkte, Cap 60
 *   G3 Premium>0 ∧ DD<12% ∧ kein Trigger → Ampel teuer
 *
 * Nebenpunkte (Insider/Drawdown/Momentum) nur bei G1∧G2.
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
  berechneEarningsFensterMalus,
  berechneKauftriggerBoost,
  berechneGeometrischenKern,
  berechneGesamtAusKern,
  berechneHistFeintuningPct,
  berechnePersonalisierteBewertung,
  berechneQualitaetsAchse,
  berechneQualitaetsTextMalus,
  berechneRegimeDelta,
  berechneStrukturMultiplikator,
  berechneTimingAchse,
  gelbSchwelle,
  istKalibriertesGruen,
  kalibrierungBonusFuerScore,
  pruefGateG1,
  pruefGateG2,
  pruefGateG3Teuer,
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

function risikoKlasseVon(e: NachkaufScanEintrag): RisikoKlasse {
  return risikoKlasseFuerIsin(e.isin, e.depotGewichtPct, e.kandidatenQuelle)
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

  // Historischer Premium/Discount — KGV, FCF und EV gleichwertig mitteln; nie < −100 %.
  let premiumDiscountPct: number | null = null
  const pdTeile: number[] = []
  const pushPd = (aktuell: number | null | undefined, median: number | null | undefined, invert = false) => {
    if (aktuell == null || median == null || !(aktuell > 0) || !(median > 0)) return
    const raw = invert
      ? ((median - aktuell) / median) * 100
      : ((aktuell - median) / median) * 100
    if (!Number.isFinite(raw)) return
    // FCF-Yield-Pfad kann bei sehr hoher aktueller Yield < −100 % liefern — clampen.
    pdTeile.push(Math.max(-95, Math.min(400, raw)))
  }
  pushPd(forwardPe, medianPe)
  pushPd(fcfYieldPct, medianFcfYield, true)
  if (medianEvEbitda && ntmEvEbitda) pushPd(ntmEvEbitda, medianEvEbitda)
  else pushPd(ntmEvRev, medianEvRev)
  if (pdTeile.length > 0) {
    premiumDiscountPct = Math.max(
      -95,
      Math.min(400, pdTeile.reduce((a, b) => a + b, 0) / pdTeile.length),
    )
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
    netDebtFcf: zusatz?.netDebtFcf ?? null,
    pegRatio: zusatz?.pegRatio ?? null,
    shortFloatPct: zusatz?.shortFloatPct ?? null,
    datenVollstaendigkeitPct: zusatz?.datenVollstaendigkeitPct ?? null,
  }
}

/** Operative Dynamik: Earnings-Treffer, CapAlloc, EPS-Wachstum (0–10, Zero-Noise-Floor). */
function berechneMomentumPunkte(zusatz: NachkaufZusatzSignale | null | undefined): number {
  if (!zusatz) return 0
  let pts = 0

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

  return Math.max(0, Math.min(10, Math.round(pts)))
}

function berechneDrawdownBonus(
  drawdown52wPct: number | null | undefined,
  mantraScore: number,
  histFeintuningPct: number,
): number {
  if (drawdown52wPct == null || mantraScore < 38) return 0
  // Wenn Hist-Feintuning schon stark belohnt: Drawdown nur noch schwach
  const cap = histFeintuningPct >= 6 ? 1 : 3
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
  /** Earnings-Call-KI-Zusammenfassung aus Cache. */
  earningsZusammenfassung?: string | null
  /** SEC/IR-KI-Zusammenfassung aus Cache. */
  secZusammenfassung?: string | null
  tageBisEarnings?: number | null
  ticker?: string | null
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

  const hatWarnung = mantra.sellTriggerWatch.some((w) => w.status === 'warnung')
  const hatBeobachten = mantra.sellTriggerWatch.some((w) => w.status === 'beobachten')
  const sellTriggerPenalty = hatWarnung ? -25 : hatBeobachten ? -10 : 0

  const bewertungsScore = berechnePersonalisierteBewertung(signale, position)
  const historischerBewertungsBonus = berechneHistFeintuningPct(signale, zusatz?.pePerzentil5y)

  const strukturRaw = berechneStrukturMitAufschluesselung(zusatz)
  let strukturPunkte = strukturRaw.punkte
  let strukturSignale = strukturRaw.zeilen

  let momentumPunkte = berechneMomentumPunkte(zusatz)
  let insiderPunkte = berechneInsiderPunkte(insiderKaeufe)
  if (insiderPunkte > 0) {
    const insiderZeile = strukturSignale.find((z) => z.id === 'insider')
    if (insiderZeile && insiderZeile.delta !== 0) {
      strukturPunkte -= insiderZeile.delta
      strukturSignale = strukturSignale.map((z) =>
        z.id === 'insider' ? { ...z, delta: 0, wert: `${z.wert} (via Form-4)` } : z,
      )
      strukturPunkte = Math.max(-12, Math.min(6, strukturPunkte))
    }
  }

  const drawdownBonusRoh = berechneDrawdownBonus(
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
  const deepResearchMalus = berechneQualitaetsTextMalus({
    deepResearchMemo: opts.deepResearchMemo ?? null,
    earningsZusammenfassung: opts.earningsZusammenfassung ?? null,
    secZusammenfassung: opts.secZusammenfassung ?? null,
  })

  const gateG1 = pruefGateG1(mantraScore, hatWarnung)
  const gateG2 = pruefGateG2(opts.kaufTriggerAusgeloest ?? false, signale)
  const gateG3Teuer = pruefGateG3Teuer(opts.kaufTriggerAusgeloest ?? false, signale)

  // G2 Fail → keine Nebenpunkte (Insider / Drawdown / Momentum)
  let drawdownBonus = drawdownBonusRoh
  if (!gateG2) {
    momentumPunkte = 0
    insiderPunkte = 0
    drawdownBonus = 0
  }

  const strukturMultiplikator = berechneStrukturMultiplikator(strukturPunkte)
  const qualitaetsRang = Math.round(
    berechneQualitaetsAchse({ mantraScore, sellTriggerPenalty, deepResearchMalus }),
  )
  const timingRang = Math.round(
    berechneTimingAchse({
      bewertungsScore,
      histFeintuningPct: historischerBewertungsBonus,
      strukturMultiplikator,
      kaufTriggerAusgeloest: opts.kaufTriggerAusgeloest ?? false,
      regimeDelta,
    }),
  )
  const kombiniertRang = berechneGeometrischenKern(qualitaetsRang, timingRang)

  const scoreKalibrierung = opts.batchKontext
    ? kalibrierungBonusFuerScore(kombiniertRang, opts.batchKontext)
    : 0

  const nebenPunkte = momentumPunkte + drawdownBonus + insiderPunkte
  const gesamt = berechneGesamtAusKern({
    kern: kombiniertRang,
    gateG1,
    gateG2,
    nebenPunkte,
    earningsMalus,
    klumpenMalus: 0,
    sektorMalus: 0,
    scoreKalibrierung,
  })

  const segmentDatenQualitaet = segmentQualitaetVonQuelle(zusatz?.segmentQuelle ?? null)
  const datenSignaleDelta = momentumPunkte + strukturPunkte + drawdownBonus + insiderPunkte
  const datenVollstaendigkeitPct = zusatz?.datenVollstaendigkeitPct ?? 0

  return {
    mantraScore,
    bewertungsScore,
    sellTriggerPenalty,
    historischerBewertungsBonus,
    momentumPunkte,
    strukturPunkte,
    strukturSignale,
    drawdownBonus,
    insiderPunkte,
    kauftriggerBonus,
    regimeDelta,
    earningsMalus,
    deepResearchMalus,
    klumpenMalus: 0,
    sektorMalus: 0,
    scoreKalibrierung,
    gesamt,
    datenSignaleDelta,
    datenVollstaendigkeitPct,
    qualitaetsRang,
    timingRang,
    kombiniertRang,
    gateG1,
    gateG2,
    gateG3Teuer,
    strukturMultiplikator,
    segmentDatenQualitaet,
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

  const { fcfYieldPct, forwardPe, pegRatio } = signale
  const bedingungen: string[] = []

  const peTrigger = trigger.peMax != null && forwardPe != null && forwardPe < trigger.peMax
  const fcfTrigger = trigger.fcfYieldMin != null && fcfYieldPct != null && fcfYieldPct >= trigger.fcfYieldMin
  const pegSchwelle = trigger.pegMax ?? (trigger.peMax != null ? 1.8 : undefined)
  const pegTrigger =
    pegSchwelle != null && pegRatio != null && pegRatio > 0 && pegRatio < pegSchwelle

  if (peTrigger) bedingungen.push(`Forward P/E ${forwardPe?.toFixed(1)}× < Schwelle ${trigger.peMax}×`)
  if (fcfTrigger) bedingungen.push(`FCF-Rendite ${fcfYieldPct?.toFixed(1)} % > Schwelle ${trigger.fcfYieldMin} %`)
  if (pegTrigger) {
    bedingungen.push(`PEG ${pegRatio?.toFixed(2)}× < Schwelle ${pegSchwelle}× (Wachstum zum Preis)`)
  }

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
  const trigger = opts?.kaufTriggerAusgeloest ?? false

  if (hatWarnung || mantra.ampel === 'rot') return 'rot'
  if (mantra.ampel === 'grau' && mantra.zusammenfassung.bewertbar === 0) return 'grau'

  // G1 Fail: max. Gelb (nie Grün) — vor G3, sonst Score 0 fälschlich „teuer“
  const g1 = score.gateG1 ?? pruefGateG1(score.mantraScore, hatWarnung)
  if (!g1) {
    return score.gesamt >= gelbSchwelle(trigger) ? 'gelb' : 'rot'
  }

  // G3: Quality @ ATH / Überbewertung — nur wenn Qualität (G1) ok
  if (score.gateG3Teuer ?? pruefGateG3Teuer(trigger, signale)) return 'teuer'

  // Ergänzender Teuer-Pfad (sehr teuer + nahe Hoch)
  const { fcfYieldPct, forwardPe } = signale
  const hatDatenFuerBewertung = fcfYieldPct != null || forwardPe != null
  const premium = signale.premiumDiscountPct ?? 0
  const dd = signale.drawdown52wPct ?? 0
  const peP = signale.pePerzentil5y ?? signale.pePerzentil10y ?? null
  const evP = signale.evEbitdaPerzentil5y ?? signale.evRevPerzentil5y ?? null
  const histP = peP ?? evP
  const medianPe = signale.historischerMedianPe
  const teuerGrenze = medianPe != null ? medianPe * 1.18 : 32
  const fcfZuTeuer = fcfYieldPct != null && fcfYieldPct < 2.5
  const kgvZuTeuer = forwardPe != null && forwardPe > teuerGrenze
  const histTeuer = histP != null && histP > 65
  const premiumTeuer = premium > 8
  const naheHoch = dd < 12

  if (
    score.mantraScore >= 38 &&
    naheHoch &&
    hatDatenFuerBewertung &&
    (premiumTeuer ||
      histTeuer ||
      (fcfZuTeuer && kgvZuTeuer) ||
      (fcfZuTeuer && forwardPe == null) ||
      (kgvZuTeuer && fcfYieldPct == null))
  ) {
    return 'teuer'
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
    const risiko = risikoKlasseVon(eintrag)
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
      (e, i) => posten[i] && risikoKlasseVon(e) === 'konservativ' && !e.klumpenrisiko,
    )
    const target = konservativIdx >= 0 ? konservativIdx : 0
    if (posten[target]) {
      const risiko = risikoKlasseVon(kandidaten[target]!)
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

/** Max. Titel in der verbindlichen Monats-Allokation (Radar-Banner = Stufe C). */
export const MAX_MONATS_KAUF_TITEL = 3

function sortiereGruenNachkauf(gruen: NachkaufScanEintrag[]): NachkaufScanEintrag[] {
  return [...gruen].sort((a, b) => {
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
}

/**
 * Dieselbe Kandidatenliste für Radar-Banner und Stufe-C-Euro-Allokation
 * (Top-N Grün) — verhindert Drift RMD/WKL/ROL vs. zusätzliches MSCI.
 */
export function waehleMonatsNachkaufKandidaten(
  ergebnisse: NachkaufScanEintrag[],
  max = MAX_MONATS_KAUF_TITEL,
): NachkaufScanEintrag[] {
  const gruen = ergebnisse.filter((e) => e.ampel === 'gruen')
  return sortiereGruenNachkauf(gruen).slice(0, max)
}

export function berechneMonatsEmpfehlung(ergebnisse: NachkaufScanEintrag[]): MonatsEmpfehlung {
  const gruen = ergebnisse.filter((e) => e.ampel === 'gruen')
  const teuer = ergebnisse.filter((e) => e.ampel === 'teuer')
  const gelb = ergebnisse.filter((e) => e.ampel === 'gelb')
  const rot = ergebnisse.filter((e) => e.ampel === 'rot')

  if (gruen.length > 0) {
    const sortiertGruen = sortiereGruenNachkauf(gruen)
    const kandidaten = waehleMonatsNachkaufKandidaten(ergebnisse)
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

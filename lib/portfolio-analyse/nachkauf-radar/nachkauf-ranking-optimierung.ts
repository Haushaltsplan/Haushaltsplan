/**
 * Nachkauf-Radar — Ranking-Optimierungen (rein regelbasiert, ohne server-only).
 */

import type {
  NachkaufBewertungsSignale,
  NachkaufScoreBucketStat,
  NachkaufScoreDetail,
} from './nachkauf-radar-types'
import type { WhitelistPosition, WhitelistSektor } from './nachkauf-radar-whitelist'

export type NachkaufMarktRegime = {
  spyAbove20Ma: boolean | null
  vixClose: number | null
}

export type NachkaufBatchKontext = {
  regime: NachkaufMarktRegime | null
  tageBisEarningsMap: Map<string, number>
  scoreBuckets: NachkaufScoreBucketStat[]
}

export type SegmentDatenQualitaet = 'validiert' | 'nur_ms' | 'keine'

export type NachkaufRankingKontext = {
  regime: NachkaufMarktRegime | null
  tageBisEarnings: number | null
  segmentDatenQualitaet: SegmentDatenQualitaet
  kaufTriggerAusgeloest: boolean
  klumpenrisiko: boolean
  depotGewichtPct: number | null
  deepResearchMemo: string | null
  sektor: WhitelistSektor | undefined
  scoreKalibrierungBonus: number
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/** Mantra-Minimum für Quality-Compounder (Gate G1). */
export const GATE_G1_MANTRA_MIN = 38
/** Score-Cap wenn G1 fehlschlägt. */
export const GATE_G1_SCORE_CAP = 45
/** Score-Cap wenn G2 fehlschlägt. */
export const GATE_G2_SCORE_CAP = 60
/** Relativ-Filter: Kern muss Median + X erreichen (nur bei vielen Kandidaten). */
export const RELATIV_KERN_MEDIAN_DELTA = 10
/** Relativ-Filter: nur Top-X-Anteil des Scans (nur bei vielen Kandidaten). */
export const RELATIV_TOP_ANTEIL = 0.1
/**
 * Ab so vielen vorläufigen Grün-Kandidaten greift der strenge Relativ-Filter.
 * Darunter = „einzelne Chancen“ (auch im ATH-Markt) → nur Cap, kein Median+10.
 */
export const RELATIV_FILTER_MIN_KANDIDATEN = 4


/**
 * Historie als Feintuning in Prozent (−10…+10), nicht als zweiter voller Bonus.
 * Wird als Multiplikator `(1 + pct/100)` auf die Timing-Achse angewandt.
 */
export function berechneHistFeintuningPct(
  signale: NachkaufBewertungsSignale,
  pePerzentilFallback?: number | null,
): number {
  const peP = signale.pePerzentil5y ?? signale.pePerzentil10y ?? pePerzentilFallback ?? null
  const evP =
    signale.evEbitdaPerzentil5y ?? signale.evEbitdaPerzentil10y ?? signale.evRevPerzentil5y ?? null
  const histPerzentil = peP ?? evP
  if (histPerzentil != null) {
    if (histPerzentil <= 15) return 10
    if (histPerzentil <= 25) return 7
    if (histPerzentil <= 35) return 3
    if (histPerzentil <= 45) return -2
    if (histPerzentil <= 55) return -4
    if (histPerzentil <= 70) return -7
    if (histPerzentil <= 85) return -9
    return -10
  }
  const pd = signale.premiumDiscountPct
  if (pd == null) return 0
  if (pd <= -20) return 10
  if (pd <= -10) return 6
  if (pd <= -5) return 2
  if (pd <= 0) return -1
  if (pd <= 8) return -4
  if (pd <= 15) return -7
  if (pd <= 25) return -9
  return -10
}

/** Struktur → Multiplikator auf T-Achse. */
export function berechneStrukturMultiplikator(strukturPunkte: number): number {
  if (strukturPunkte >= 2) return 1.02
  if (strukturPunkte >= -3) return 0.9
  return 0.75
}

/** Echte Unterbewertung für Gate G2 (ohne Kauftrigger). */
export function istEchteUnterbewertung(signale: NachkaufBewertungsSignale): boolean {
  const premium = signale.premiumDiscountPct
  if (premium != null && premium <= -10) return true

  const peP = signale.pePerzentil5y ?? signale.pePerzentil10y ?? null
  const evP =
    signale.evEbitdaPerzentil5y ?? signale.evEbitdaPerzentil10y ?? signale.evRevPerzentil5y ?? null
  const histP = peP ?? evP
  if (histP != null && histP <= 30) return true

  const pe = signale.forwardPe
  const median = signale.historischerMedianPe
  if (pe != null && median != null && median > 0 && pe <= median * 0.85) return true

  return false
}

export function pruefGateG1(mantraScore: number, sellWarnung: boolean): boolean {
  return mantraScore >= GATE_G1_MANTRA_MIN && !sellWarnung
}

export function pruefGateG2(
  kaufTriggerAusgeloest: boolean,
  signale: NachkaufBewertungsSignale,
): boolean {
  return kaufTriggerAusgeloest || istEchteUnterbewertung(signale)
}

/** G3: Quality @ ATH / Überbewertung → Teuer. */
export function pruefGateG3Teuer(
  kaufTriggerAusgeloest: boolean,
  signale: NachkaufBewertungsSignale,
): boolean {
  if (kaufTriggerAusgeloest) return false
  const premium = signale.premiumDiscountPct ?? 0
  const dd = signale.drawdown52wPct ?? 0
  return premium > 0 && dd < 12
}

/** Q-Achse 0–100 aus Mantra + Sell + Qualitäts-Text-Malus. */
export function berechneQualitaetsAchse(opts: {
  mantraScore: number
  sellTriggerPenalty: number
  deepResearchMalus: number
}): number {
  const basis = (opts.mantraScore / 50) * 100
  // Sell −25/−10 auf 0–50-Skala → auf 0–100 verdoppeln
  return clamp(basis + opts.sellTriggerPenalty * 2 + opts.deepResearchMalus, 0, 100)
}

/** T-Achse 0–100: Bewertung × Hist-Feintuning × Struktur (± Trigger-Boost). */
export function berechneTimingAchse(opts: {
  bewertungsScore: number
  histFeintuningPct: number
  strukturMultiplikator: number
  kaufTriggerAusgeloest: boolean
  regimeDelta: number
}): number {
  const basis = (opts.bewertungsScore / 35) * 100
  const mitHist = basis * (1 + opts.histFeintuningPct / 100)
  const mitStruktur = mitHist * opts.strukturMultiplikator
  const mitTrigger = opts.kaufTriggerAusgeloest ? mitStruktur + 8 : mitStruktur
  // Regime leicht auf Timing (nicht als additive Score-Polsterung)
  return clamp(mitTrigger + opts.regimeDelta * 1.5, 0, 100)
}

export function berechneGeometrischenKern(q: number, t: number): number {
  return clamp(Math.round(Math.sqrt(Math.max(0, q) * Math.max(0, t))), 0, 100)
}

/**
 * Nebenpunkte (Insider/Drawdown/Momentum) nur bei offenen Gates;
 * Earnings-Malus + Klumpen/Sektor/Kalibrierung immer.
 */
export function berechneGesamtAusKern(opts: {
  kern: number
  gateG1: boolean
  gateG2: boolean
  nebenPunkte: number
  earningsMalus: number
  klumpenMalus: number
  sektorMalus: number
  scoreKalibrierung: number
}): number {
  const neben = opts.gateG1 && opts.gateG2 ? opts.nebenPunkte : 0
  let gesamt = opts.kern + neben + opts.earningsMalus + opts.klumpenMalus + opts.sektorMalus + opts.scoreKalibrierung
  if (!opts.gateG1) gesamt = Math.min(gesamt, GATE_G1_SCORE_CAP)
  if (!opts.gateG2) gesamt = Math.min(gesamt, GATE_G2_SCORE_CAP)
  return clamp(Math.round(gesamt), 0, 100)
}

export function medianZahl(werte: number[]): number {
  if (werte.length === 0) return 0
  const s = [...werte].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!
}

export function segmentQualitaetVonQuelle(
  quelle: 'marketscreener' | 'stockanalysis' | 'mixed' | 'sec_edgar' | null | undefined,
): SegmentDatenQualitaet {
  if (!quelle) return 'keine'
  if (quelle === 'marketscreener') return 'nur_ms'
  return 'validiert'
}

/** Personalisierte Bewertung anhand Whitelist-Median + Kaufzone (0–35). */
export function berechnePersonalisierteBewertung(
  signale: NachkaufBewertungsSignale,
  position?: WhitelistPosition,
): number {
  const {
    forwardPe,
    fcfYieldPct,
    ntmEvEbitda,
    ntmEvRev,
    historischerMedianPe,
    historischerMedianFcfYield,
    historischerMedianEvEbitda,
    historischerMedianEvRev,
  } = signale
  const trigger = position?.kaufTrigger
  let pts = 0

  if (forwardPe != null) {
    const ref = trigger?.peMax ?? historischerMedianPe
    if (ref != null && ref > 0) {
      const ratio = forwardPe / ref
      if (ratio <= 0.75) pts += 14
      else if (ratio <= 0.9) pts += 11
      else if (ratio <= 1.0) pts += 5
      else if (ratio <= 1.1) pts += 1
      // >1.1× Median/Trigger: 0 — kein Fair-Value-Bonus nahe ATH
    } else if (forwardPe < 16) pts += 10
    else if (forwardPe < 22) pts += 5
    else if (forwardPe < 28) pts += 1
  }

  if (fcfYieldPct != null) {
    const ref = trigger?.fcfYieldMin ?? historischerMedianFcfYield
    if (ref != null && ref > 0) {
      const ratio = fcfYieldPct / ref
      if (ratio >= 1.25) pts += 12
      else if (ratio >= 1.1) pts += 9
      else if (ratio >= 1.0) pts += 5
      else if (ratio >= 0.9) pts += 2
    } else if (fcfYieldPct >= 5) pts += 9
    else if (fcfYieldPct >= 3.5) pts += 5
    else if (fcfYieldPct >= 2.5) pts += 2
  }

  // EV: zuerst vs. eigener 5J-Median, sonst absolute Buckets / EV/Sales-Fallback
  if (ntmEvEbitda != null) {
    const ref = historischerMedianEvEbitda
    if (ref != null && ref > 0) {
      const ratio = ntmEvEbitda / ref
      if (ratio <= 0.75) pts += 9
      else if (ratio <= 0.9) pts += 7
      else if (ratio <= 1.0) pts += 3
      else if (ratio <= 1.1) pts += 1
    } else if (ntmEvEbitda < 11) pts += 9
    else if (ntmEvEbitda < 15) pts += 5
    else if (ntmEvEbitda < 18) pts += 2
  } else if (ntmEvRev != null) {
    const ref = historischerMedianEvRev
    if (ref != null && ref > 0) {
      const ratio = ntmEvRev / ref
      if (ratio <= 0.75) pts += 7
      else if (ratio <= 0.9) pts += 5
      else if (ratio <= 1.0) pts += 2
    } else if (ntmEvRev < 3.5) pts += 6
    else if (ntmEvRev < 6) pts += 2
  }

  const metrikAnzahl = [forwardPe, fcfYieldPct, ntmEvEbitda ?? ntmEvRev].filter((v) => v != null).length
  if (metrikAnzahl === 1 && pts > 0) pts = Math.round(pts * 0.85)
  else if (metrikAnzahl === 2 && pts > 22) pts = Math.round(pts * 0.92)

  return Math.min(35, pts)
}

export function berechneKauftriggerBoost(ausgeloest: boolean): number {
  return ausgeloest ? 5 : 0
}

export function berechneKlumpenMalus(klumpenrisiko: boolean, depotGewichtPct: number | null): number {
  if (!klumpenrisiko) return 0
  let malus = -6
  if ((depotGewichtPct ?? 0) >= 20) malus -= 2
  return malus
}

export function berechneRegimeDelta(
  regime: NachkaufRankingKontext['regime'],
  signale: Pick<NachkaufBewertungsSignale, 'premiumDiscountPct' | 'drawdown52wPct'>,
): number {
  if (!regime) return 0
  let delta = 0
  const vix = regime.vixClose ?? 0
  const spyRiskOff = regime.spyAbove20Ma === false
  const spyRiskOn = regime.spyAbove20Ma === true
  const premium = signale.premiumDiscountPct ?? 0
  const dd = signale.drawdown52wPct ?? 0

  // Risk-off / Volatilität: Einstiege belohnen
  if (spyRiskOff && dd >= 10) delta += 2
  if (vix >= 25 && dd >= 8) delta += 2
  if (spyRiskOff && vix < 18 && premium <= 0) delta += 1

  // Risk-on / ATH-nah: teure Titel abstrafen
  if (spyRiskOn && vix > 0 && vix < 18 && premium > 5) delta -= 3
  if (spyRiskOn && vix > 0 && vix < 15 && premium > 0) delta -= 2
  if (spyRiskOn && vix > 0 && vix < 18 && dd < 5 && premium > -5) delta -= 1

  return clamp(delta, -5, 4)
}

/** Risk-on = SPY über 20d-MA und VIX < 18. */
export function istRiskOnRegime(regime: NachkaufRankingKontext['regime']): boolean {
  if (!regime) return false
  const vix = regime.vixClose
  return regime.spyAbove20Ma === true && vix != null && vix > 0 && vix < 18
}

export function berechneEarningsFensterMalus(
  tageBisEarnings: number | null,
  kaufTriggerAusgeloest: boolean,
  drawdown52wPct: number | null,
): number {
  if (tageBisEarnings == null || tageBisEarnings < 0 || tageBisEarnings > 5) return 0
  if (kaufTriggerAusgeloest && (drawdown52wPct ?? 0) >= 15) return -1
  return -3
}

const DR_BEAR_STARK = [
  /bear.?case/i,
  /strukturell.*risiko/i,
  /ki[- ]disruption/i,
  /regulatorisch.*(hoch|erhöht|signifikant)/i,
  /vollverkauf/i,
  /überbewertet/i,
  /downgrade.*empfehlung/i,
]
const DR_BEAR_MITTEL = [
  /wettbewerb.*(zunehm|intensiv)/i,
  /margen.*(druck|risiko)/i,
  /wachstum.*(verlangsam|schwächer)/i,
  /unsicherheit/i,
  /caution/i,
]

/** Earnings-Call / SEC-Bericht — kritische operative Signale. */
const BERICHT_BEAR_STARK = [
  /guidance.*(senk|cut|reduzier|zurück|lower|slash)/i,
  /outlook.*(senk|schwächer|worse|lower)/i,
  /warnung|warning|profit.?warn/i,
  /restrukturierung|restructuring|lay.?off|stellenabbau/i,
  /goodwill.?abschreibung|impairment/i,
  /going.?concern|liquidit[aä]tsrisiko/i,
  /untersuchung|investigation|sec.?probe|klage|lawsuit/i,
  /accounting.*(issue|problem|restatement)|bilanzkorrekt/i,
  /nachfrage.*(einbruch|rückgang|schwäche)|demand.*(weak|soft|declin)/i,
]
const BERICHT_BEAR_MITTEL = [
  /vorsichtig|cautious|headwind/i,
  /margen.*(druck|kompression)|margin.*(pressure|compress)/i,
  /verzöger|delay|push(ed)?\s+out/i,
  /kosten.*(steig|höher)|cost.*(inflat|press)/i,
  /wettbewerb|competitive.?pressure/i,
  /unsicher|uncertainty|volatil/i,
  /unter.?erwartung|miss(ed)?\s+(estimates|consensus)/i,
  /schwächeres?\s+wachstum|slower\s+growth/i,
]
const BERICHT_BULL = [
  /anheb.*guidance|raised?\s+guidance|guidance.*(anheb|erhöh|raised)/i,
  /beat(s|en)?\s+(estimates|consensus|erwart)/i,
  /rekord|record\s+(revenue|quarter)/i,
  /stärkeres?\s+wachstum|accelerat(ing|ed)\s+growth/i,
  /margin.*(expand|ausweit)/i,
]

export function berechneDeepResearchMalus(memo: string | null | undefined): number {
  if (!memo || memo.length < 80) return 0
  const stark = DR_BEAR_STARK.filter((re) => re.test(memo)).length
  const mittel = DR_BEAR_MITTEL.filter((re) => re.test(memo)).length
  if (stark >= 2) return -12
  if (stark >= 1) return -7
  if (mittel >= 2) return -4
  if (mittel >= 1) return -2
  return 0
}

/**
 * Malus/Bonus aus Earnings-Call- und SEC-KI-Zusammenfassungen (Cache).
 * Wirkt auf Score + Ampel — nicht nur auf den Fließtext.
 */
export function berechneKiBerichtMalus(
  earningsZusammenfassung: string | null | undefined,
  secZusammenfassung: string | null | undefined,
): number {
  const texte = [earningsZusammenfassung, secZusammenfassung]
    .map((t) => (t ?? '').trim())
    .filter((t) => t.length >= 60)
  if (texte.length === 0) return 0

  let stark = 0
  let mittel = 0
  let bull = 0
  for (const t of texte) {
    stark += BERICHT_BEAR_STARK.filter((re) => re.test(t)).length
    mittel += BERICHT_BEAR_MITTEL.filter((re) => re.test(t)).length
    bull += BERICHT_BULL.filter((re) => re.test(t)).length
  }

  let delta = 0
  if (stark >= 2) delta -= 10
  else if (stark >= 1) delta -= 6
  else if (mittel >= 3) delta -= 4
  else if (mittel >= 1) delta -= 2

  if (bull >= 2 && stark === 0) delta += 2
  else if (bull >= 1 && stark === 0 && mittel === 0) delta += 1

  return clamp(delta, -10, 2)
}

/**
 * Kombiniert Deep Research + Earnings/SEC-Cache für den Score-Slot `deepResearchMalus`.
 */
export function berechneQualitaetsTextMalus(opts: {
  deepResearchMemo?: string | null
  earningsZusammenfassung?: string | null
  secZusammenfassung?: string | null
}): number {
  const dr = berechneDeepResearchMalus(opts.deepResearchMemo)
  const berichte = berechneKiBerichtMalus(opts.earningsZusammenfassung, opts.secZusammenfassung)
  return clamp(dr + berichte, -15, 2)
}

export function berechneScoreKalibrierungBonus(
  gesamtScore: number,
  buckets: NachkaufScoreBucketStat[],
): number {
  if (buckets.length === 0) return 0
  const b90 = buckets.find((b) => b.bucket === '90+')
  const b80 = buckets.find((b) => b.bucket === '80–89')
  if (gesamtScore >= 90 && b90?.avgAlpha6mPct != null && b90.avgAlpha6mPct < -2) return -3
  if (gesamtScore >= 80 && gesamtScore < 90 && b80?.avgAlpha6mPct != null && b80.avgAlpha6mPct > 4) {
    return 2
  }
  return 0
}

export function berechneSektorDiversitaetsMalus(
  eintragSektor: WhitelistSektor | undefined,
  grueneSektoren: Map<WhitelistSektor, number>,
): number {
  if (!eintragSektor) return 0
  const anzahl = grueneSektoren.get(eintragSektor) ?? 0
  if (anzahl >= 3) return -6
  if (anzahl >= 2) return -3
  return 0
}

/** Qualität = Q-Achse (0–100), neu berechnet aus Score-Feldern. */
export function berechneQualitaetsRang(detail: NachkaufScoreDetail): number {
  return Math.round(
    berechneQualitaetsAchse({
      mantraScore: detail.mantraScore,
      sellTriggerPenalty: detail.sellTriggerPenalty,
      deepResearchMalus: detail.deepResearchMalus,
    }),
  )
}

/** Timing = T-Achse (0–100), neu berechnet aus Score-Feldern. */
export function berechneTimingRang(
  detail: NachkaufScoreDetail,
  _signale: Pick<NachkaufBewertungsSignale, 'drawdown52wPct'>,
): number {
  const m = detail.strukturMultiplikator ?? berechneStrukturMultiplikator(detail.strukturPunkte)
  return Math.round(
    berechneTimingAchse({
      bewertungsScore: detail.bewertungsScore,
      histFeintuningPct: detail.historischerBewertungsBonus,
      strukturMultiplikator: m,
      kaufTriggerAusgeloest: detail.kauftriggerBonus > 0,
      regimeDelta: detail.regimeDelta,
    }),
  )
}

/** Langfrist: geometrischer Kern √(Q·T). */
export function berechneKombiniertRang(qualitaet: number, timing: number): number {
  return berechneGeometrischenKern(qualitaet, timing)
}

/**
 * Grün-Schwelle (Legacy-Hilfsgröße). Absolute Grün-Entscheidung läuft über Gates + Relativ-Filter.
 */
export function gruenSchwelle(
  kaufTriggerAusgeloest: boolean,
  regime?: NachkaufRankingKontext['regime'],
): number {
  let base = kaufTriggerAusgeloest ? 68 : 78
  if (istRiskOnRegime(regime ?? null)) base += 6
  return base
}

export function gelbSchwelle(kaufTriggerAusgeloest: boolean): number {
  return kaufTriggerAusgeloest ? 52 : 58
}

/** Max. Anzahl „Nachkauf-Kandidaten“ (Grün) — Fokus statt Streuung. */
export function maxGruenKandidaten(regime?: NachkaufRankingKontext['regime']): number {
  return istRiskOnRegime(regime ?? null) ? 3 : 5
}

export type AmpelKalibrierungInput = {
  scoreDetail: NachkaufScoreDetail
  signale: NachkaufBewertungsSignale
  regime: NachkaufRankingKontext['regime']
  kaufTriggerAusgeloest: boolean
}

/**
 * Absolute Grün-Voraussetzung (Gates). Relativ-Filter (Top 10% / Median+10) kommt in Finalisierung.
 */
export function istKalibriertesGruen(input: AmpelKalibrierungInput): boolean {
  const { scoreDetail, signale, regime, kaufTriggerAusgeloest } = input

  const g1 = scoreDetail.gateG1 ?? pruefGateG1(scoreDetail.mantraScore, scoreDetail.sellTriggerPenalty <= -25)
  const g2 = scoreDetail.gateG2 ?? pruefGateG2(kaufTriggerAusgeloest, signale)
  if (!g1 || !g2) return false

  if (pruefGateG3Teuer(kaufTriggerAusgeloest, signale)) return false

  const vollstaendig = (scoreDetail.datenVollstaendigkeitPct ?? 0) >= 55
  if (!vollstaendig) return false

  const q = scoreDetail.qualitaetsRang ?? 0
  const t = scoreDetail.timingRang ?? 0
  if (q < 60 || t < 55) return false

  if ((scoreDetail.deepResearchMalus ?? 0) <= -6 && !kaufTriggerAusgeloest) return false

  const vix = regime?.vixClose ?? 0
  const premium = signale.premiumDiscountPct ?? 0
  if (vix > 0 && vix < 18 && !kaufTriggerAusgeloest && premium > 0) return false

  return true
}

export function kalibrierungBonusFuerScore(
  score: number,
  batch: NachkaufBatchKontext,
): number {
  return berechneScoreKalibrierungBonus(score, batch.scoreBuckets)
}

export function segmentStrukturVerwenden(qualitaet: SegmentDatenQualitaet): boolean {
  return qualitaet === 'validiert'
}

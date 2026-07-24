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
  const { forwardPe, fcfYieldPct, ntmEvEbitda, historischerMedianPe, historischerMedianFcfYield } = signale
  const trigger = position?.kaufTrigger
  let pts = 0

  if (forwardPe != null) {
    const ref = trigger?.peMax ?? historischerMedianPe
    if (ref != null && ref > 0) {
      const ratio = forwardPe / ref
      if (ratio <= 0.75) pts += 14
      else if (ratio <= 0.9) pts += 11
      else if (ratio <= 1.0) pts += 8
      else if (ratio <= 1.15) pts += 4
      else if (ratio <= 1.3) pts += 1
    } else if (forwardPe < 18) pts += 10
    else if (forwardPe < 25) pts += 6
    else if (forwardPe < 35) pts += 2
  }

  if (fcfYieldPct != null) {
    const ref = trigger?.fcfYieldMin ?? historischerMedianFcfYield
    if (ref != null && ref > 0) {
      const ratio = fcfYieldPct / ref
      if (ratio >= 1.2) pts += 12
      else if (ratio >= 1.0) pts += 9
      else if (ratio >= 0.85) pts += 6
      else if (ratio >= 0.7) pts += 3
    } else if (fcfYieldPct >= 4.5) pts += 9
    else if (fcfYieldPct >= 3) pts += 6
    else if (fcfYieldPct >= 2) pts += 3
  }

  if (ntmEvEbitda != null) {
    if (ntmEvEbitda < 12) pts += 9
    else if (ntmEvEbitda < 16) pts += 6
    else if (ntmEvEbitda < 22) pts += 3
  }

  const metrikAnzahl = [forwardPe, fcfYieldPct, ntmEvEbitda].filter((v) => v != null).length
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

  if (spyRiskOff && (signale.drawdown52wPct ?? 0) >= 10) delta += 2
  if (vix >= 25 && (signale.drawdown52wPct ?? 0) >= 8) delta += 2
  if (vix < 15 && (signale.premiumDiscountPct ?? 0) > 12) delta -= 2
  if (spyRiskOff && vix < 18 && (signale.premiumDiscountPct ?? 0) <= 0) delta += 1

  return clamp(delta, -3, 4)
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
  if (anzahl >= 4) return -4
  if (anzahl >= 3) return -2
  return 0
}

/** Qualität = Mantra + operative Stärke (0–100). */
export function berechneQualitaetsRang(detail: NachkaufScoreDetail): number {
  const momentumExtra = Math.max(0, detail.momentumPunkte - 5)
  const strukturPos = Math.max(0, detail.strukturPunkte)
  const roh =
    detail.mantraScore * 1.6 +
    momentumExtra * 2.5 +
    strukturPos * 2 +
    detail.insiderPunkte * 3 +
    Math.max(0, detail.sellTriggerPenalty + 25) * 0.3
  return clamp(Math.round(roh), 0, 100)
}

/** Timing = Bewertung + Einstiegsfenster (0–100). Kein Roh-Drawdown — der steckt schon in drawdownBonus. */
export function berechneTimingRang(
  detail: NachkaufScoreDetail,
  _signale: Pick<NachkaufBewertungsSignale, 'drawdown52wPct'>,
): number {
  const roh =
    detail.bewertungsScore * 2.2 +
    detail.historischerBewertungsBonus * 2.5 +
    detail.drawdownBonus * 3 +
    detail.kauftriggerBonus * 2.5 +
    detail.regimeDelta * 1.5 +
    detail.scoreKalibrierung * 2 +
    detail.earningsMalus * 1.5 +
    detail.deepResearchMalus * 0.8
  return clamp(Math.round(roh), 0, 100)
}

/** Langfrist-Bias: Qualität wiegt etwas stärker als Timing. */
export function berechneKombiniertRang(qualitaet: number, timing: number): number {
  return clamp(Math.round(qualitaet * 0.55 + timing * 0.45), 0, 100)
}

export function gruenSchwelle(kaufTriggerAusgeloest: boolean): number {
  return kaufTriggerAusgeloest ? 58 : 68
}

export function gelbSchwelle(kaufTriggerAusgeloest: boolean): number {
  return kaufTriggerAusgeloest ? 38 : 42
}

export type AmpelKalibrierungInput = {
  scoreDetail: NachkaufScoreDetail
  signale: NachkaufBewertungsSignale
  regime: NachkaufRankingKontext['regime']
  kaufTriggerAusgeloest: boolean
}

/** Kalibrierte Ampel-Schwellen inkl. Regime- und Dual-Ranking-Check. */
export function istKalibriertesGruen(input: AmpelKalibrierungInput): boolean {
  const { scoreDetail, signale, regime, kaufTriggerAusgeloest } = input
  const schwelle = gruenSchwelle(kaufTriggerAusgeloest)
  const vollstaendig = (scoreDetail.datenVollstaendigkeitPct ?? 0) >= 45
  const qualOk = (scoreDetail.qualitaetsRang ?? 0) >= 48
  const timingOk = (scoreDetail.timingRang ?? 0) >= 52

  if (scoreDetail.gesamt < schwelle || !vollstaendig || !qualOk || !timingOk) return false

  const vix = regime?.vixClose ?? 0
  if (
    vix > 0 &&
    vix < 15 &&
    !kaufTriggerAusgeloest &&
    scoreDetail.gesamt < 75 &&
    (signale.premiumDiscountPct ?? 0) > 8
  ) {
    return false
  }
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

/**
 * Mean-Reversion-Playbooks — Oversold, Overbought, Range-Fade.
 */

import 'server-only'

import { tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  MR_EARNINGS_EXCLUDE_TAGE,
  RANGE_EDGE_DIST_MAX_PCT,
  RANGE_MAX_ATR_PCT,
  RANGE_MAX_WIDTH_PCT,
  RSI_EXTREME_OVERSOLD,
  RSI_OVERBOUGHT,
  RSI_OVERSOLD,
  SPY_CRASH_5D_PCT,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import {
  baueScanEintrag,
  pruefeRegimeRichtung,
  scoreAusGates,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-playbook-hilfen'
import type {
  MomentumBarDaily,
  MomentumEarningsKalenderEintrag,
  MomentumRegimeGates,
  MomentumRegimeKontext,
  MomentumRichtung,
  MomentumScanEintrag,
  MomentumTechSnapshot,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

function hatEarningsBald(
  symbol: string,
  handelstag: string,
  kalender: MomentumEarningsKalenderEintrag[],
  tage = MR_EARNINGS_EXCLUDE_TAGE,
): boolean {
  return kalender.some((k) => {
    if (k.symbol !== symbol) return false
    const diff = Math.abs(tageZwischenIso(k.earningsDate, handelstag))
    return diff <= tage
  })
}

function bewerteOversoldBounce(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  kalender: MomentumEarningsKalenderEintrag[],
  rk: MomentumRegimeKontext,
): MomentumScanEintrag | null {
  if (hatEarningsBald(tech.symbol, tech.handelstag, kalender)) return null

  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  if (tech.rsi14 != null && tech.rsi14 <= RSI_OVERSOLD) {
    gatesPassed.push('RSI ≤ ' + RSI_OVERSOLD + ' (' + tech.rsi14 + ')')
  } else {
    gatesFailed.push('RSI nicht oversold (' + tech.rsi14 + ')')
  }

  if (tech.bbLower != null && tech.close <= tech.bbLower * 1.01) {
    gatesPassed.push('Close am/unter unterem Bollinger (' + tech.bbLower + ')')
  } else {
    gatesFailed.push('Nicht am unteren Bollinger')
  }

  const spy5 = rk.spyReturn5dPct ?? regimeGates.regime.spyReturn5dPct
  if (spy5 != null && spy5 > SPY_CRASH_5D_PCT) {
    gatesPassed.push('Kein SPY-Crash (5T ' + spy5 + '%)')
  } else {
    gatesFailed.push('SPY unter Druck (5T ' + spy5 + '%) — Bounce riskant')
  }

  const richtung: MomentumRichtung = 'long'
  if (regimeGates.longBias) gatesPassed.push('Regime: Long-Bias')
  else if (tech.rsi14 != null && tech.rsi14 <= RSI_EXTREME_OVERSOLD) {
    gatesPassed.push('Extrem oversold — Long trotz neutralem Regime')
  } else {
    gatesFailed.push('Regime: kein Long-Bias')
  }

  let basis = 38
  if (tech.rsi14 != null) basis += Math.min(15, (RSI_OVERSOLD - tech.rsi14) * 1.2)
  const score = scoreAusGates(basis, gatesPassed, gatesFailed)
  if (score < 40) return null

  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'oversold_bounce',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar: bars[bars.length - 1],
    tech,
    atr: tech.atr,
    richtung,
    indikatoren: {
      rsi14: tech.rsi14,
      bbLower: tech.bbLower,
      spyReturn5dPct: spy5,
      setupPhase: 'jetzt',
    },
  })
}

function bewerteOverboughtFade(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  kalender: MomentumEarningsKalenderEintrag[],
): MomentumScanEintrag | null {
  if (hatEarningsBald(tech.symbol, tech.handelstag, kalender)) return null

  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  if (tech.rsi14 != null && tech.rsi14 >= RSI_OVERBOUGHT) {
    gatesPassed.push('RSI ≥ ' + RSI_OVERBOUGHT + ' (' + tech.rsi14 + ')')
  } else {
    gatesFailed.push('RSI nicht overbought (' + tech.rsi14 + ')')
  }

  if (tech.bbUpper != null && tech.close >= tech.bbUpper * 0.99) {
    gatesPassed.push('Close am/über oberem Bollinger (' + tech.bbUpper + ')')
  } else {
    gatesFailed.push('Nicht am oberen Bollinger')
  }

  if (tech.shortFloatPct != null && tech.shortFloatPct >= 15) {
    gatesFailed.push('Hoher Short Float (' + tech.shortFloatPct + '%) — Squeeze-Risiko')
  } else if (tech.shortFloatPct != null) {
    gatesPassed.push('Short Float moderat (' + tech.shortFloatPct + '%)')
  }

  const richtung: MomentumRichtung = 'short'
  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  let basis = 36
  if (tech.rsi14 != null) basis += Math.min(18, (tech.rsi14 - RSI_OVERBOUGHT) * 1.5)
  const score = scoreAusGates(basis, gatesPassed, gatesFailed)
  if (score < 40) return null

  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'overbought_fade',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar: bars[bars.length - 1],
    tech,
    atr: tech.atr,
    richtung,
    indikatoren: {
      rsi14: tech.rsi14,
      bbUpper: tech.bbUpper,
      shortFloatPct: tech.shortFloatPct,
      setupPhase: 'jetzt',
    },
  })
}

function bewerteRangeFade(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
): MomentumScanEintrag | null {
  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  if (tech.range20dPct != null && tech.range20dPct <= RANGE_MAX_WIDTH_PCT) {
    gatesPassed.push('Enge 20T-Range (' + tech.range20dPct + '% Breite)')
  } else {
    gatesFailed.push('Range zu breit (' + tech.range20dPct + '%)')
  }

  if (tech.atrPct != null && tech.atrPct <= RANGE_MAX_ATR_PCT) {
    gatesPassed.push('Niedrige ATR% (' + tech.atrPct + '%)')
  } else {
    gatesFailed.push('ATR zu hoch für Range-Trade (' + tech.atrPct + '%)')
  }

  let richtung: MomentumRichtung | null = null
  if (tech.distRangeLowPct != null && tech.distRangeLowPct <= RANGE_EDGE_DIST_MAX_PCT) {
    richtung = 'long'
    gatesPassed.push('Preis nahe Range-Tief (' + tech.distRangeLowPct + '%)')
  } else if (tech.distRangeHighPct != null && tech.distRangeHighPct <= RANGE_EDGE_DIST_MAX_PCT) {
    richtung = 'short'
    gatesPassed.push('Preis nahe Range-Hoch (' + tech.distRangeHighPct + '%)')
  } else {
    gatesFailed.push('Preis in Range-Mitte — kein Fade')
  }

  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  let basis = 34
  if (tech.range20dPct != null) basis += Math.min(12, (RANGE_MAX_WIDTH_PCT - tech.range20dPct) * 0.8)
  const score = scoreAusGates(basis, gatesPassed, gatesFailed)
  if (score < 38 || !richtung) return null

  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'range_fade',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar: bars[bars.length - 1],
    tech,
    atr: tech.atr,
    richtung,
    indikatoren: {
      range20dPct: tech.range20dPct,
      distRangeLowPct: tech.distRangeLowPct,
      distRangeHighPct: tech.distRangeHighPct,
      atrPct: tech.atrPct,
      setupPhase: 'jetzt',
    },
  })
}

/** Mean-Reversion-Playbooks für ein Symbol. */
export function bewerteMeanReversionPlaybooks(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  kalender: MomentumEarningsKalenderEintrag[],
  rk: MomentumRegimeKontext,
): MomentumScanEintrag[] {
  const out: MomentumScanEintrag[] = []
  for (const e of [
    bewerteOversoldBounce(tech, bars, regimeGates, kalender, rk),
    bewerteOverboughtFade(tech, bars, regimeGates, kalender),
    bewerteRangeFade(tech, bars, regimeGates),
  ]) {
    if (e && (e.ampel === 'gruen' || e.ampel === 'gelb')) out.push(e)
  }
  return out
}

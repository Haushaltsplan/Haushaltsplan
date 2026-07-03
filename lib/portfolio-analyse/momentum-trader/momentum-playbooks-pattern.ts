/**
 * Pattern-Playbooks — NR7, Inside Day, Failed Breakout, Exhaustion, etc.
 */

import 'server-only'

import { tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  CAPITULATION_DAY_MIN_DROP_PCT,
  CAPITULATION_MIN_RVOL,
  CAPITULATION_RSI_MAX,
  DAILY_RVOL_MIN,
  EARNINGS_GAP_EXCLUDE_TAGE,
  FAILED_BREAKOUT_MIN_RVOL,
  INSIDE_DAY_MIN_RVOL,
  MR_EARNINGS_EXCLUDE_TAGE,
  NR7_MIN_RVOL,
  REL_WEAKNESS_MAX_RS_PCT,
  RS_MIN_LONG_PCT,
  SECTOR_LAGGARD_MAX_SECTOR_RET,
  SECTOR_LAGGARD_MIN_RS,
  SPY_CRASH_5D_PCT,
  TREND_EXHAUSTION_MA_DIST_MIN_PCT,
  TREND_EXHAUSTION_MIN_RSI,
  TREND_EXHAUSTION_MIN_RUN_PCT,
  VIX_SPIKE_FADE_RSI_MAX,
  VIX_SPIKE_FADE_SPY_MAX_PCT,
  VIX_SPIKE_MIN_CHANGE_PCT,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import {
  berechneReturnPct,
  istInsideDay,
  istMaCrossFrisch,
  istNr7,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-indicators'
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

function hatEarningsInNaehe(
  symbol: string,
  handelstag: string,
  kalender: MomentumEarningsKalenderEintrag[],
  tage = EARNINGS_GAP_EXCLUDE_TAGE,
): boolean {
  return kalender.some((k) => {
    if (k.symbol !== symbol) return false
    return Math.abs(tageZwischenIso(k.earningsDate, handelstag)) <= tage
  })
}

function bewerteNr7Breakout(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  kalender: MomentumEarningsKalenderEintrag[],
): MomentumScanEintrag | null {
  if (hatEarningsInNaehe(tech.symbol, tech.handelstag, kalender) || bars.length < 10) return null
  const idx = bars.length - 1
  const prevIdx = idx - 1
  if (prevIdx < 6) return null

  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  if (istNr7(bars, prevIdx)) gatesPassed.push('NR7 gestern (engste 7-Tage-Range)')
  else {
    gatesFailed.push('Kein NR7-Setup')
    return null
  }

  const prev = bars[prevIdx]
  const bar = bars[idx]
  if (bar.close > prev.high) {
    gatesPassed.push('Ausbruch über NR7-High (' + prev.high + ')')
  } else {
    gatesFailed.push('Kein Breakout über gestriges High')
    return null
  }

  if (tech.rvol != null && tech.rvol >= NR7_MIN_RVOL) {
    gatesPassed.push('RVOL ≥ ' + NR7_MIN_RVOL + ' (' + tech.rvol + '×)')
  } else {
    gatesFailed.push('RVOL zu niedrig')
  }

  const richtung: MomentumRichtung = 'long'
  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  const score = scoreAusGates(40, gatesPassed, gatesFailed)
  if (score < 42) return null

  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'nr7_breakout',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar,
    atr: tech.atr,
    tech,
    richtung,
    indikatoren: { rvol: tech.rvol, nr7High: prev.high, setupPhase: 'jetzt' },
  })
}

function bewerteInsideDayBreakout(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  kalender: MomentumEarningsKalenderEintrag[],
): MomentumScanEintrag | null {
  if (hatEarningsInNaehe(tech.symbol, tech.handelstag, kalender) || bars.length < 4) return null
  const idx = bars.length - 1
  const insideIdx = idx - 1
  const motherIdx = idx - 2
  if (motherIdx < 0) return null

  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  if (istInsideDay(bars, insideIdx)) gatesPassed.push('Inside Day gestern')
  else {
    gatesFailed.push('Kein Inside Day')
    return null
  }

  const mother = bars[motherIdx]
  const bar = bars[idx]
  if (bar.close > mother.high) {
    gatesPassed.push('Breakout über Mother-Bar-High (' + mother.high + ')')
  } else if (bar.close < mother.low) {
    gatesPassed.push('Breakdown unter Mother-Bar-Low (' + mother.low + ')')
  } else {
    gatesFailed.push('Kein Ausbruch aus Mother Bar')
    return null
  }

  const richtung: MomentumRichtung = bar.close > mother.high ? 'long' : 'short'
  if (tech.rvol != null && tech.rvol >= INSIDE_DAY_MIN_RVOL) {
    gatesPassed.push('RVOL ' + tech.rvol + '×')
  } else {
    gatesFailed.push('RVOL zu niedrig')
  }

  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  const score = scoreAusGates(38, gatesPassed, gatesFailed)
  if (score < 40) return null

  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'inside_day_breakout',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar,
    atr: tech.atr,
    tech,
    richtung,
    indikatoren: { rvol: tech.rvol, motherHigh: mother.high, motherLow: mother.low, setupPhase: 'jetzt' },
  })
}

function bewerteFailedBreakout(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  kalender: MomentumEarningsKalenderEintrag[],
): MomentumScanEintrag | null {
  if (hatEarningsInNaehe(tech.symbol, tech.handelstag, kalender, MR_EARNINGS_EXCLUDE_TAGE)) return null
  if (tech.high20d == null || bars.length < 22) return null

  const bar = bars[bars.length - 1]
  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  if (bar.high > tech.high20d) {
    gatesPassed.push('Neues 20T-High intraday (' + bar.high + ')')
  } else {
    return null
  }

  if (bar.close < tech.high20d) {
    gatesPassed.push('Close unter Breakout-Level (Failed Breakout)')
  } else {
    gatesFailed.push('Close hält über High — kein Fail')
    return null
  }

  if (tech.rvol != null && tech.rvol >= FAILED_BREAKOUT_MIN_RVOL) {
    gatesPassed.push('RVOL ' + tech.rvol + '×')
  } else {
    gatesFailed.push('RVOL zu niedrig')
  }

  const richtung: MomentumRichtung = 'short'
  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  const score = scoreAusGates(36, gatesPassed, gatesFailed)
  if (score < 40) return null

  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'failed_breakout',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar,
    atr: tech.atr,
    tech,
    richtung,
    indikatoren: { high20d: tech.high20d, rvol: tech.rvol, setupPhase: 'jetzt' },
  })
}

function bewerteRelativeWeaknessFade(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  kalender: MomentumEarningsKalenderEintrag[],
): MomentumScanEintrag | null {
  if (hatEarningsInNaehe(tech.symbol, tech.handelstag, kalender)) return null

  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  if (tech.rsVsSpy20d != null && tech.rsVsSpy20d <= REL_WEAKNESS_MAX_RS_PCT) {
    gatesPassed.push('RS vs. S&P ' + tech.rsVsSpy20d + '% (schwach)')
  } else {
    return null
  }

  if (tech.downtrend || !tech.aboveMa20) gatesPassed.push('Abwärtstrend / unter MA20')
  else gatesFailed.push('Kein klarer Abwärtstrend')

  if (tech.rvol != null && tech.rvol >= DAILY_RVOL_MIN) {
    gatesPassed.push('RVOL ' + tech.rvol + '×')
  } else {
    gatesFailed.push('RVOL zu niedrig')
  }

  const richtung: MomentumRichtung = 'short'
  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  const score = scoreAusGates(35, gatesPassed, gatesFailed)
  if (score < 40) return null

  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'relative_weakness_fade',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar: bars[bars.length - 1],
    tech,
    atr: tech.atr,
    richtung,
    indikatoren: { rsVsSpy20d: tech.rsVsSpy20d, rvol: tech.rvol, setupPhase: 'jetzt' },
  })
}

function bewerteCapitulationBounce(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  kalender: MomentumEarningsKalenderEintrag[],
  rk: MomentumRegimeKontext,
): MomentumScanEintrag | null {
  if (hatEarningsInNaehe(tech.symbol, tech.handelstag, kalender, MR_EARNINGS_EXCLUDE_TAGE)) return null
  const idx = bars.length - 1
  const dayRet = berechneReturnPct(bars, idx, 1)

  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  if (tech.rsi14 != null && tech.rsi14 <= CAPITULATION_RSI_MAX) {
    gatesPassed.push('RSI ≤ ' + CAPITULATION_RSI_MAX + ' (' + tech.rsi14 + ')')
  } else {
    return null
  }

  if (dayRet != null && dayRet <= CAPITULATION_DAY_MIN_DROP_PCT) {
    gatesPassed.push('Tagesverlust ' + dayRet + '%')
  } else {
    gatesFailed.push('Kein Capitulation-Tag')
    return null
  }

  if (tech.rvol != null && tech.rvol >= CAPITULATION_MIN_RVOL) {
    gatesPassed.push('Panik-Volumen RVOL ' + tech.rvol + '×')
  } else {
    gatesFailed.push('Volumen-Spike fehlt')
  }

  const spy5 = rk.spyReturn5dPct ?? regimeGates.regime.spyReturn5dPct
  if (spy5 != null && spy5 > SPY_CRASH_5D_PCT) {
    gatesPassed.push('SPY 5T ' + spy5 + '% (kein Crash)')
  } else {
    gatesFailed.push('Markt-Crash — Bounce riskant')
  }

  const richtung: MomentumRichtung = 'long'
  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  const score = scoreAusGates(40, gatesPassed, gatesFailed)
  if (score < 42) return null

  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'capitulation_bounce',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar: bars[idx],
    tech,
    atr: tech.atr,
    richtung,
    indikatoren: { rsi14: tech.rsi14, dayReturnPct: dayRet, rvol: tech.rvol, setupPhase: 'jetzt' },
  })
}

function bewerteMaCrossMomentum(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  kalender: MomentumEarningsKalenderEintrag[],
): MomentumScanEintrag | null {
  if (hatEarningsInNaehe(tech.symbol, tech.handelstag, kalender)) return null
  const idx = bars.length - 1

  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  if (istMaCrossFrisch(bars, idx)) gatesPassed.push('Golden Cross frisch (MA20 > MA50)')
  else {
    return null
  }

  if (tech.aboveMa20) gatesPassed.push('Close über MA20')
  else gatesFailed.push('Unter MA20')

  if (tech.rsVsSpy20d != null && tech.rsVsSpy20d >= RS_MIN_LONG_PCT) {
    gatesPassed.push('RS vs. S&P ' + tech.rsVsSpy20d + '%')
  } else {
    gatesFailed.push('RS schwach')
  }

  const richtung: MomentumRichtung = 'long'
  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  const score = scoreAusGates(42, gatesPassed, gatesFailed)
  if (score < 44) return null

  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'ma_cross_momentum',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar: bars[idx],
    tech,
    atr: tech.atr,
    richtung,
    indikatoren: { ma20: tech.ma20, ma50: tech.ma50, rsVsSpy20d: tech.rsVsSpy20d, setupPhase: 'jetzt' },
  })
}

function bewerteTrendExhaustion(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  kalender: MomentumEarningsKalenderEintrag[],
): MomentumScanEintrag | null {
  if (hatEarningsInNaehe(tech.symbol, tech.handelstag, kalender)) return null

  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  if (tech.return20dPct != null && tech.return20dPct >= TREND_EXHAUSTION_MIN_RUN_PCT) {
    gatesPassed.push('20T-Lauf +' + tech.return20dPct + '%')
  } else {
    return null
  }

  if (tech.rsi14 != null && tech.rsi14 >= TREND_EXHAUSTION_MIN_RSI) {
    gatesPassed.push('RSI ≥ ' + TREND_EXHAUSTION_MIN_RSI + ' (' + tech.rsi14 + ')')
  } else {
    gatesFailed.push('RSI nicht überdehnt')
    return null
  }

  if (tech.ma20 != null && tech.close > 0) {
    const dist = ((tech.close - tech.ma20) / tech.close) * 100
    if (dist >= TREND_EXHAUSTION_MA_DIST_MIN_PCT) {
      gatesPassed.push('+' + dist.toFixed(1) + '% über MA20')
    } else {
      gatesFailed.push('Zu nah an MA20')
      return null
    }
  }

  const richtung: MomentumRichtung = 'short'
  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  const score = scoreAusGates(36, gatesPassed, gatesFailed)
  if (score < 40) return null

  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'trend_exhaustion',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar: bars[bars.length - 1],
    tech,
    atr: tech.atr,
    richtung,
    indikatoren: {
      return20dPct: tech.return20dPct,
      rsi14: tech.rsi14,
      setupPhase: 'jetzt',
    },
  })
}

function bewerteSectorLaggardCatchup(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  sectorEtf: string | null,
  rk: MomentumRegimeKontext,
): MomentumScanEintrag | null {
  if (!sectorEtf) return null

  const gatesPassed: string[] = []
  const gatesFailed: string[] = []
  const secRet = rk.sectorReturn5d[sectorEtf]

  if (secRet != null && secRet <= SECTOR_LAGGARD_MAX_SECTOR_RET) {
    gatesPassed.push('Sektor schwach 5T (' + secRet + '%)')
  } else {
    return null
  }

  if (tech.rsVsSector20d != null && tech.rsVsSector20d >= SECTOR_LAGGARD_MIN_RS) {
    gatesPassed.push('Titel führt im Sektor (RS ' + tech.rsVsSector20d + '%)')
  } else {
    gatesFailed.push('Kein Catch-up vs. Sektor')
    return null
  }

  if (tech.aboveMa20) gatesPassed.push('Über MA20')
  else gatesFailed.push('Unter MA20')

  const richtung: MomentumRichtung = 'long'
  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  const score = scoreAusGates(38, gatesPassed, gatesFailed)
  if (score < 42) return null

  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'sector_laggard_catchup',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar: bars[bars.length - 1],
    tech,
    atr: tech.atr,
    richtung,
    indikatoren: {
      sectorEtf,
      sectorReturn5d: secRet,
      rsVsSector20d: tech.rsVsSector20d,
      setupPhase: 'jetzt',
    },
  })
}

function bewerteVixSpikeFade(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  kalender: MomentumEarningsKalenderEintrag[],
): MomentumScanEintrag | null {
  if (hatEarningsInNaehe(tech.symbol, tech.handelstag, kalender, MR_EARNINGS_EXCLUDE_TAGE)) return null

  const vixChg = regimeGates.regime.vixChangePct
  const spy5 = regimeGates.regime.spyReturn5dPct

  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  if (vixChg != null && vixChg >= VIX_SPIKE_MIN_CHANGE_PCT) {
    gatesPassed.push('VIX-Spike +' + vixChg + '%')
  } else if (regimeGates.regime.vixClose != null && regimeGates.regime.vixClose >= 22) {
    gatesPassed.push('VIX erhöht (' + regimeGates.regime.vixClose + ')')
  } else {
    return null
  }

  if (spy5 != null && spy5 <= VIX_SPIKE_FADE_SPY_MAX_PCT) {
    gatesPassed.push('SPY 5T ' + spy5 + '% (Risk-off)')
  } else {
    gatesFailed.push('SPY nicht unter Druck')
    return null
  }

  if (tech.rsi14 != null && tech.rsi14 <= VIX_SPIKE_FADE_RSI_MAX) {
    gatesPassed.push('RSI ' + tech.rsi14 + ' (überverkauft)')
  } else if (tech.rsi14 != null && tech.rsi14 <= 45) {
    gatesPassed.push('RSI gedrückt (' + tech.rsi14 + ')')
  } else {
    gatesFailed.push('Kein Oversold am Titel')
    return null
  }

  const richtung: MomentumRichtung = 'long'
  if (regimeGates.longBias) gatesPassed.push('Regime: Long-Bias')
  else gatesPassed.push('Mean-Reversion nach VIX-Spike')

  const score = scoreAusGates(36, gatesPassed, gatesFailed)
  if (score < 40) return null

  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'vix_spike_fade',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar: bars[bars.length - 1],
    tech,
    atr: tech.atr,
    richtung,
    indikatoren: {
      vixClose: regimeGates.regime.vixClose,
      vixChangePct: vixChg,
      spyReturn5dPct: spy5,
      rsi14: tech.rsi14,
      setupPhase: 'jetzt',
    },
  })
}

/** Pattern-Playbooks für ein Symbol. */
export function bewertePatternPlaybooks(input: {
  tech: MomentumTechSnapshot
  bars: MomentumBarDaily[]
  regimeGates: MomentumRegimeGates
  kalender: MomentumEarningsKalenderEintrag[]
  sectorEtf: string | null
  rk: MomentumRegimeKontext
}): MomentumScanEintrag[] {
  const { tech, bars, regimeGates, kalender, sectorEtf, rk } = input
  const out: MomentumScanEintrag[] = []
  for (const e of [
    bewerteNr7Breakout(tech, bars, regimeGates, kalender),
    bewerteInsideDayBreakout(tech, bars, regimeGates, kalender),
    bewerteFailedBreakout(tech, bars, regimeGates, kalender),
    bewerteRelativeWeaknessFade(tech, bars, regimeGates, kalender),
    bewerteCapitulationBounce(tech, bars, regimeGates, kalender, rk),
    bewerteMaCrossMomentum(tech, bars, regimeGates, kalender),
    bewerteTrendExhaustion(tech, bars, regimeGates, kalender),
    bewerteSectorLaggardCatchup(tech, bars, regimeGates, sectorEtf, rk),
    bewerteVixSpikeFade(tech, bars, regimeGates, kalender),
  ]) {
    if (e && (e.ampel === 'gruen' || e.ampel === 'gelb')) out.push(e)
  }
  return out
}

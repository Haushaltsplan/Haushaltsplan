/**
 * Tägliche Playbooks — Gap, Volumen, Trend (ohne Earnings-Katalysator).
 */

import 'server-only'

import { tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  DAILY_GAP_FADE_MIN_PCT,
  DAILY_GAP_GO_MIN_PCT,
  DAILY_RVOL_BREAKOUT_MIN,
  DAILY_RVOL_GO_MIN,
  DAILY_RVOL_MIN,
  EARNINGS_GAP_EXCLUDE_TAGE,
  RS_LEADER_MIN_PCT,
  RS_MIN_LONG_PCT,
  RS_MAX_SHORT_PCT,
  TREND_BREAKOUT_HIGH_DIST_MAX_PCT,
  TREND_PULLBACK_MA_DIST_MAX_PCT,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import {
  ampelAusScore,
  baueScanEintrag,
  pruefeRegimeRichtung,
  scoreAusGates,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-playbook-hilfen'
import type {
  MomentumBarDaily,
  MomentumEarningsKalenderEintrag,
  MomentumPlaybook,
  MomentumRegimeGates,
  MomentumRichtung,
  MomentumScanEintrag,
  MomentumTechSnapshot,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

function hatEarningsInNaehe(
  symbol: string,
  handelstag: string,
  kalender: MomentumEarningsKalenderEintrag[],
): boolean {
  return kalender.some((k) => {
    if (k.symbol !== symbol) return false
    const diff = Math.abs(tageZwischenIso(k.earningsDate, handelstag))
    return diff <= EARNINGS_GAP_EXCLUDE_TAGE
  })
}

function bewerteGapFade(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  kalender: MomentumEarningsKalenderEintrag[],
): MomentumScanEintrag | null {
  if (hatEarningsInNaehe(tech.symbol, tech.handelstag, kalender)) return null

  const gatesPassed: string[] = []
  const gatesFailed: string[] = []
  const gap = tech.gapPct

  if (gap == null) gatesFailed.push('Gap nicht berechenbar')
  else if (Math.abs(gap) >= DAILY_GAP_FADE_MIN_PCT) {
    gatesPassed.push('Gap ≥ ' + DAILY_GAP_FADE_MIN_PCT + '% (' + gap + '%)')
  } else {
    gatesFailed.push('Gap zu klein (' + gap + '%, min. ' + DAILY_GAP_FADE_MIN_PCT + '%)')
  }

  if (tech.rvol == null) gatesFailed.push('RVOL nicht berechenbar')
  else if (tech.rvol >= DAILY_RVOL_MIN) {
    gatesPassed.push('RVOL ≥ ' + DAILY_RVOL_MIN + ' (' + tech.rvol + '×)')
  } else {
    gatesFailed.push('RVOL zu niedrig (' + tech.rvol + '×)')
  }

  const richtung: MomentumRichtung | null =
    gap != null && gap > 0 ? 'short' : gap != null && gap < 0 ? 'long' : null

  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  let basis = 30
  if (gap != null) basis += Math.min(20, Math.abs(gap) * 2.5)
  if (tech.rvol != null) basis += Math.min(12, (tech.rvol - 1) * 6)
  const score = scoreAusGates(basis, gatesPassed, gatesFailed)

  if (score < 35) return null

  const bar = bars[bars.length - 1]
  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'gap_fade',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar,
    atr: tech.atr,
    tech,
    richtung,
    reactionBar: bar,
    indikatoren: {
      gapPct: gap,
      rvol: tech.rvol,
      rsVsSpy20d: tech.rsVsSpy20d,
      setupPhase: 'jetzt',
      katalysator: 'kein_earnings',
    },
  })
}

function bewerteGapAndGo(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  kalender: MomentumEarningsKalenderEintrag[],
): MomentumScanEintrag | null {
  if (hatEarningsInNaehe(tech.symbol, tech.handelstag, kalender)) return null

  const gatesPassed: string[] = []
  const gatesFailed: string[] = []
  const gap = tech.gapPct

  if (gap == null) gatesFailed.push('Gap nicht berechenbar')
  else if (gap >= DAILY_GAP_GO_MIN_PCT) {
    gatesPassed.push('Gap-Up ≥ ' + DAILY_GAP_GO_MIN_PCT + '% (' + gap + '%)')
  } else if (gap <= -DAILY_GAP_GO_MIN_PCT) {
    gatesPassed.push('Gap-Down ≤ -' + DAILY_GAP_GO_MIN_PCT + '% (' + gap + '%)')
  } else {
    gatesFailed.push('Gap zu klein für Go (' + gap + '%)')
  }

  if (tech.rvol == null) gatesFailed.push('RVOL nicht berechenbar')
  else if (tech.rvol >= DAILY_RVOL_GO_MIN) {
    gatesPassed.push('RVOL ≥ ' + DAILY_RVOL_GO_MIN + ' (' + tech.rvol + '×)')
  } else {
    gatesFailed.push('RVOL zu niedrig (' + tech.rvol + '×)')
  }

  const bullishTag = tech.close > tech.open
  const richtung: MomentumRichtung | null =
    gap != null && gap > 0 && bullishTag
      ? 'long'
      : gap != null && gap < 0 && !bullishTag
        ? 'short'
        : null

  if (richtung == null) gatesFailed.push('Keine klare Gap-Richtung (Close vs. Open)')
  else gatesPassed.push('Gap-Richtung bestätigt (' + richtung.toUpperCase() + ')')

  if (tech.rsVsSpy20d != null && richtung === 'long' && tech.rsVsSpy20d >= RS_MIN_LONG_PCT) {
    gatesPassed.push('RS vs. S&P positiv (' + tech.rsVsSpy20d + '%)')
  } else if (tech.rsVsSpy20d != null && richtung === 'short' && tech.rsVsSpy20d <= RS_MAX_SHORT_PCT) {
    gatesPassed.push('RS vs. S&P schwach (' + tech.rsVsSpy20d + '%)')
  } else if (richtung != null) {
    gatesFailed.push('RS widerspricht Richtung (' + tech.rsVsSpy20d + '%)')
  }

  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  let basis = 32
  if (gap != null) basis += Math.min(18, Math.abs(gap) * 2)
  if (tech.rvol != null) basis += Math.min(15, (tech.rvol - 1) * 5)
  const score = scoreAusGates(basis, gatesPassed, gatesFailed)

  if (score < 40) return null

  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'gap_and_go',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar: bars[bars.length - 1],
    tech,
    atr: tech.atr,
    richtung,
    reactionBar: bars[bars.length - 1],
    indikatoren: {
      gapPct: gap,
      rvol: tech.rvol,
      rsVsSpy20d: tech.rsVsSpy20d,
      setupPhase: 'jetzt',
    },
  })
}

function bewerteVolumeBreakout(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
): MomentumScanEintrag | null {
  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  if (tech.rvol == null) gatesFailed.push('RVOL nicht berechenbar')
  else if (tech.rvol >= DAILY_RVOL_BREAKOUT_MIN) {
    gatesPassed.push('RVOL ≥ ' + DAILY_RVOL_BREAKOUT_MIN + ' (' + tech.rvol + '×)')
  } else {
    gatesFailed.push('RVOL zu niedrig (' + tech.rvol + '×)')
  }

  if (tech.high20d != null && tech.close > tech.high20d) {
    gatesPassed.push('Close über 20T-Hoch (' + tech.high20d + ')')
  } else {
    gatesFailed.push('Kein Breakout über 20T-Hoch')
  }

  if (tech.rsVsSpy20d != null && tech.rsVsSpy20d >= RS_MIN_LONG_PCT) {
    gatesPassed.push('RS vs. S&P positiv (' + tech.rsVsSpy20d + '%)')
  } else {
    gatesFailed.push('RS vs. S&P zu schwach')
  }

  const richtung: MomentumRichtung = 'long'
  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  let basis = 35
  if (tech.rvol != null) basis += Math.min(20, (tech.rvol - 2) * 4)
  if (tech.rsVsSpy20d != null) basis += Math.min(10, tech.rsVsSpy20d)
  const score = scoreAusGates(basis, gatesPassed, gatesFailed)

  if (score < 42) return null

  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'volume_spike_breakout',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar: bars[bars.length - 1],
    tech,
    atr: tech.atr,
    richtung,
    indikatoren: {
      rvol: tech.rvol,
      high20d: tech.high20d,
      rsVsSpy20d: tech.rsVsSpy20d,
      setupPhase: 'jetzt',
    },
  })
}

function bewerteTrendPullback(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
): MomentumScanEintrag | null {
  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  if (tech.uptrend) gatesPassed.push('Uptrend (MA20 > MA50, Close nahe MA20)')
  else gatesFailed.push('Kein klarer Uptrend')

  if (tech.ma20 != null && tech.ma20 > 0) {
    const dist = Math.abs(((tech.close - tech.ma20) / tech.ma20) * 100)
    if (dist <= TREND_PULLBACK_MA_DIST_MAX_PCT) {
      gatesPassed.push('Pullback zu MA20 (' + dist.toFixed(1) + '% Abstand)')
    } else {
      gatesFailed.push('Zu weit von MA20 (' + dist.toFixed(1) + '%)')
    }
  } else {
    gatesFailed.push('MA20 nicht berechenbar')
  }

  if (tech.rsVsSpy20d != null && tech.rsVsSpy20d >= RS_MIN_LONG_PCT) {
    gatesPassed.push('RS vs. S&P positiv (' + tech.rsVsSpy20d + '%)')
  } else {
    gatesFailed.push('RS vs. S&P zu schwach')
  }

  const richtung: MomentumRichtung = 'long'
  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  let basis = 38
  if (tech.return20dPct != null && tech.return20dPct > 0) basis += Math.min(12, tech.return20dPct * 0.5)
  const score = scoreAusGates(basis, gatesPassed, gatesFailed)

  if (score < 40) return null

  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'trend_pullback',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar: bars[bars.length - 1],
    tech,
    atr: tech.atr,
    richtung,
    indikatoren: {
      ma20: tech.ma20,
      ma50: tech.ma50,
      return20dPct: tech.return20dPct,
      rsVsSpy20d: tech.rsVsSpy20d,
      setupPhase: 'jetzt',
    },
  })
}

function bewerteTrendBreakout(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
): MomentumScanEintrag | null {
  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  if (tech.distHigh52wPct != null && tech.distHigh52wPct >= -TREND_BREAKOUT_HIGH_DIST_MAX_PCT) {
    gatesPassed.push('Nahe 52W-Hoch (' + tech.distHigh52wPct + '%)')
  } else {
    gatesFailed.push('Zu weit vom 52W-Hoch (' + tech.distHigh52wPct + '%)')
  }

  if (tech.high52w != null && tech.close >= tech.high52w * 0.998) {
    gatesPassed.push('Breakout über 52W-Hoch')
  } else if (tech.high20d != null && tech.close > tech.high20d) {
    gatesPassed.push('Breakout über 20T-Hoch')
  } else {
    gatesFailed.push('Kein Breakout bestätigt')
  }

  if (tech.rvol != null && tech.rvol >= DAILY_RVOL_MIN) {
    gatesPassed.push('RVOL ≥ ' + DAILY_RVOL_MIN + ' (' + tech.rvol + '×)')
  } else {
    gatesFailed.push('Volumen zu schwach für Breakout')
  }

  if (tech.rsVsSpy20d != null && tech.rsVsSpy20d >= RS_MIN_LONG_PCT) {
    gatesPassed.push('RS vs. S&P positiv (' + tech.rsVsSpy20d + '%)')
  } else {
    gatesFailed.push('RS vs. S&P zu schwach')
  }

  const richtung: MomentumRichtung = 'long'
  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  let basis = 36
  if (tech.rvol != null) basis += Math.min(15, (tech.rvol - 1) * 5)
  const score = scoreAusGates(basis, gatesPassed, gatesFailed)

  if (score < 42) return null

  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'trend_breakout',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar: bars[bars.length - 1],
    tech,
    atr: tech.atr,
    richtung,
    indikatoren: {
      high52w: tech.high52w,
      distHigh52wPct: tech.distHigh52wPct,
      rvol: tech.rvol,
      rsVsSpy20d: tech.rsVsSpy20d,
      setupPhase: 'jetzt',
    },
  })
}

function bewerteRsLeader(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
): MomentumScanEintrag | null {
  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  if (tech.rsVsSpy20d != null && tech.rsVsSpy20d >= RS_LEADER_MIN_PCT) {
    gatesPassed.push('RS vs. S&P ≥ ' + RS_LEADER_MIN_PCT + '% (' + tech.rsVsSpy20d + '%)')
  } else {
    gatesFailed.push('RS vs. S&P unter Leader-Schwelle (' + tech.rsVsSpy20d + '%)')
  }

  if (tech.rsVsSector20d != null && tech.rsVsSector20d >= RS_MIN_LONG_PCT) {
    gatesPassed.push('RS vs. Sektor positiv (' + tech.rsVsSector20d + '%)')
  } else if (tech.rsVsSector20d != null) {
    gatesFailed.push('RS vs. Sektor schwach (' + tech.rsVsSector20d + '%)')
  }

  if (tech.uptrend) gatesPassed.push('Uptrend (MA20 > MA50)')
  else gatesFailed.push('Kein Uptrend')

  if (tech.return20dPct != null && tech.return20dPct > 3) {
    gatesPassed.push('20T-Lauf +' + tech.return20dPct + '%')
  } else {
    gatesFailed.push('20T-Lauf zu schwach')
  }

  const richtung: MomentumRichtung = 'long'
  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  let basis = 40
  if (tech.rsVsSpy20d != null) basis += Math.min(20, tech.rsVsSpy20d * 1.5)
  const score = scoreAusGates(basis, gatesPassed, gatesFailed)

  if (score < 45) return null

  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'relative_strength_leader',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar: bars[bars.length - 1],
    tech,
    atr: tech.atr,
    richtung,
    indikatoren: {
      rsVsSpy20d: tech.rsVsSpy20d,
      rsVsSector20d: tech.rsVsSector20d,
      return20dPct: tech.return20dPct,
      setupPhase: 'jetzt',
    },
  })
}

const BEWERTER: Array<{
  playbook: MomentumPlaybook
  fn: (
    tech: MomentumTechSnapshot,
    bars: MomentumBarDaily[],
    regimeGates: MomentumRegimeGates,
    kalender: MomentumEarningsKalenderEintrag[],
  ) => MomentumScanEintrag | null
}> = [
  { playbook: 'gap_fade', fn: bewerteGapFade },
  { playbook: 'gap_and_go', fn: bewerteGapAndGo },
  { playbook: 'volume_spike_breakout', fn: (t, b, r) => bewerteVolumeBreakout(t, b, r) },
  { playbook: 'trend_pullback', fn: (t, b, r) => bewerteTrendPullback(t, b, r) },
  { playbook: 'trend_breakout', fn: (t, b, r) => bewerteTrendBreakout(t, b, r) },
  { playbook: 'relative_strength_leader', fn: (t, b, r) => bewerteRsLeader(t, b, r) },
]

/** Alle täglichen Playbooks für ein Symbol bewerten. */
export function bewerteTaeglichePlaybooks(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  kalender: MomentumEarningsKalenderEintrag[],
): MomentumScanEintrag[] {
  const out: MomentumScanEintrag[] = []
  for (const { fn } of BEWERTER) {
    const e = fn(tech, bars, regimeGates, kalender)
    if (e && (e.ampel === 'gruen' || e.ampel === 'gelb')) out.push(e)
  }
  return out
}

/** Grauer Eintrag wenn keine Bars für Tech-Snapshot. */
export function bewerteKeineKursdaten(symbol: string, scanDate: string): MomentumScanEintrag {
  return {
    scanDate,
    symbol,
    playbook: 'gap_fade',
    score: 0,
    ampel: 'grau',
    gatesPassed: [],
    gatesFailed: ['Keine Kursdaten — Sync ausführen'],
    indikatoren: {
      playbookLabel: 'Keine Daten',
      hinweis: 'Mindestens 55 Handelstage Kurse nötig',
    },
  }
}

export { ampelAusScore }

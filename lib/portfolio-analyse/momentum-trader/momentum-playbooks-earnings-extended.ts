/**
 * Erweiterte Earnings-Playbooks — Post-Run, Guidance-Shock, Revenue-Divergenz.
 */

import 'server-only'

import { heuteIsoUtc, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { findeEarningsReaktionsBar } from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-bar'
import {
  EARNINGS_POST_RUN_MAX,
  EARNINGS_POST_RUN_MIN,
  GUIDANCE_SHOCK_GAP_MIN_PCT,
  REV_DIVERGENCE_EPS_MIN,
  REV_DIVERGENCE_GAP_MIN,
  REV_DIVERGENCE_REV_MAX,
  RS_MIN_LONG_PCT,
  RS_MAX_SHORT_PCT,
  RS_TAGE,
  RVOL_MIN,
  SURPRISE_BEAT_MIN_PCT,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import { guidanceLabel } from '@/lib/portfolio-analyse/momentum-trader/momentum-guidance'
import {
  baueScanEintrag,
  pruefeRegimeRichtung,
  scoreAusGates,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-playbook-hilfen'
import {
  berechneAtr,
  berechneGapPct,
  berechneRelativeStaerke,
  berechneReturnPct,
  berechneRvol,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-indicators'
import type {
  MomentumBarDaily,
  MomentumEarningsEvent,
  MomentumEarningsZeit,
  MomentumRegimeGates,
  MomentumRichtung,
  MomentumScanEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

export function bewerteEarningsPostRun(
  symbol: string,
  earningsDate: string,
  timeBmoAmc: MomentumEarningsZeit,
  bars: MomentumBarDaily[],
  spyBars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  event: MomentumEarningsEvent | null,
): MomentumScanEintrag | null {
  const heute = heuteIsoUtc()
  const tageSeit = tageZwischenIso(earningsDate, heute)
  if (tageSeit < EARNINGS_POST_RUN_MIN || tageSeit > EARNINGS_POST_RUN_MAX) return null

  const reaktion = findeEarningsReaktionsBar(bars, earningsDate, timeBmoAmc)
  if (!reaktion) return null

  const surprise = event?.surpriseEpsPct ?? null
  const reaktBar = bars[reaktion.barIdx]
  const gapPct = berechneGapPct(reaktBar, reaktion.prevClose)
  const lastIdx = bars.length - 1
  const lastBar = bars[lastIdx]

  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  gatesPassed.push('Post-Earnings Tag ' + tageSeit + ' (Fenster ' + EARNINGS_POST_RUN_MIN + '–' + EARNINGS_POST_RUN_MAX + ')')

  if (surprise == null) gatesFailed.push('Kein EPS-Surprise')
  else if (surprise >= SURPRISE_BEAT_MIN_PCT) gatesPassed.push('EPS-Beat (' + surprise + '%)')
  else if (surprise <= -SURPRISE_BEAT_MIN_PCT) gatesPassed.push('EPS-Miss (' + surprise + '%)')
  else gatesFailed.push('Surprise zu schwach')

  const seitReaktion = berechneReturnPct(bars, lastIdx, tageSeit)
  if (seitReaktion == null) {
    gatesFailed.push('Return seit Earnings nicht berechenbar')
  } else if (surprise != null && surprise > 0 && seitReaktion > 0) {
    gatesPassed.push('Follow-Through Long (+' + seitReaktion + '% seit Reaktion)')
  } else if (surprise != null && surprise < 0 && seitReaktion < 0) {
    gatesPassed.push('Follow-Through Short (' + seitReaktion + '% seit Reaktion)')
  } else {
    gatesFailed.push('Kein Follow-Through (' + seitReaktion + '%)')
  }

  if (lastBar.close > reaktBar.close && surprise != null && surprise > 0) {
    gatesPassed.push('Schluss über Earnings-Tag-Close')
  } else if (lastBar.close < reaktBar.close && surprise != null && surprise < 0) {
    gatesPassed.push('Schluss unter Earnings-Tag-Close')
  } else if (surprise != null) {
    gatesFailed.push('Preis vs. Earnings-Tag widerspricht')
  }

  const richtung: MomentumRichtung | null =
    surprise != null && surprise > 0 && seitReaktion != null && seitReaktion > 0
      ? 'long'
      : surprise != null && surprise < 0 && seitReaktion != null && seitReaktion < 0
        ? 'short'
        : null

  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  const spyIdx = spyBars.findIndex((b) => b.handelstag === lastBar.handelstag)
  const rs = spyIdx >= 0 ? berechneRelativeStaerke(bars, spyBars, lastIdx, RS_TAGE) : null
  if (rs != null && richtung === 'long' && rs >= RS_MIN_LONG_PCT) {
    gatesPassed.push('RS vs. S&P ' + rs + '%')
  } else if (rs != null && richtung === 'short' && rs <= RS_MAX_SHORT_PCT) {
    gatesPassed.push('RS vs. S&P ' + rs + '%')
  } else if (richtung) {
    gatesFailed.push('RS widerspricht')
  }

  let basis = 38
  if (seitReaktion != null) basis += Math.min(18, Math.abs(seitReaktion) * 2)
  const score = scoreAusGates(basis, gatesPassed, gatesFailed)
  if (score < 42 || !richtung) return null

  const atr = berechneAtr(bars, lastIdx)
  return baueScanEintrag({
    scanDate: heute,
    symbol,
    playbook: 'earnings_post_run',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar: lastBar,
    atr,
    richtung,
    indikatoren: {
      earningsDate,
      tageSeitEarnings: tageSeit,
      surpriseEpsPct: surprise,
      gapPct,
      seitReaktionPct: seitReaktion,
      rsVsSpy20d: rs,
      setupPhase: 'jetzt',
    },
  })
}

export function bewerteGuidanceShock(
  symbol: string,
  earningsDate: string,
  timeBmoAmc: MomentumEarningsZeit,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  event: MomentumEarningsEvent | null,
): MomentumScanEintrag | null {
  const heute = heuteIsoUtc()
  const tageSeit = tageZwischenIso(earningsDate, heute)
  if (tageSeit < 0 || tageSeit > 3) return null

  const reaktion = findeEarningsReaktionsBar(bars, earningsDate, timeBmoAmc)
  if (!reaktion || !event) return null

  const bar = bars[reaktion.barIdx]
  const gapPct = berechneGapPct(bar, reaktion.prevClose)
  const guidance = event.guidanceFlag

  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  if (guidance === 'raise') gatesPassed.push(guidanceLabel('raise'))
  else if (guidance === 'lower') gatesPassed.push(guidanceLabel('lower'))
  else gatesFailed.push('Kein klares Guidance-Signal (' + guidance + ')')

  if (gapPct == null) gatesFailed.push('Gap nicht berechenbar')
  else if (guidance === 'raise' && gapPct >= GUIDANCE_SHOCK_GAP_MIN_PCT) {
    gatesPassed.push('Gap-Up ' + gapPct + '% bestätigt Guidance raise')
  } else if (guidance === 'lower' && gapPct <= -GUIDANCE_SHOCK_GAP_MIN_PCT) {
    gatesPassed.push('Gap-Down ' + gapPct + '% bestätigt Guidance lower')
  } else {
    gatesFailed.push('Gap passt nicht zu Guidance (' + gapPct + '%)')
  }

  const rvol = berechneRvol(bars, reaktion.barIdx)
  if (rvol != null && rvol >= RVOL_MIN) gatesPassed.push('RVOL ' + rvol + '×')
  else gatesFailed.push('RVOL zu niedrig')

  const richtung: MomentumRichtung | null =
    guidance === 'raise' && gapPct != null && gapPct > 0
      ? 'long'
      : guidance === 'lower' && gapPct != null && gapPct < 0
        ? 'short'
        : null

  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  let basis = 40
  if (gapPct != null) basis += Math.min(20, Math.abs(gapPct) * 2)
  const score = scoreAusGates(basis, gatesPassed, gatesFailed)
  if (score < 45 || !richtung) return null

  const atr = berechneAtr(bars, reaktion.barIdx)
  return baueScanEintrag({
    scanDate: heute,
    symbol,
    playbook: 'guidance_shock',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar,
    atr,
    richtung,
    reactionBar: bar,
    indikatoren: {
      earningsDate,
      guidanceFlag: guidance,
      guidanceLabel: guidanceLabel(guidance),
      gapPct,
      surpriseEpsPct: event.surpriseEpsPct,
      rvol,
      setupPhase: 'jetzt',
    },
  })
}

export function bewerteRevenueBeatDivergence(
  symbol: string,
  earningsDate: string,
  timeBmoAmc: MomentumEarningsZeit,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  event: MomentumEarningsEvent | null,
): MomentumScanEintrag | null {
  const heute = heuteIsoUtc()
  const tageSeit = tageZwischenIso(earningsDate, heute)
  if (tageSeit < 0 || tageSeit > 3) return null
  if (!event) return null

  const eps = event.surpriseEpsPct
  const rev = event.surpriseRevPct
  if (eps == null || rev == null) return null

  const reaktion = findeEarningsReaktionsBar(bars, earningsDate, timeBmoAmc)
  if (!reaktion) return null

  const bar = bars[reaktion.barIdx]
  const gapPct = berechneGapPct(bar, reaktion.prevClose)

  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  if (eps >= REV_DIVERGENCE_EPS_MIN) gatesPassed.push('EPS-Beat ' + eps + '%')
  else gatesFailed.push('Kein EPS-Beat')
  if (rev <= REV_DIVERGENCE_REV_MAX) gatesPassed.push('Revenue-Miss ' + rev + '%')
  else gatesFailed.push('Revenue nicht verfehlt (' + rev + '%)')
  if (gapPct != null && gapPct >= REV_DIVERGENCE_GAP_MIN) {
    gatesPassed.push('Gap-Up trotz Revenue-Miss (' + gapPct + '%)')
  } else {
    gatesFailed.push('Kein Gap-Up für Divergenz-Short')
  }

  const richtung: MomentumRichtung = 'short'
  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  const rvol = berechneRvol(bars, reaktion.barIdx)
  if (rvol != null && rvol >= RVOL_MIN) gatesPassed.push('RVOL ' + rvol + '×')

  let basis = 42
  if (gapPct != null) basis += Math.min(15, gapPct * 1.5)
  const score = scoreAusGates(basis, gatesPassed, gatesFailed)
  if (score < 45) return null

  const atr = berechneAtr(bars, reaktion.barIdx)
  return baueScanEintrag({
    scanDate: heute,
    symbol,
    playbook: 'revenue_beat_divergence',
    score,
    gatesPassed,
    gatesFailed,
    bars,
    bar,
    atr,
    richtung,
    reactionBar: bar,
    indikatoren: {
      earningsDate,
      surpriseEpsPct: eps,
      surpriseRevPct: rev,
      gapPct,
      rvol,
      hinweis: 'Qualitäts-Short: Markt feiert EPS, ignoriert schwachen Umsatz',
      setupPhase: 'jetzt',
    },
  })
}

/** Alle erweiterten Earnings-Playbooks für ein Event-Fenster. */
export function bewerteEarningsExtendedPlaybooks(input: {
  symbol: string
  earningsDate: string
  timeBmoAmc: MomentumEarningsZeit
  bars: MomentumBarDaily[]
  spyBars: MomentumBarDaily[]
  regimeGates: MomentumRegimeGates
  event: MomentumEarningsEvent | null
}): MomentumScanEintrag[] {
  const out: MomentumScanEintrag[] = []
  for (const e of [
    bewerteEarningsPostRun(
      input.symbol,
      input.earningsDate,
      input.timeBmoAmc,
      input.bars,
      input.spyBars,
      input.regimeGates,
      input.event,
    ),
    bewerteGuidanceShock(
      input.symbol,
      input.earningsDate,
      input.timeBmoAmc,
      input.bars,
      input.regimeGates,
      input.event,
    ),
    bewerteRevenueBeatDivergence(
      input.symbol,
      input.earningsDate,
      input.timeBmoAmc,
      input.bars,
      input.regimeGates,
      input.event,
    ),
  ]) {
    if (e && (e.ampel === 'gruen' || e.ampel === 'gelb')) out.push(e)
  }
  return out
}

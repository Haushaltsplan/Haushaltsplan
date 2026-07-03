/**
 * Pre-Earnings-Run — Richtungs-Trade VOR den Zahlen (mit Exit-Pflicht vor Event).
 * Nutzt historische Volatilität, Lauf, RS und Beat-Rate.
 */

import { tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  EARNINGS_PRE_RUN_MAX,
  EARNINGS_PRE_RUN_MIN,
  momentumPlaybookLabel,
  RS_MIN_LONG_PCT,
  RS_TAGE,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import type { MomentumEarningsHistorieStatistik } from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-analytics-server'
import { berechneAtr, berechneRelativeStaerke } from '@/lib/portfolio-analyse/momentum-trader/momentum-indicators'
import { cfdIndikatorenAusLevels } from '@/lib/portfolio-analyse/momentum-trader/momentum-cfd-planung-server'
import { berechnePositionsVorschlag } from '@/lib/portfolio-analyse/momentum-trader/momentum-position-sizing'
import type {
  MomentumAmpel,
  MomentumBarDaily,
  MomentumEarningsZeit,
  MomentumRegimeGates,
  MomentumRichtung,
  MomentumScanEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const PRE_RUN_ATR_STOP = 1.15

function laufVorEarningsPct(bars: MomentumBarDaily[], tage = 20): number | null {
  if (bars.length < tage + 2) return null
  const last = bars[bars.length - 1].close
  const basis = bars[bars.length - 1 - tage].close
  if (basis <= 0) return null
  return Math.round(((last - basis) / basis) * 1000) / 10
}

function ampelAusScore(score: number, kritisch: boolean): MomentumAmpel {
  if (kritisch) return 'grau'
  if (score >= 68) return 'gruen'
  if (score >= 48) return 'gelb'
  return 'rot'
}

/**
 * Pre-Run: Long in Momentum vor Earnings oder Short als Fade einer Extension.
 * Exit spätestens am Earnings-Tag (BMO) bzw. Vortag (AMC).
 */
export function bewerteEarningsPreRun(
  symbol: string,
  scanDate: string,
  earningsDate: string,
  timeBmoAmc: MomentumEarningsZeit,
  regimeGates: MomentumRegimeGates,
  bars: MomentumBarDaily[],
  spyBars: MomentumBarDaily[],
  historie: MomentumEarningsHistorieStatistik,
): MomentumScanEintrag | null {
  const tageBis = tageZwischenIso(scanDate, earningsDate)
  if (tageBis < EARNINGS_PRE_RUN_MIN || tageBis > EARNINGS_PRE_RUN_MAX) return null

  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  if (historie.eventsMitGap < 1 || historie.medianGapPct == null) {
    gatesFailed.push('Gap-Historie fehlt — Backfill ausführen')
    return {
      scanDate,
      symbol,
      playbook: 'earnings_pre_run',
      score: 0,
      ampel: 'grau',
      gatesPassed,
      gatesFailed,
      indikatoren: {
        playbookLabel: momentumPlaybookLabel('earnings_pre_run'),
        earningsDate,
        tageBisEarnings: tageBis,
        timeBmoAmc,
      },
    }
  }

  gatesPassed.push(
    'Pre-Run-Fenster: ' + tageBis + ' Tage bis Earnings (Tag ' + EARNINGS_PRE_RUN_MIN + '–' + EARNINGS_PRE_RUN_MAX + ')',
  )
  gatesPassed.push(
    'Historie: Median-Gap ' +
      historie.medianGapPct.toFixed(1) +
      '%, erwartete Bewegung ~' +
      (historie.erwarteteBewegungPct?.toFixed(1) ?? '—') +
      '%',
  )

  const lauf = laufVorEarningsPct(bars)
  const lastIdx = bars.length - 1
  const lastBar = bars[lastIdx]
  const atr = berechneAtr(bars, lastIdx)
  const rs = berechneRelativeStaerke(bars, spyBars, lastIdx, RS_TAGE)
  const beat = historie.beatRatePct ?? 50

  let richtung: MomentumRichtung | null = null
  let strategie = ''

  const extensionShort = lauf != null && lauf >= 10 && beat >= 65
  const momentumLong =
    lauf != null &&
    lauf >= 2 &&
    lauf <= 9 &&
    beat >= 55 &&
    rs != null &&
    rs >= RS_MIN_LONG_PCT + 2

  if (extensionShort && (historie.preDrift5dPct == null || historie.preDrift5dPct > 0)) {
    richtung = 'short'
    strategie = 'Fade Extension vor Earnings (überdehnt, hohe Beat-Erwartung)'
    gatesPassed.push('20T-Lauf ' + lauf + '% — Extension-Fade-Kandidat')
    if (regimeGates.shortBias) gatesPassed.push('Regime Short-Bias unterstützt')
    else gatesFailed.push('Regime: kein Short-Bias — Vorsicht')
  } else if (momentumLong) {
    richtung = 'long'
    strategie = 'Momentum in Earnings (RS stark, moderater Lauf, Beat-Historie)'
    gatesPassed.push('20T-Lauf ' + lauf + '%, RS ' + rs + '% vs. S&P')
    if (regimeGates.longBias) gatesPassed.push('Regime Long-Bias')
    else gatesFailed.push('Regime: kein Long-Bias')
  } else if (lauf != null && lauf >= 6 && beat >= 50) {
    richtung = 'long'
    strategie = 'Drift in Earnings (historischer Pre-Run positiv)'
    gatesPassed.push('Positiver Lauf ' + lauf + '% vor Event')
    if (historie.preDrift5dPct != null && historie.preDrift5dPct > 0) {
      gatesPassed.push('Historischer 5T-Drift vor Earnings: +' + historie.preDrift5dPct + '%')
    }
  } else {
    gatesFailed.push('Kein klares Pre-Run-Setup (Lauf/RS/Beat-Kombination)')
  }

  gatesPassed.push(
    'Pflicht-Exit: spätestens vor ' +
      (timeBmoAmc === 'amc' ? 'Earnings-Abend (AMC)' : 'Earnings-Eröffnung (BMO)') +
      ' — kein Halten über die Zahlen',
  )

  let score = 35
  if (historie.medianGapPct >= 5) score += 12
  else if (historie.medianGapPct >= 3) score += 6
  if (historie.erwarteteBewegungPct != null && historie.erwarteteBewegungPct >= 5) score += 8
  if (beat >= 70) score += 5
  if (lauf != null) score += Math.min(10, Math.abs(lauf) * 0.5)
  if (rs != null && richtung === 'long') score += Math.min(8, Math.max(0, rs))
  if (richtung === 'short' && extensionShort) score += 10
  if (tageBis <= 3) score += 6
  score = Math.min(88, Math.round(score))

  const pos =
    richtung && atr != null
      ? berechnePositionsVorschlag(lastBar.close, atr * (PRE_RUN_ATR_STOP / 1.5), richtung)
      : null

  const exitBis =
    timeBmoAmc === 'amc'
      ? earningsDate
      : earningsDate

  return {
    scanDate,
    symbol,
    playbook: 'earnings_pre_run',
    score,
    ampel: richtung ? ampelAusScore(score, gatesFailed.some((g) => g.startsWith('Gap-Historie'))) : 'rot',
    gatesPassed,
    gatesFailed,
    indikatoren: {
      playbookLabel: momentumPlaybookLabel('earnings_pre_run'),
      earningsDate,
      tageBisEarnings: tageBis,
      timeBmoAmc,
      richtung,
      strategie,
      laufVorEarningsPct: lauf,
      rsVsSpy20d: rs,
      beatRatePct: beat,
      medianGapPct: historie.medianGapPct,
      erwarteteBewegungPct: historie.erwarteteBewegungPct,
      preDrift5dPct: historie.preDrift5dPct,
      gapUpRatePct: historie.gapUpRatePct,
      gapDownRatePct: historie.gapDownRatePct,
      exitBis,
      letzterKurs: lastBar.close,
      entryPrice: pos?.entryPrice ?? lastBar.close,
      stopPrice: pos?.stopPrice ?? null,
      targetPrice: pos?.targetPrice ?? null,
      ...cfdIndikatorenAusLevels(pos?.entryPrice ?? lastBar.close, pos?.stopPrice ?? null, pos?.targetPrice ?? null),
      hinweis:
        'Pre-Earnings-Trade: höheres Event-Risiko — nur mit Stop, Exit vor Zahlen.',
    },
  }
}

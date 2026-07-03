/**
 * Katalysator-Playbooks — News-Gap, Analyst-Upgrade.
 */

import 'server-only'

import { tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { findeAktuellesUpgrade } from '@/lib/portfolio-analyse/momentum-trader/momentum-analyst-server'
import {
  DAILY_RVOL_MIN,
  EARNINGS_GAP_EXCLUDE_TAGE,
  NEWS_GAP_MIN_PCT,
  RS_MIN_LONG_PCT,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import {
  baueScanEintrag,
  pruefeRegimeRichtung,
  scoreAusGates,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-playbook-hilfen'
import type {
  MomentumAnalystRating,
  MomentumBarDaily,
  MomentumEarningsKalenderEintrag,
  MomentumNewsKatalysator,
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
    return Math.abs(tageZwischenIso(k.earningsDate, handelstag)) <= EARNINGS_GAP_EXCLUDE_TAGE
  })
}

export function bewerteNewsGap(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  kalender: MomentumEarningsKalenderEintrag[],
  news: MomentumNewsKatalysator | null,
): MomentumScanEintrag | null {
  if (!news || hatEarningsInNaehe(tech.symbol, tech.handelstag, kalender)) return null

  const gatesPassed: string[] = []
  const gatesFailed: string[] = []
  const gap = tech.gapPct

  if (gap == null || Math.abs(gap) < NEWS_GAP_MIN_PCT) {
    gatesFailed.push('Kein relevanter Gap (min. ' + NEWS_GAP_MIN_PCT + '%)')
    return null
  }
  gatesPassed.push('Gap ' + gap + '%')

  gatesPassed.push('News (' + news.tageAlt + 'T): ' + news.headline.slice(0, 60) + '…')
  gatesPassed.push('Sentiment: ' + news.sentiment)

  if (tech.rvol != null && tech.rvol >= DAILY_RVOL_MIN) {
    gatesPassed.push('RVOL ≥ ' + DAILY_RVOL_MIN + ' (' + tech.rvol + '×)')
  } else {
    gatesFailed.push('RVOL zu niedrig')
  }

  let richtung: MomentumRichtung | null = null
  if (gap > 0 && news.sentiment === 'bullish') {
    richtung = 'long'
    gatesPassed.push('Gap-Up + bullish News → Long')
  } else if (gap > 0 && news.sentiment === 'bearish') {
    richtung = 'short'
    gatesPassed.push('Gap-Up + bearish News → Fade Short')
  } else if (gap < 0 && news.sentiment === 'bearish') {
    richtung = 'short'
    gatesPassed.push('Gap-Down + bearish News → Short')
  } else if (gap < 0 && news.sentiment === 'bullish') {
    richtung = 'long'
    gatesPassed.push('Gap-Down + bullish News → Bounce Long')
  } else {
    gatesFailed.push('News-Sentiment neutral — Richtung unklar')
  }

  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  let basis = 36
  if (Math.abs(gap) >= NEWS_GAP_MIN_PCT) basis += Math.min(15, Math.abs(gap) * 2)
  if (news.sentiment !== 'neutral') basis += 8
  const score = scoreAusGates(basis, gatesPassed, gatesFailed)
  if (score < 42 || !richtung) return null

  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'news_gap',
    score,
    gatesPassed,
    gatesFailed,
    bar: bars[bars.length - 1],
    atr: tech.atr,
    richtung,
    indikatoren: {
      gapPct: gap,
      newsHeadline: news.headline,
      newsSentiment: news.sentiment,
      newsTageAlt: news.tageAlt,
      rvol: tech.rvol,
      katalysator: 'news',
      setupPhase: 'jetzt',
    },
  })
}

export function bewerteAnalystUpgrade(
  tech: MomentumTechSnapshot,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  ratings: MomentumAnalystRating[],
): MomentumScanEintrag | null {
  const upgrade = findeAktuellesUpgrade(ratings)
  if (!upgrade) return null

  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  gatesPassed.push(
    (upgrade.aktion === 'initiate' ? 'Initiate' : 'Upgrade') +
      (upgrade.firma ? ' — ' + upgrade.firma : '') +
      ' (' +
      upgrade.datum +
      ')',
  )
  if (upgrade.ratingNeu) gatesPassed.push('Rating: ' + (upgrade.ratingAlt ?? '—') + ' → ' + upgrade.ratingNeu)

  if (tech.aboveMa20) gatesPassed.push('Über MA20')
  else gatesFailed.push('Unter MA20')

  if (tech.rsVsSpy20d != null && tech.rsVsSpy20d >= RS_MIN_LONG_PCT) {
    gatesPassed.push('RS vs. S&P positiv (' + tech.rsVsSpy20d + '%)')
  } else {
    gatesFailed.push('RS vs. S&P schwach')
  }

  if (tech.return20dPct != null && tech.return20dPct > -2) {
    gatesPassed.push('20T-Lauf ' + tech.return20dPct + '%')
  } else {
    gatesFailed.push('20T-Lauf zu schwach')
  }

  const richtung: MomentumRichtung = 'long'
  pruefeRegimeRichtung(richtung, regimeGates, gatesPassed, gatesFailed)

  let basis = 40
  if (upgrade.aktion === 'upgrade') basis += 8
  const score = scoreAusGates(basis, gatesPassed, gatesFailed)
  if (score < 44) return null

  return baueScanEintrag({
    scanDate: tech.scanDate,
    symbol: tech.symbol,
    playbook: 'analyst_upgrade',
    score,
    gatesPassed,
    gatesFailed,
    bar: bars[bars.length - 1],
    atr: tech.atr,
    richtung,
    indikatoren: {
      analystAktion: upgrade.aktion,
      analystFirma: upgrade.firma,
      analystDatum: upgrade.datum,
      ratingNeu: upgrade.ratingNeu,
      rsVsSpy20d: tech.rsVsSpy20d,
      katalysator: 'analyst',
      setupPhase: 'jetzt',
    },
  })
}

export function bewerteKatalysatorPlaybooks(input: {
  tech: MomentumTechSnapshot
  bars: MomentumBarDaily[]
  regimeGates: MomentumRegimeGates
  kalender: MomentumEarningsKalenderEintrag[]
  news: MomentumNewsKatalysator | null
  ratings: MomentumAnalystRating[]
}): MomentumScanEintrag[] {
  const out: MomentumScanEintrag[] = []
  for (const e of [
    bewerteNewsGap(input.tech, input.bars, input.regimeGates, input.kalender, input.news),
    bewerteAnalystUpgrade(input.tech, input.bars, input.regimeGates, input.ratings),
  ]) {
    if (e && (e.ampel === 'gruen' || e.ampel === 'gelb')) out.push(e)
  }
  return out
}

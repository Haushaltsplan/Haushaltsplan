/**
 * Momentum Trader — Regel-Engine Stufe A (rein faktenbasiert).
 */

import 'server-only'

import { heuteIsoUtc, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  EARNINGS_LOOKBACK_TAGE,
  EARNINGS_VORLAUF_MAX,
  EARNINGS_VORLAUF_MIN,
  GAP_MEDIAN_FAKTOR,
  GAP_MIN_PCT,
  IPO_FADE_MAX_TAGE,
  IPO_FADE_MIN_TAGE,
  IPO_REVERSAL_GAP_PCT,
  IPO_RUN_MIN_PCT,
  momentumPlaybookLabel,
  MOMENTUM_GAP_MIN_PCT,
  RS_MAX_SHORT_PCT,
  RS_MIN_LONG_PCT,
  RS_TAGE,
  RVOL_MIN,
  SURPRISE_BEAT_MIN_PCT,
  SURPRISE_MISS_MAX_PCT,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import { findeEarningsReaktionsBar } from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-bar'
import {
  ladeMedianGapFuerSymbol,
  medianGapAbsPct,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-events-server'
import { ladeMomentumIpoDatum } from '@/lib/portfolio-analyse/momentum-trader/momentum-ipo-server'
import { guidanceLabel } from '@/lib/portfolio-analyse/momentum-trader/momentum-guidance'
import {
  ladeMomentumBars,
  ladeMomentumEarningsEventsFuerSymbol,
  ladeMomentumEarningsKalenderFuerSymbole,
  loescheMomentumScanFuerDatum,
  speichereMomentumScanErgebnisse,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-db-server'
import {
  berechneAtr,
  berechneGapPct,
  berechneRelativeStaerke,
  berechneRvol,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-indicators'
import { berechnePositionsVorschlag } from '@/lib/portfolio-analyse/momentum-trader/momentum-position-sizing'
import type {
  MomentumAmpel,
  MomentumBarDaily,
  MomentumEarningsEvent,
  MomentumEarningsZeit,
  MomentumRegimeGates,
  MomentumRichtung,
  MomentumScanEintrag,
  MomentumScanPaket,
  MomentumWatchlistEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { symboleAusWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-server'
import { MOMENTUM_REGIME_SYMBOLS } from '@/lib/portfolio-analyse/momentum-trader/momentum-universe'

const SPY_SYMBOL = MOMENTUM_REGIME_SYMBOLS[0]

function addDaysIso(iso: string, tage: number): string {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + tage)
  return d.toISOString().slice(0, 10)
}

function primaeresSymbol(e: MomentumWatchlistEintrag): string | null {
  return e.symbolYahoo?.trim().toUpperCase() || e.symbolCandidates[0]?.trim().toUpperCase() || null
}

function ampelAusScore(score: number, gatesFailed: string[], kritisch = false): MomentumAmpel {
  if (kritisch || gatesFailed.some((g) => g.startsWith('Keine Kursdaten'))) return 'grau'
  if (score >= 70 && gatesFailed.length === 0) return 'gruen'
  if (score >= 45) return 'gelb'
  return 'rot'
}

function eventFuerDatum(events: MomentumEarningsEvent[], datum: string): MomentumEarningsEvent | null {
  return events.find((e) => e.earningsDate === datum) ?? null
}

type ReaktionsKontext = {
  bar: MomentumBarDaily
  barIdx: number
  prevClose: number
  gapPct: number | null
  rvol: number | null
  atr: number | null
  effektiveZeit: MomentumEarningsZeit
}

function baueReaktionsKontext(
  bars: MomentumBarDaily[],
  earningsDate: string,
  timeBmoAmc: MomentumEarningsZeit,
): ReaktionsKontext | null {
  const reaktion = findeEarningsReaktionsBar(bars, earningsDate, timeBmoAmc)
  if (!reaktion) return null
  const bar = bars[reaktion.barIdx]
  return {
    bar,
    barIdx: reaktion.barIdx,
    prevClose: reaktion.prevClose,
    gapPct: berechneGapPct(bar, reaktion.prevClose),
    rvol: berechneRvol(bars, reaktion.barIdx),
    atr: berechneAtr(bars, reaktion.barIdx),
    effektiveZeit: reaktion.effektiveZeit,
  }
}

function bewerteGapFade(
  symbol: string,
  earningsDate: string,
  timeBmoAmc: MomentumEarningsZeit,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  medianGap: number | null,
  event: MomentumEarningsEvent | null,
): MomentumScanEintrag | null {
  const heute = heuteIsoUtc()
  const tageSeit = tageZwischenIso(earningsDate, heute)
  if (tageSeit < 0 || tageSeit > EARNINGS_LOOKBACK_TAGE) return null

  const gatesPassed: string[] = []
  const gatesFailed: string[] = []
  const ctx = baueReaktionsKontext(bars, earningsDate, timeBmoAmc)

  if (!ctx) {
    return {
      scanDate: heute,
      symbol,
      playbook: 'earnings_gap_fade',
      score: 0,
      ampel: 'grau',
      gatesPassed: [],
      gatesFailed: ['Keine Kursdaten nach Earnings'],
      indikatoren: {
        earningsDate,
        tageSeitEarnings: tageSeit,
        timeBmoAmc,
        playbookLabel: momentumPlaybookLabel('earnings_gap_fade'),
      },
    }
  }

  const { bar, gapPct, rvol, atr, effektiveZeit } = ctx
  gatesPassed.push(
    'Reaktionsbar: ' +
      (effektiveZeit === 'bmo' ? 'BMO (Earnings-Tag)' : effektiveZeit === 'amc' ? 'AMC (Folgetag)' : 'Auto'),
  )

  if (gapPct == null) gatesFailed.push('Gap nicht berechenbar')
  else if (Math.abs(gapPct) >= GAP_MIN_PCT) gatesPassed.push('Gap ≥ ' + GAP_MIN_PCT + '% (' + gapPct + '%)')
  else gatesFailed.push('Gap zu klein (' + gapPct + '%, min. ' + GAP_MIN_PCT + '%)')

  if (medianGap != null && gapPct != null) {
    const schwelle = medianGap * GAP_MEDIAN_FAKTOR
    if (Math.abs(gapPct) >= schwelle) {
      gatesPassed.push('Gap ≥ 2× Median (' + medianGap.toFixed(1) + '% → ' + schwelle.toFixed(1) + '%)')
    } else {
      gatesFailed.push(
        'Gap unter 2× Median (' + Math.abs(gapPct).toFixed(1) + '% vs. ' + schwelle.toFixed(1) + '%)',
      )
    }
  }

  if (rvol == null) gatesFailed.push('RVOL nicht berechenbar')
  else if (rvol >= RVOL_MIN) gatesPassed.push('RVOL ≥ ' + RVOL_MIN + ' (' + rvol + '×)')
  else gatesFailed.push('RVOL zu niedrig (' + rvol + '×)')

  const richtung: MomentumRichtung | null =
    gapPct != null && gapPct > 0 ? 'short' : gapPct != null && gapPct < 0 ? 'long' : null

  if (richtung === 'short') {
    if (regimeGates.shortBias) gatesPassed.push('Regime: Short-Bias')
    else gatesFailed.push('Regime: kein Short-Bias')
  } else if (richtung === 'long') {
    if (regimeGates.longBias) gatesPassed.push('Regime: Long-Bias')
    else gatesFailed.push('Regime: kein Long-Bias')
  }

  let score = 25
  if (gapPct != null) score += Math.min(25, Math.abs(gapPct) * 2)
  if (rvol != null) score += Math.min(15, (rvol - 1) * 8)
  if (medianGap != null && gapPct != null && Math.abs(gapPct) >= medianGap * GAP_MEDIAN_FAKTOR) score += 15
  if (gatesFailed.length === 0) score += 20
  score = Math.min(100, Math.round(score))

  const pos =
    richtung && atr != null ? berechnePositionsVorschlag(bar.open, atr, richtung) : null

  return {
    scanDate: heute,
    symbol,
    playbook: 'earnings_gap_fade',
    score,
    ampel: ampelAusScore(score, gatesFailed),
    gatesPassed,
    gatesFailed,
    indikatoren: {
      playbookLabel: momentumPlaybookLabel('earnings_gap_fade'),
      earningsDate,
      tageSeitEarnings: tageSeit,
      timeBmoAmc,
      effektiveZeit,
      gapPct,
      medianGapPct: medianGap,
      surpriseEpsPct: event?.surpriseEpsPct ?? null,
      guidanceFlag: event?.guidanceFlag ?? 'unknown',
      guidanceLabel: guidanceLabel(event?.guidanceFlag ?? 'unknown'),
      rvol,
      atr,
      richtung,
      handelstag: bar.handelstag,
      entryPrice: pos?.entryPrice ?? bar.open,
      stopPrice: pos?.stopPrice ?? null,
      targetPrice: pos?.targetPrice ?? null,
      stopAbstandPct: pos?.stopAbstandPct ?? null,
      riskEur: pos?.riskEur ?? null,
      spyAbove20Ma: regimeGates.regime.spyAbove20Ma,
      vixClose: regimeGates.regime.vixClose,
    },
  }
}

function bewerteEarningsMomentum(
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
  if (tageSeit < 0 || tageSeit > EARNINGS_LOOKBACK_TAGE) return null

  const gatesPassed: string[] = []
  const gatesFailed: string[] = []
  const ctx = baueReaktionsKontext(bars, earningsDate, timeBmoAmc)
  if (!ctx) return null

  const { bar, gapPct, rvol, atr, effektiveZeit } = ctx
  const surprise = event?.surpriseEpsPct ?? null

  if (surprise == null) gatesFailed.push('Kein EPS-Surprise (Marketbeat/Yahoo-Backfill)')
  else if (surprise >= SURPRISE_BEAT_MIN_PCT) gatesPassed.push('EPS-Beat ≥ ' + SURPRISE_BEAT_MIN_PCT + '% (' + surprise + '%)')
  else if (surprise <= SURPRISE_MISS_MAX_PCT) gatesPassed.push('EPS-Miss ≤ ' + SURPRISE_MISS_MAX_PCT + '% (' + surprise + '%)')
  else gatesFailed.push('Surprise zu schwach für Momentum (' + surprise + '%)')

  if (gapPct == null) gatesFailed.push('Gap nicht berechenbar')
  else if (surprise != null && surprise > 0 && gapPct >= MOMENTUM_GAP_MIN_PCT) {
    gatesPassed.push('Gap-Up bestätigt (' + gapPct + '%)')
  } else if (surprise != null && surprise < 0 && gapPct <= -MOMENTUM_GAP_MIN_PCT) {
    gatesPassed.push('Gap-Down bestätigt (' + gapPct + '%)')
  } else {
    gatesFailed.push('Gap nicht in Surprise-Richtung')
  }

  const bullishTag = bar.close > bar.open
  if (bullishTag && gapPct != null && gapPct > 0) gatesPassed.push('Tag 1 schließt über Open (Long-Stärke)')
  else if (!bullishTag && gapPct != null && gapPct < 0) gatesPassed.push('Tag 1 schließt unter Open (Short-Stärke)')
  else if (gapPct != null) gatesFailed.push('Keine klare Intraday-Fortsetzung')

  if (rvol == null) gatesFailed.push('RVOL nicht berechenbar')
  else if (rvol >= RVOL_MIN) gatesPassed.push('RVOL ≥ ' + RVOL_MIN + ' (' + rvol + '×)')
  else gatesFailed.push('RVOL zu niedrig (' + rvol + '×)')

  const richtung: MomentumRichtung | null =
    surprise != null && surprise > 0 && gapPct != null && gapPct > 0
      ? 'long'
      : surprise != null && surprise < 0 && gapPct != null && gapPct < 0
        ? 'short'
        : null

  if (richtung === 'long') {
    if (regimeGates.longBias) gatesPassed.push('Regime: Long-Bias')
    else gatesFailed.push('Regime: kein Long-Bias')
  } else if (richtung === 'short') {
    if (regimeGates.shortBias) gatesPassed.push('Regime: Short-Bias')
    else gatesFailed.push('Regime: kein Short-Bias')
  }

  const spyIdx = spyBars.findIndex((b) => b.handelstag === bar.handelstag)
  const rs =
    spyIdx >= 0 ? berechneRelativeStaerke(bars, spyBars, ctx.barIdx, RS_TAGE) : null
  if (rs != null && richtung != null) {
    if (richtung === 'long' && rs >= RS_MIN_LONG_PCT) {
      gatesPassed.push('RS vs. S&P (' + RS_TAGE + 'T): +' + rs + '%')
    } else if (richtung === 'short' && rs <= RS_MAX_SHORT_PCT) {
      gatesPassed.push('RS vs. S&P (' + RS_TAGE + 'T): ' + rs + '%')
    } else {
      gatesFailed.push('RS vs. S&P widerspricht Richtung (' + rs + '%)')
    }
  } else if (richtung != null) {
    gatesFailed.push('Relative Stärke nicht berechenbar')
  }

  let score = 30
  if (surprise != null) score += Math.min(20, Math.abs(surprise))
  if (gapPct != null) score += Math.min(15, Math.abs(gapPct) * 1.5)
  if (rvol != null) score += Math.min(10, (rvol - 1) * 6)
  if (gatesFailed.length === 0) score += 25
  score = Math.min(100, Math.round(score))

  const pos =
    richtung && atr != null ? berechnePositionsVorschlag(bar.open, atr, richtung) : null

  return {
    scanDate: heute,
    symbol,
    playbook: 'earnings_momentum',
    score,
    ampel: ampelAusScore(score, gatesFailed),
    gatesPassed,
    gatesFailed,
    indikatoren: {
      playbookLabel: momentumPlaybookLabel('earnings_momentum'),
      earningsDate,
      tageSeitEarnings: tageSeit,
      timeBmoAmc,
      effektiveZeit,
      gapPct,
      surpriseEpsPct: surprise,
      guidanceFlag: event?.guidanceFlag ?? 'unknown',
      guidanceLabel: guidanceLabel(event?.guidanceFlag ?? 'unknown'),
      rvol,
      atr,
      rsVsSpy20d: rs,
      richtung,
      handelstag: bar.handelstag,
      entryPrice: pos?.entryPrice ?? bar.close,
      stopPrice: pos?.stopPrice ?? null,
      targetPrice: pos?.targetPrice ?? null,
      riskEur: pos?.riskEur ?? null,
    },
  }
}

function bewerteIpoFade(
  symbol: string,
  ipoDatum: string,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
): MomentumScanEintrag | null {
  const heute = heuteIsoUtc()
  const tageSeit = tageZwischenIso(ipoDatum, heute)
  if (tageSeit < IPO_FADE_MIN_TAGE || tageSeit > IPO_FADE_MAX_TAGE) return null

  const firstIdx = bars.findIndex((b) => b.handelstag >= ipoDatum)
  if (firstIdx < 0) return null

  const lastIdx = bars.length - 1
  const lastBar = bars[lastIdx]
  if (lastIdx < 1) return null

  const firstClose = bars[firstIdx].close
  if (firstClose <= 0) return null

  let peak = firstClose
  for (let i = firstIdx; i <= lastIdx; i++) peak = Math.max(peak, bars[i].high)
  const runPct = ((peak - firstClose) / firstClose) * 100

  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  if (runPct >= IPO_RUN_MIN_PCT) gatesPassed.push('Lauf seit IPO ≥ ' + IPO_RUN_MIN_PCT + '% (' + runPct.toFixed(1) + '%)')
  else gatesFailed.push('Zu wenig Extension seit IPO (' + runPct.toFixed(1) + '%)')

  const gapPct = berechneGapPct(lastBar, bars[lastIdx - 1].close)
  const rvol = berechneRvol(bars, lastIdx)
  const atr = berechneAtr(bars, lastIdx)
  const reversal =
    lastBar.close < lastBar.open ||
    (gapPct != null && gapPct <= IPO_REVERSAL_GAP_PCT)

  if (reversal) gatesPassed.push('Reversal-Signal (roter Tag oder Gap-Down)')
  else gatesFailed.push('Noch kein Reversal — warten')

  if (rvol != null && rvol >= RVOL_MIN) gatesPassed.push('RVOL ≥ ' + RVOL_MIN + ' (' + rvol + '×)')
  else gatesFailed.push('RVOL zu niedrig')

  if (regimeGates.shortBias) gatesPassed.push('Regime: Short-Bias')
  else gatesFailed.push('Regime: kein Short-Bias')

  const richtung: MomentumRichtung = 'short'

  let score = 35
  if (runPct >= IPO_RUN_MIN_PCT) score += Math.min(25, (runPct - IPO_RUN_MIN_PCT) * 0.8)
  if (reversal) score += 20
  if (rvol != null) score += Math.min(10, (rvol - 1) * 5)
  if (gatesFailed.length === 0) score += 15
  score = Math.min(100, Math.round(score))

  const pos = atr != null ? berechnePositionsVorschlag(lastBar.close, atr, richtung) : null

  return {
    scanDate: heute,
    symbol,
    playbook: 'ipo_fade',
    score,
    ampel: ampelAusScore(score, gatesFailed),
    gatesPassed,
    gatesFailed,
    indikatoren: {
      playbookLabel: momentumPlaybookLabel('ipo_fade'),
      ipoDatum,
      tageSeitIpo: tageSeit,
      runSeitIpoPct: Math.round(runPct * 10) / 10,
      gapPct,
      rvol,
      atr,
      richtung,
      handelstag: lastBar.handelstag,
      entryPrice: pos?.entryPrice ?? lastBar.close,
      stopPrice: pos?.stopPrice ?? null,
      targetPrice: pos?.targetPrice ?? null,
      riskEur: pos?.riskEur ?? null,
    },
  }
}

function bewerteEarningsVorlauf(
  symbol: string,
  earningsDate: string,
  timeBmoAmc: string,
  regimeGates: MomentumRegimeGates,
  medianGap: number | null,
): MomentumScanEintrag {
  const heute = heuteIsoUtc()
  const tageBis = tageZwischenIso(heute, earningsDate)
  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  if (tageBis >= EARNINGS_VORLAUF_MIN && tageBis <= EARNINGS_VORLAUF_MAX) {
    gatesPassed.push(
      'Earnings in ' + tageBis + ' Tagen (Fenster ' + EARNINGS_VORLAUF_MIN + '–' + EARNINGS_VORLAUF_MAX + ')',
    )
  } else {
    gatesFailed.push('Außerhalb Vorlauf-Fenster')
  }

  if (medianGap != null) {
    gatesPassed.push('Historischer Median-Gap: ' + medianGap.toFixed(1) + '%')
  } else {
    gatesFailed.push('Keine Gap-Historie — Backfill ausführen')
  }

  gatesPassed.push(
    'Regime: ' + (regimeGates.longBias ? 'Long' : '—') + ' / ' + (regimeGates.shortBias ? 'Short' : '—'),
  )

  let score = 40
  if (tageBis >= 3 && tageBis <= 7) score += 25
  else if (tageBis <= 14) score += 10
  if (medianGap != null && medianGap >= 4) score += 15
  score = Math.min(85, score)

  return {
    scanDate: heute,
    symbol,
    playbook: 'earnings_vorlauf',
    score,
    ampel: 'gelb',
    gatesPassed,
    gatesFailed,
    indikatoren: {
      playbookLabel: momentumPlaybookLabel('earnings_vorlauf'),
      earningsDate,
      tageBisEarnings: tageBis,
      timeBmoAmc,
      medianGapPct: medianGap,
      hinweis: 'Beobachten — nach Earnings Kurse syncen + Scan wiederholen',
    },
  }
}

export type MomentumScanOptionen = {
  mitKiMemos?: boolean
}

/** Scan: Gap-Fade, Momentum, IPO-Fade + Vorlauf. */
export async function scanMomentumWatchlist(
  watchlist: MomentumWatchlistEintrag[],
  regimeGates: MomentumRegimeGates,
  opts?: MomentumScanOptionen,
): Promise<MomentumScanPaket> {
  const heute = heuteIsoUtc()
  const vonBars = addDaysIso(heute, -400)
  const symbole = symboleAusWatchlist(watchlist)
  const kalender = await ladeMomentumEarningsKalenderFuerSymbole(symbole)
  const spyBars = await ladeMomentumBars(SPY_SYMBOL, vonBars, heute)

  const ergebnisse: MomentumScanEintrag[] = []

  for (const e of watchlist) {
    const symbol = primaeresSymbol(e)
    if (!symbol) continue

    const events = await ladeMomentumEarningsEventsFuerSymbol(symbol)
    const medianGap = medianGapAbsPct(events) ?? (await ladeMedianGapFuerSymbol(symbol))
    const bars = await ladeMomentumBars(symbol, vonBars, heute)

    const vergangen = kalender.filter((k) => {
      if (k.symbol !== symbol) return false
      const tage = tageZwischenIso(k.earningsDate, heute)
      return tage >= 0 && tage <= EARNINGS_LOOKBACK_TAGE
    })

    for (const t of vergangen) {
      const ev = eventFuerDatum(events, t.earningsDate)
      const zeit = ev?.timeBmoAmc ?? t.timeBmoAmc

      const fade = bewerteGapFade(symbol, t.earningsDate, zeit, bars, regimeGates, medianGap, ev)
      if (fade) ergebnisse.push(fade)

      const mom = bewerteEarningsMomentum(symbol, t.earningsDate, zeit, bars, spyBars, regimeGates, ev)
      if (mom && mom.score >= 40) ergebnisse.push(mom)
    }

    const kommend = kalender.filter((k) => {
      if (k.symbol !== symbol) return false
      if (k.earningsDate < heute) return false
      const tage = tageZwischenIso(heute, k.earningsDate)
      return tage >= EARNINGS_VORLAUF_MIN && tage <= EARNINGS_VORLAUF_MAX
    })

    for (const t of kommend) {
      ergebnisse.push(bewerteEarningsVorlauf(symbol, t.earningsDate, t.timeBmoAmc, regimeGates, medianGap))
    }

    const ipoDatum = e.ipoDatum ?? (await ladeMomentumIpoDatum(symbol, e.symbolYahoo))
    if (ipoDatum) {
      const ipo = bewerteIpoFade(symbol, ipoDatum, bars, regimeGates)
      if (ipo) ergebnisse.push(ipo)
    }
  }

  ergebnisse.sort((a, b) => b.score - a.score)

  let final = ergebnisse
  if (opts?.mitKiMemos) {
    const { ergaenzeScanMitKiMemos } = await import(
      '@/lib/portfolio-analyse/momentum-trader/momentum-scan-memo-server'
    )
    final = await ergaenzeScanMitKiMemos(ergebnisse)
  }

  await loescheMomentumScanFuerDatum(heute)
  if (final.length > 0) {
    await speichereMomentumScanErgebnisse(final)
    const { speichereMomentumScanVerlauf } = await import(
      '@/lib/portfolio-analyse/momentum-trader/momentum-scan-verlauf-server'
    )
    await speichereMomentumScanVerlauf(final)
  }

  return { scanDate: heute, regime: regimeGates, ergebnisse: final }
}

export { momentumPlaybookLabel as playbookLabel }

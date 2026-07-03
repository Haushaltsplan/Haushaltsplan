/**
 * Momentum Trader — Regel-Engine Stufe A (rein faktenbasiert).
 */

import 'server-only'

import { heuteIsoUtc, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  EARNINGS_LOOKBACK_TAGE,
  EARNINGS_BEOBACHTUNG_MAX_TAGE,
  EARNINGS_EXTENDED_LOOKBACK_TAGE,
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
  gapVolatilitaetSchaetzung,
  ladeBarsFuerEarningsGap,
  ladeEarningsEventsFuerWatchlistEintrag,
  ladeMedianGapFuerSymbol,
  medianGapAbsPct,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-events-server'
import { berechneEarningsHistorieStatistik } from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-analytics-server'
import { sektorEtfSymbol } from '@/lib/portfolio-analyse/momentum-trader/momentum-sektor-etf-server'
import {
  primaeresAnzeigeSymbol,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-symbol-hilfen'
import { ladeMomentumIpoDatum } from '@/lib/portfolio-analyse/momentum-trader/momentum-ipo-server'
import { istMomentumPreIpoEintrag } from '@/lib/portfolio-analyse/momentum-trader/momentum-pseudo-isin'
import { bewerteEarningsPreEvent } from '@/lib/portfolio-analyse/momentum-trader/momentum-pre-event-server'
import { bewerteEarningsPreRun } from '@/lib/portfolio-analyse/momentum-trader/momentum-pre-run-server'
import { bewerteTaeglichePlaybooks } from '@/lib/portfolio-analyse/momentum-trader/momentum-playbooks-taeglich'
import { bewerteMeanReversionPlaybooks } from '@/lib/portfolio-analyse/momentum-trader/momentum-playbooks-mean-reversion'
import { bewerteRegimePlaybooks } from '@/lib/portfolio-analyse/momentum-trader/momentum-playbooks-regime'
import { berechneRegimeKontext } from '@/lib/portfolio-analyse/momentum-trader/momentum-regime-kontext-server'
import { ladeFinvizKennzahlenBatch } from '@/lib/portfolio-analyse/momentum-trader/momentum-finviz-server'
import { bewerteKatalysatorPlaybooks } from '@/lib/portfolio-analyse/momentum-trader/momentum-playbooks-katalysator'
import { bewerteEarningsExtendedPlaybooks } from '@/lib/portfolio-analyse/momentum-trader/momentum-playbooks-earnings-extended'
import { ladeNewsKatalysatorenBatch } from '@/lib/portfolio-analyse/momentum-trader/momentum-news-server'
import { ladeAnalystRatingsBatch } from '@/lib/portfolio-analyse/momentum-trader/momentum-analyst-server'
import { ladeInsiderKauefeBatch } from '@/lib/portfolio-analyse/momentum-trader/momentum-insider-server'
import { bewerteErweitertePlaybooks } from '@/lib/portfolio-analyse/momentum-trader/momentum-playbooks-advanced'
import { bewertePatternPlaybooks } from '@/lib/portfolio-analyse/momentum-trader/momentum-playbooks-pattern'
import { loeseScanKonflikte, sortiereScanGlobal } from '@/lib/portfolio-analyse/momentum-trader/momentum-konflikt-server'
import { berechneTechSnapshot } from '@/lib/portfolio-analyse/momentum-trader/momentum-tech-snapshot-server'
import { guidanceLabel } from '@/lib/portfolio-analyse/momentum-trader/momentum-guidance'
import {
  ladeMomentumBars,
  ladeMomentumEarningsKalenderFuerSymbole,
  loescheMomentumScanFuerDatum,
  speichereMomentumScanErgebnisse,
  speichereMomentumTechSnapshots,
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
  MomentumTechSnapshot,
  MomentumWatchlistEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { symboleAusWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-server'
import { MOMENTUM_REGIME_SYMBOLS } from '@/lib/portfolio-analyse/momentum-trader/momentum-universe'
import { holeSektorenBatch } from '@/lib/portfolio-analyse/sektor-batch-server'

const SPY_SYMBOL = MOMENTUM_REGIME_SYMBOLS[0]

function addDaysIso(iso: string, tage: number): string {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + tage)
  return d.toISOString().slice(0, 10)
}

function primaeresSymbol(e: MomentumWatchlistEintrag): string | null {
  return primaeresAnzeigeSymbol(e)
}

function ampelAusScore(score: number, gatesFailed: string[], kritisch = false): MomentumAmpel {
  if (kritisch || gatesFailed.some((g) => g.startsWith('Keine Kursdaten'))) return 'grau'
  if (score >= 72 && gatesFailed.length === 0) return 'gruen'
  if (score >= 48) return 'gelb'
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
  sectorBars: MomentumBarDaily[] = [],
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
    gatesFailed.push('Relative Stärke vs. S&P nicht berechenbar')
  }

  if (sectorBars.length > 0 && richtung != null) {
    const secIdx = sectorBars.findIndex((b) => b.handelstag === bar.handelstag)
    const rsSek =
      secIdx >= 0 ? berechneRelativeStaerke(bars, sectorBars, ctx.barIdx, RS_TAGE) : null
    if (rsSek != null) {
      if (richtung === 'long' && rsSek >= RS_MIN_LONG_PCT) {
        gatesPassed.push('RS vs. Sektor-ETF (' + RS_TAGE + 'T): +' + rsSek + '%')
      } else if (richtung === 'short' && rsSek <= RS_MAX_SHORT_PCT) {
        gatesPassed.push('RS vs. Sektor-ETF (' + RS_TAGE + 'T): ' + rsSek + '%')
      } else {
        gatesFailed.push('RS vs. Sektor widerspricht (' + rsSek + '%)')
      }
    }
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

function bewerteIpoBeobachtung(
  symbol: string,
  ipoDatum: string,
  regimeGates: MomentumRegimeGates,
): MomentumScanEintrag {
  const heute = heuteIsoUtc()
  const tageBis = tageZwischenIso(heute, ipoDatum)
  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  if (tageBis > 0) {
    gatesPassed.push('IPO geplant in ' + tageBis + ' Tagen (' + ipoDatum + ')')
  } else {
    gatesFailed.push('IPO-Datum in der Vergangenheit')
  }

  gatesPassed.push(
    'Regime: ' + (regimeGates.longBias ? 'Long' : '—') + ' / ' + (regimeGates.shortBias ? 'Short' : '—'),
  )
  gatesFailed.push('Noch nicht gelistet — kein Trade bis nach Börsengang')

  let score = 20
  if (tageBis > 0 && tageBis <= 30) score += 15
  else if (tageBis > 30 && tageBis <= 90) score += 8

  return {
    scanDate: heute,
    symbol,
    playbook: 'ipo_fade',
    score,
    ampel: 'grau',
    gatesPassed,
    gatesFailed,
    indikatoren: {
      playbookLabel: 'IPO-Beobachtung',
      ipoDatum,
      tageBisEarnings: tageBis,
      hinweis: 'Pre-IPO — nach Listung Kurse syncen, dann IPO-Fade prüfen',
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

export type MomentumScanOptionen = {
  mitKiMemos?: boolean
  /** Finviz Short-Float für Mean-Reversion (max. 10 Titel, ~8s). */
  mitFinviz?: boolean
  /** Google News + MarketBeat Analyst (max. je 8–10 Titel). */
  mitKatalysatoren?: boolean
  /** OpenInsider Form 4 + Short-Squeeze (max. 8 Titel). */
  mitErweitert?: boolean
}

type SymbolScanPaket = {
  symbol: string
  name: string
  symbolYahoo: string | null
  bars: MomentumBarDaily[]
  tech: MomentumTechSnapshot
  sectorBars: MomentumBarDaily[]
  sectorEtf: string | null
}

/** Scan: tägliche + Earnings + IPO Playbooks, global nach Wahrscheinlichkeit sortiert. */
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
  const sektorMap = await holeSektorenBatch(
    watchlist.map((e) => ({ isin: e.isin, symbolYahoo: e.symbolYahoo, name: e.name })),
  )
  const sectorBarsCache = new Map<string, MomentumBarDaily[]>()

  const ergebnisse: MomentumScanEintrag[] = []
  const techSnapshots: MomentumTechSnapshot[] = []
  const symbolPakete: SymbolScanPaket[] = []

  for (const e of watchlist) {
    const symbol = primaeresSymbol(e)
    if (!symbol) continue

    const sektor = sektorMap[e.isin]?.sektor ?? sektorMap[symbol]?.sektor ?? null
    const etf = sektorEtfSymbol(sektor)
    let sectorBars: MomentumBarDaily[] = []
    if (etf) {
      const cached = sectorBarsCache.get(etf)
      if (cached) {
        sectorBars = cached
      } else {
        sectorBars = await ladeMomentumBars(etf, vonBars, heute)
        sectorBarsCache.set(etf, sectorBars)
      }
    }

    const events = await ladeEarningsEventsFuerWatchlistEintrag(e)
    const gapStat = gapVolatilitaetSchaetzung(events)
    const medianGap = gapStat.medianGapPct ?? medianGapAbsPct(events) ?? (await ladeMedianGapFuerSymbol(symbol))
    const bars = await ladeBarsFuerEarningsGap(e, vonBars, heute)
    const historie = berechneEarningsHistorieStatistik(events, bars)

    // --- Tägliche Playbooks (Always-On) ---
    const tech = berechneTechSnapshot(symbol, bars, spyBars, sectorBars, heute)
    if (tech) {
      techSnapshots.push(tech)
      symbolPakete.push({
        symbol,
        name: e.name,
        symbolYahoo: e.symbolYahoo,
        bars,
        tech,
        sectorBars,
        sectorEtf: etf,
      })
      const taeglich = bewerteTaeglichePlaybooks(tech, bars, regimeGates, kalender)
      ergebnisse.push(...taeglich)
    }

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

      const mom = bewerteEarningsMomentum(symbol, t.earningsDate, zeit, bars, spyBars, regimeGates, ev, sectorBars)
      if (mom && mom.score >= 40) ergebnisse.push(mom)
    }

    const vergangenExtended = kalender.filter((k) => {
      if (k.symbol !== symbol) return false
      const tage = tageZwischenIso(k.earningsDate, heute)
      return tage >= 0 && tage <= EARNINGS_EXTENDED_LOOKBACK_TAGE
    })

    for (const t of vergangenExtended) {
      const ev = eventFuerDatum(events, t.earningsDate)
      const zeit = ev?.timeBmoAmc ?? t.timeBmoAmc
      ergebnisse.push(
        ...bewerteEarningsExtendedPlaybooks({
          symbol,
          earningsDate: t.earningsDate,
          timeBmoAmc: zeit,
          bars,
          spyBars,
          regimeGates,
          event: ev,
        }),
      )
    }

    const naechstesKommend = kalender
      .filter((k) => {
        if (k.symbol !== symbol) return false
        if (k.earningsDate < heute) return false
        const tage = tageZwischenIso(heute, k.earningsDate)
        return tage >= 0 && tage <= EARNINGS_BEOBACHTUNG_MAX_TAGE
      })
      .sort((a, b) => a.earningsDate.localeCompare(b.earningsDate))[0]

    if (naechstesKommend) {
      ergebnisse.push(
        bewerteEarningsPreEvent(
          symbol,
          heute,
          naechstesKommend.earningsDate,
          naechstesKommend.timeBmoAmc,
          regimeGates,
          medianGap,
          bars,
          events,
          historie,
        ),
      )

      const preRun = bewerteEarningsPreRun(
        symbol,
        heute,
        naechstesKommend.earningsDate,
        naechstesKommend.timeBmoAmc,
        regimeGates,
        bars,
        spyBars,
        historie,
      )
      if (preRun && (preRun.ampel === 'gruen' || preRun.ampel === 'gelb')) {
        ergebnisse.push(preRun)
      }
    }

    const ipoDatum =
      e.ipoDatum ??
      (istMomentumPreIpoEintrag(e) ? await ladeMomentumIpoDatum(symbol, e.symbolYahoo) : null)
    if (ipoDatum) {
      const tageBisIpo = tageZwischenIso(heute, ipoDatum)
      if (tageBisIpo > 0) {
        ergebnisse.push(bewerteIpoBeobachtung(symbol, ipoDatum, regimeGates))
      } else {
        const ipo = bewerteIpoFade(symbol, ipoDatum, bars, regimeGates)
        if (ipo) ergebnisse.push(ipo)
      }
    }
  }

  // --- Phase 2: Finviz + Mean Reversion + Regime ---
  if (symbolPakete.length > 0) {
    if (opts?.mitFinviz !== false) {
      const finvizMap = await ladeFinvizKennzahlenBatch(
        symbolPakete.map((p) => p.symbol),
        10,
      )
      for (const p of symbolPakete) {
        const fz = finvizMap.get(p.symbol.toUpperCase())
        if (fz?.shortFloatPct != null) {
          p.tech = { ...p.tech, shortFloatPct: fz.shortFloatPct }
        }
      }
    }

    const regimeKontext = berechneRegimeKontext(techSnapshots, spyBars, sectorBarsCache)
    if (regimeGates.regime.spyReturn5dPct == null && regimeKontext.spyReturn5dPct != null) {
      regimeGates.regime.spyReturn5dPct = regimeKontext.spyReturn5dPct
    }

    for (const p of symbolPakete) {
      ergebnisse.push(
        ...bewerteMeanReversionPlaybooks(p.tech, p.bars, regimeGates, kalender, regimeKontext),
      )
      ergebnisse.push(
        ...bewerteRegimePlaybooks(p.tech, p.bars, regimeGates, p.sectorEtf, regimeKontext),
      )
      ergebnisse.push(
        ...bewertePatternPlaybooks({
          tech: p.tech,
          bars: p.bars,
          regimeGates,
          kalender,
          sectorEtf: p.sectorEtf,
          rk: regimeKontext,
        }),
      )
    }

    // --- Phase 3: News + Analyst + Katalysator-Playbooks ---
    if (opts?.mitKatalysatoren !== false) {
      const newsMap = await ladeNewsKatalysatorenBatch(
        symbolPakete.map((p) => ({ symbol: p.symbol, name: p.name })),
        10,
      )
      const analystMap = await ladeAnalystRatingsBatch(
        symbolPakete.map((p) => ({ symbol: p.symbol, symbolYahoo: p.symbolYahoo })),
        8,
      )
      for (const p of symbolPakete) {
        const sym = p.symbol.toUpperCase()
        ergebnisse.push(
          ...bewerteKatalysatorPlaybooks({
            tech: p.tech,
            bars: p.bars,
            regimeGates,
            kalender,
            news: newsMap.get(sym) ?? null,
            ratings: analystMap.get(sym) ?? [],
          }),
        )
      }
    }

    // --- Phase 5: Insider-Cluster + Short-Squeeze ---
    if (opts?.mitErweitert !== false) {
      const insiderMap = await ladeInsiderKauefeBatch(
        symbolPakete.map((p) => p.symbol),
        8,
      )
      for (const p of symbolPakete) {
        const sym = p.symbol.toUpperCase()
        ergebnisse.push(
          ...bewerteErweitertePlaybooks({
            tech: p.tech,
            bars: p.bars,
            regimeGates,
            kalender,
            insiderKauefe: insiderMap.get(sym) ?? [],
          }),
        )
      }
    }
  }

  const { ergaenzeScanMitErfolg } = await import(
    '@/lib/portfolio-analyse/momentum-trader/momentum-trade-erfolg-server'
  )
  const { ladePlaybookStats, baueStatsLookup, wendePlaybookDeaktivierungAn } = await import(
    '@/lib/portfolio-analyse/momentum-trader/momentum-playbook-stats-server'
  )
  const statsPaket = await ladePlaybookStats()
  const statsLookup = baueStatsLookup(statsPaket.stats)
  const mitErfolg = ergaenzeScanMitErfolg(ergebnisse, regimeGates, statsLookup)
  const mitDeaktiv = wendePlaybookDeaktivierungAn(mitErfolg, statsLookup)
  const aufgeloest = loeseScanKonflikte(mitDeaktiv)
  const final = sortiereScanGlobal(aufgeloest)

  if (final.length > 0) {
    await loescheMomentumScanFuerDatum(heute)
    await speichereMomentumScanErgebnisse(final)
    if (techSnapshots.length > 0) {
      await speichereMomentumTechSnapshots(techSnapshots).catch(() => {})
    }
    const { speichereMomentumScanVerlauf } = await import(
      '@/lib/portfolio-analyse/momentum-trader/momentum-scan-verlauf-server'
    )
    await speichereMomentumScanVerlauf(final)
    const { archiviereTopSignale } = await import(
      '@/lib/portfolio-analyse/momentum-trader/momentum-top-signal-tracking-server'
    )
    await archiviereTopSignale(final).catch(() => {})
  }

  let mitMemos = final
  if (opts?.mitKiMemos) {
    const { ergaenzeScanMitKiMemos } = await import(
      '@/lib/portfolio-analyse/momentum-trader/momentum-scan-memo-server'
    )
    const { ergaenzePreEventMitKiMemos } = await import(
      '@/lib/portfolio-analyse/momentum-trader/momentum-pre-event-memo-server'
    )
    mitMemos = await ergaenzeScanMitKiMemos(final)
    mitMemos = await ergaenzePreEventMitKiMemos(mitMemos)
    if (mitMemos.length > 0) {
      await loescheMomentumScanFuerDatum(heute)
      await speichereMomentumScanErgebnisse(mitMemos)
    }
  }

  return { scanDate: heute, regime: regimeGates, ergebnisse: mitMemos, playbookStats: statsPaket }
}

export { momentumPlaybookLabel as playbookLabel }

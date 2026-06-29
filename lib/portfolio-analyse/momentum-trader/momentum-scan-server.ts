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
  RVOL_MIN,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import {
  ladeMedianGapFuerSymbol,
  medianGapAbsPct,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-events-server'
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
  berechneRvol,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-indicators'
import { berechnePositionsVorschlag } from '@/lib/portfolio-analyse/momentum-trader/momentum-position-sizing'
import type {
  MomentumAmpel,
  MomentumBarDaily,
  MomentumRegimeGates,
  MomentumRichtung,
  MomentumScanEintrag,
  MomentumScanPaket,
  MomentumWatchlistEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { symboleAusWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-server'

function addDaysIso(iso: string, tage: number): string {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + tage)
  return d.toISOString().slice(0, 10)
}

function primaeresSymbol(e: MomentumWatchlistEintrag): string | null {
  return e.symbolYahoo?.trim().toUpperCase() || e.symbolCandidates[0]?.trim().toUpperCase() || null
}

function findeBarAbDatum(bars: MomentumBarDaily[], abDatum: string): number | null {
  const idx = bars.findIndex((b) => b.handelstag >= abDatum)
  return idx >= 0 ? idx : null
}

function ampelAusScore(score: number, gatesFailed: string[], kritisch = false): MomentumAmpel {
  if (kritisch || gatesFailed.some((g) => g.startsWith('Keine Kursdaten'))) return 'grau'
  if (score >= 70 && gatesFailed.length === 0) return 'gruen'
  if (score >= 45) return 'gelb'
  return 'rot'
}

function playbookLabel(playbook: MomentumScanEintrag['playbook']): string {
  if (playbook === 'earnings_gap_fade') return 'Earnings-Gap-Fade'
  if (playbook === 'earnings_vorlauf') return 'Earnings-Vorlauf'
  return playbook
}

function bewerteGapFade(
  symbol: string,
  earningsDate: string,
  bars: MomentumBarDaily[],
  regimeGates: MomentumRegimeGates,
  medianGap: number | null,
): MomentumScanEintrag | null {
  const heute = heuteIsoUtc()
  const tageSeit = tageZwischenIso(earningsDate, heute)
  if (tageSeit < 0 || tageSeit > EARNINGS_LOOKBACK_TAGE) return null

  const barIdx = findeBarAbDatum(bars, earningsDate)
  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  if (barIdx == null || barIdx < 1) {
    return {
      scanDate: heute,
      symbol,
      playbook: 'earnings_gap_fade',
      score: 0,
      ampel: 'grau',
      gatesPassed: [],
      gatesFailed: ['Keine Kursdaten nach Earnings'],
      indikatoren: { earningsDate, tageSeitEarnings: tageSeit, playbookLabel: playbookLabel('earnings_gap_fade') },
    }
  }

  const bar = bars[barIdx]
  const prevClose = bars[barIdx - 1].close
  const gapPct = berechneGapPct(bar, prevClose)
  const rvol = berechneRvol(bars, barIdx)
  const atr = berechneAtr(bars, barIdx)

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
    richtung && atr != null
      ? berechnePositionsVorschlag(bar.open, atr, richtung)
      : null

  return {
    scanDate: heute,
    symbol,
    playbook: 'earnings_gap_fade',
    score,
    ampel: ampelAusScore(score, gatesFailed),
    gatesPassed,
    gatesFailed,
    indikatoren: {
      playbookLabel: playbookLabel('earnings_gap_fade'),
      earningsDate,
      tageSeitEarnings: tageSeit,
      gapPct,
      medianGapPct: medianGap,
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
    gatesPassed.push('Earnings in ' + tageBis + ' Tagen (Fenster ' + EARNINGS_VORLAUF_MIN + '–' + EARNINGS_VORLAUF_MAX + ')')
  } else {
    gatesFailed.push('Außerhalb Vorlauf-Fenster')
  }

  if (medianGap != null) {
    gatesPassed.push('Historischer Median-Gap: ' + medianGap.toFixed(1) + '%')
  } else {
    gatesFailed.push('Keine Gap-Historie — Backfill ausführen')
  }

  gatesPassed.push('Regime: ' + (regimeGates.longBias ? 'Long' : '—') + ' / ' + (regimeGates.shortBias ? 'Short' : '—'))

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
      playbookLabel: playbookLabel('earnings_vorlauf'),
      earningsDate,
      tageBisEarnings: tageBis,
      timeBmoAmc,
      medianGapPct: medianGap,
      hinweis: 'Beobachten — nach Earnings Kurse syncen + Scan wiederholen',
    },
  }
}

/** Scan: Gap-Fade (nach Earnings) + Vorlauf (bevorstehend). */
export async function scanMomentumWatchlist(
  watchlist: MomentumWatchlistEintrag[],
  regimeGates: MomentumRegimeGates,
): Promise<MomentumScanPaket> {
  const heute = heuteIsoUtc()
  const vonBars = addDaysIso(heute, -120)
  const symbole = symboleAusWatchlist(watchlist)
  const kalender = await ladeMomentumEarningsKalenderFuerSymbole(symbole)

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
      const hit = bewerteGapFade(symbol, t.earningsDate, bars, regimeGates, medianGap)
      if (hit) ergebnisse.push(hit)
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
  }

  ergebnisse.sort((a, b) => b.score - a.score)

  await loescheMomentumScanFuerDatum(heute)
  if (ergebnisse.length > 0) await speichereMomentumScanErgebnisse(ergebnisse)

  return { scanDate: heute, regime: regimeGates, ergebnisse }
}

export { playbookLabel }

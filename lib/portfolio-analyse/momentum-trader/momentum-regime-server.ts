/**
 * Momentum Trader — Markt-Regime (SPY + VIX) aus OHLCV-Bars.
 */

import 'server-only'

import { heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { berechneSma, berechneReturnPct } from '@/lib/portfolio-analyse/momentum-trader/momentum-indicators'
import {
  ladeMomentumBars,
  speichereMomentumBars,
  speichereMomentumMarketRegime,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-db-server'
import type {
  MomentumBarDaily,
  MomentumMarketRegime,
  MomentumRegimeGates,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { ladeMomentumOhlcvBatch } from '@/lib/portfolio-analyse/momentum-trader/momentum-ohlcv-merge-server'

const SPY_SYMBOL = '^GSPC'
const VIX_SYMBOL = '^VIX'
const MA_TAGE = 20
const LOOKBACK_TAGE = 45

function addDaysIso(iso: string, tage: number): string {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + tage)
  return d.toISOString().slice(0, 10)
}

function barsZuMap(bars: MomentumBarDaily[]): Map<string, MomentumBarDaily> {
  return new Map(bars.map((b) => [b.handelstag, b]))
}

async function ladeOderHoleBars(symbol: string, von: string, bis: string): Promise<MomentumBarDaily[]> {
  let bars = await ladeMomentumBars(symbol, von, bis)
  if (bars.length >= MA_TAGE) return bars
  const frischMap = await ladeMomentumOhlcvBatch([symbol], von, bis)
  const frisch = frischMap.get(symbol.trim().toUpperCase()) ?? []
  if (frisch.length > 0) {
    await speichereMomentumBars(frisch)
    bars = frisch
  }
  return bars.sort((a, b) => a.handelstag.localeCompare(b.handelstag))
}

function vixAenderungPct(vixBars: MomentumBarDaily[], index: number): number | null {
  if (index <= 0) return null
  const prev = vixBars[index - 1].close
  const cur = vixBars[index].close
  if (prev <= 0) return null
  return Math.round(((cur - prev) / prev) * 10_000) / 100
}

/** Hard Gates aus dem Regime-Snapshot. */
export function berechneRegimeGates(regime: MomentumMarketRegime): MomentumRegimeGates {
  const vix = regime.vixClose ?? 0
  const spyUeberMa = regime.spyAbove20Ma === true
  const gatesPassed: string[] = []
  const gatesFailed: string[] = []

  if (spyUeberMa) gatesPassed.push('SPY über 20-Tage-MA (Risk-on)')
  else gatesFailed.push('SPY unter 20-Tage-MA')

  if (vix < 22) gatesPassed.push('VIX < 22')
  else gatesFailed.push('VIX ≥ 22 (erhöhte Volatilität)')

  const longBias = spyUeberMa && vix < 22
  const shortBias = !spyUeberMa || vix >= 20

  if (longBias) gatesPassed.push('Long-Bias aktiv')
  if (shortBias) gatesPassed.push('Short-Bias aktiv')

  return {
    longBias,
    shortBias,
    gatesPassed,
    gatesFailed,
    regime,
  }
}

/** Berechnet Regime aus Bars und speichert den Snapshot. */
export async function syncMomentumMarketRegime(): Promise<MomentumRegimeGates | null> {
  const bis = heuteIsoUtc()
  const von = addDaysIso(bis, -LOOKBACK_TAGE)

  const [spyBars, vixBars] = await Promise.all([
    ladeOderHoleBars(SPY_SYMBOL, von, bis),
    ladeOderHoleBars(VIX_SYMBOL, von, bis),
  ])

  if (spyBars.length < MA_TAGE) return null

  const spyIdx = spyBars.length - 1
  const handelstag = spyBars[spyIdx].handelstag
  const spyClose = spyBars[spyIdx].close
  const spyMa20 = berechneSma(spyBars, spyIdx, MA_TAGE)
  const spyReturn5dPct = berechneReturnPct(spyBars, spyIdx, 5)

  const vixBar = barsZuMap(vixBars).get(handelstag) ?? vixBars[vixBars.length - 1]
  const vixIdx = vixBars.findIndex((b) => b.handelstag === vixBar?.handelstag)
  const vixClose = vixBar?.close ?? null
  const vixChange = vixIdx >= 0 ? vixAenderungPct(vixBars, vixIdx) : null

  const regime: MomentumMarketRegime = {
    handelstag,
    spyClose,
    spyMa20,
    spyAbove20Ma: spyMa20 != null ? spyClose > spyMa20 : null,
    vixClose,
    vixChangePct: vixChange,
    spyReturn5dPct,
  }

  await speichereMomentumMarketRegime(regime)
  return berechneRegimeGates(regime)
}

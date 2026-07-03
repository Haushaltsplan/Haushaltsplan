/**
 * Playbook-Backtest — historische Trefferquoten aus Watchlist-Bars.
 */

import 'server-only'

import { tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { simuliereTradeOutcome } from '@/lib/portfolio-analyse/momentum-trader/momentum-backtest-outcome'
import {
  BACKTEST_HOLD_TAGE,
  BACKTEST_LOOKBACK_TAGE,
  BACKTEST_STEP_TAGE,
  EARNINGS_EXTENDED_LOOKBACK_TAGE,
  EARNINGS_LOOKBACK_TAGE,
  EARNINGS_POST_RUN_MAX,
  EARNINGS_POST_RUN_MIN,
  GAP_MIN_PCT,
  GAP_MEDIAN_FAKTOR,
  GUIDANCE_SHOCK_GAP_MIN_PCT,
  MOMENTUM_GAP_MIN_PCT,
  REV_DIVERGENCE_EPS_MIN,
  REV_DIVERGENCE_GAP_MIN,
  REV_DIVERGENCE_REV_MAX,
  RVOL_MIN,
  SURPRISE_BEAT_MIN_PCT,
  SURPRISE_MISS_MAX_PCT,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import { findeEarningsReaktionsBar } from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-bar'
import { medianGapAbsPct } from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-events-server'
import { bewerteMeanReversionPlaybooks } from '@/lib/portfolio-analyse/momentum-trader/momentum-playbooks-mean-reversion'
import { bewertePatternPlaybooks } from '@/lib/portfolio-analyse/momentum-trader/momentum-playbooks-pattern'
import { bewerteRegimePlaybooks } from '@/lib/portfolio-analyse/momentum-trader/momentum-playbooks-regime'
import { bewerteTaeglichePlaybooks } from '@/lib/portfolio-analyse/momentum-trader/momentum-playbooks-taeglich'
import { berechnePositionsVorschlag } from '@/lib/portfolio-analyse/momentum-trader/momentum-position-sizing'
import { berechneTechSnapshot } from '@/lib/portfolio-analyse/momentum-trader/momentum-tech-snapshot-server'
import {
  berechneAtr,
  berechneGapPct,
  berechneRvol,
  berechneSma,
  berechneReturnPct,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-indicators'
import type {
  MomentumBarDaily,
  MomentumEarningsEvent,
  MomentumEarningsKalenderEintrag,
  MomentumEarningsZeit,
  MomentumPlaybook,
  MomentumPlaybookStat,
  MomentumRegimeGates,
  MomentumRegimeKontext,
  MomentumRichtung,
  MomentumScanEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

type Zaehler = { wins: number; losses: number; timeouts: number }

function leerZaehler(): Zaehler {
  return { wins: 0, losses: 0, timeouts: 0 }
}

function addOutcome(z: Zaehler, outcome: 'win' | 'loss' | 'timeout'): void {
  if (outcome === 'win') z.wins += 1
  else if (outcome === 'loss') z.losses += 1
  else z.timeouts += 1
}

function trefferPct(z: Zaehler): number | null {
  const n = z.wins + z.losses + z.timeouts
  if (n === 0) return null
  return Math.round((z.wins / n) * 1000) / 10
}

function barsBisDatum(bars: MomentumBarDaily[], datum: string): MomentumBarDaily[] {
  let last = -1
  for (let i = 0; i < bars.length; i++) {
    if (bars[i]!.handelstag <= datum) last = i
    else break
  }
  return last >= 0 ? bars.slice(0, last + 1) : []
}

function neutraleRegimeGates(handelstag: string, spyBars: MomentumBarDaily[]): MomentumRegimeGates {
  const idx = spyBars.length - 1
  const spyClose = idx >= 0 ? spyBars[idx]!.close : null
  const spyMa20 = idx >= 0 ? berechneSma(spyBars, idx, 20) : null
  return {
    longBias: true,
    shortBias: true,
    gatesPassed: [],
    gatesFailed: [],
    regime: {
      handelstag,
      spyClose,
      spyMa20,
      spyAbove20Ma: spyMa20 != null && spyClose != null && spyClose >= spyMa20,
      vixClose: null,
      vixChangePct: null,
      spyReturn5dPct: idx >= 0 ? berechneReturnPct(spyBars, idx, 5) : null,
    },
  }
}

function regimeKontextAusSpy(
  spyBars: MomentumBarDaily[],
  sectorEtf: string | null,
  sectorBars: MomentumBarDaily[],
): MomentumRegimeKontext {
  const idx = spyBars.length - 1
  const sectorReturn5d: Record<string, number> = {}
  if (sectorEtf && sectorBars.length >= 6) {
    const ret = berechneReturnPct(sectorBars, sectorBars.length - 1, 5)
    if (ret != null) sectorReturn5d[sectorEtf] = ret
  }
  return {
    spyReturn5dPct: idx >= 0 ? berechneReturnPct(spyBars, idx, 5) : null,
    watchlistBreadthPct: null,
    sectorReturn5d,
  }
}

function zaehlerKey(playbook: MomentumPlaybook, symbol: string): string {
  return playbook + '|' + symbol
}

function globalKey(playbook: MomentumPlaybook): string {
  return playbook + '|'
}

function simuliereScanEintrag(
  e: MomentumScanEintrag,
  bars: MomentumBarDaily[],
  entryIdx: number,
): 'win' | 'loss' | 'timeout' | null {
  const r = e.indikatoren.richtung
  if (r !== 'long' && r !== 'short') return null
  const entry = typeof e.indikatoren.entryPrice === 'number' ? e.indikatoren.entryPrice : null
  const stop = typeof e.indikatoren.stopPrice === 'number' ? e.indikatoren.stopPrice : null
  const target = typeof e.indikatoren.targetPrice === 'number' ? e.indikatoren.targetPrice : null
  if (entry == null || stop == null || target == null) return null
  if (entryIdx + BACKTEST_HOLD_TAGE >= bars.length) return null
  return simuliereTradeOutcome(bars, entryIdx, entry, stop, target, r, BACKTEST_HOLD_TAGE)
}

function bewerteTaeglicheAnIdx(
  symbol: string,
  bars: MomentumBarDaily[],
  spyBars: MomentumBarDaily[],
  sectorBars: MomentumBarDaily[],
  kalender: MomentumEarningsKalenderEintrag[],
  idx: number,
  sectorEtf: string | null,
): MomentumScanEintrag[] {
  const handelstag = bars[idx]!.handelstag
  const slice = bars.slice(0, idx + 1)
  const spySlice = barsBisDatum(spyBars, handelstag)
  const sectorSlice = barsBisDatum(sectorBars, handelstag)
  if (slice.length < 55 || spySlice.length < 55) return []

  const tech = berechneTechSnapshot(symbol, slice, spySlice, sectorSlice, handelstag)
  if (!tech) return []

  const gates = neutraleRegimeGates(handelstag, spySlice)
  const rk = regimeKontextAusSpy(spySlice, sectorEtf, sectorSlice)

  return [
    ...bewerteTaeglichePlaybooks(tech, slice, gates, kalender),
    ...bewerteMeanReversionPlaybooks(tech, slice, gates, kalender, rk),
    ...bewerteRegimePlaybooks(tech, slice, gates, sectorEtf, rk),
    ...bewertePatternPlaybooks({
      tech,
      bars: slice,
      regimeGates: gates,
      kalender,
      sectorEtf,
      rk,
    }),
  ]
}

function backtesteSymbolDaily(
  symbol: string,
  bars: MomentumBarDaily[],
  spyBars: MomentumBarDaily[],
  sectorBars: MomentumBarDaily[],
  kalender: MomentumEarningsKalenderEintrag[],
  sectorEtf: string | null,
  perSymbol: Map<string, Zaehler>,
  global: Map<string, Zaehler>,
  seitIdx: number,
): void {
  const maxIdx = bars.length - BACKTEST_HOLD_TAGE - 1
  for (let idx = seitIdx; idx <= maxIdx; idx += BACKTEST_STEP_TAGE) {
    const signale = bewerteTaeglicheAnIdx(symbol, bars, spyBars, sectorBars, kalender, idx, sectorEtf)
    for (const e of signale) {
      const outcome = simuliereScanEintrag(e, bars, idx)
      if (!outcome) continue
      const sk = zaehlerKey(e.playbook, symbol)
      const gk = globalKey(e.playbook)
      if (!perSymbol.has(sk)) perSymbol.set(sk, leerZaehler())
      if (!global.has(gk)) global.set(gk, leerZaehler())
      addOutcome(perSymbol.get(sk)!, outcome)
      addOutcome(global.get(gk)!, outcome)
    }
  }
}

function simuliereEarningsTrade(
  bars: MomentumBarDaily[],
  entryIdx: number,
  entry: number,
  atr: number,
  richtung: MomentumRichtung,
): 'win' | 'loss' | 'timeout' | null {
  const pos = berechnePositionsVorschlag(entry, atr, richtung)
  if (!pos || entryIdx + BACKTEST_HOLD_TAGE >= bars.length) return null
  return simuliereTradeOutcome(
    bars,
    entryIdx,
    pos.entryPrice,
    pos.stopPrice,
    pos.targetPrice,
    richtung,
    BACKTEST_HOLD_TAGE,
  )
}

function baueReaktionsKontext(
  bars: MomentumBarDaily[],
  earningsDate: string,
  timeBmoAmc: MomentumEarningsZeit,
): {
  bar: MomentumBarDaily
  barIdx: number
  gapPct: number | null
  rvol: number | null
  atr: number | null
} | null {
  const reaktion = findeEarningsReaktionsBar(bars, earningsDate, timeBmoAmc)
  if (!reaktion) return null
  const bar = bars[reaktion.barIdx]!
  return {
    bar,
    barIdx: reaktion.barIdx,
    gapPct: berechneGapPct(bar, reaktion.prevClose),
    rvol: berechneRvol(bars, reaktion.barIdx),
    atr: berechneAtr(bars, reaktion.barIdx),
  }
}

function registriereOutcome(
  playbook: MomentumPlaybook,
  symbol: string,
  outcome: 'win' | 'loss' | 'timeout',
  perSymbol: Map<string, Zaehler>,
  global: Map<string, Zaehler>,
): void {
  const sk = zaehlerKey(playbook, symbol)
  if (!perSymbol.has(sk)) perSymbol.set(sk, leerZaehler())
  addOutcome(perSymbol.get(sk)!, outcome)
  const gk = globalKey(playbook)
  if (!global.has(gk)) global.set(gk, leerZaehler())
  addOutcome(global.get(gk)!, outcome)
}

function backtesteEarningsEvent(
  event: MomentumEarningsEvent,
  bars: MomentumBarDaily[],
  eventsHistorie: MomentumEarningsEvent[],
  perSymbol: Map<string, Zaehler>,
  global: Map<string, Zaehler>,
): void {
  const ctx = baueReaktionsKontext(bars, event.earningsDate, event.timeBmoAmc)
  if (!ctx) return

  const { barIdx, bar, gapPct, rvol, atr } = ctx
  if (gapPct == null || rvol == null || atr == null) return
  if (barIdx + BACKTEST_HOLD_TAGE >= bars.length) return

  const surprise = event.surpriseEpsPct
  const medianGap = medianGapAbsPct(
    eventsHistorie.filter((ev) => ev.earningsDate < event.earningsDate),
  )

  if (
    Math.abs(gapPct) >= GAP_MIN_PCT &&
    rvol >= RVOL_MIN &&
    (medianGap == null || Math.abs(gapPct) >= medianGap * GAP_MEDIAN_FAKTOR)
  ) {
    const richtung: MomentumRichtung = gapPct > 0 ? 'short' : 'long'
    const outcome = simuliereEarningsTrade(bars, barIdx, bar.open, atr, richtung)
    if (outcome) registriereOutcome('earnings_gap_fade', event.symbol, outcome, perSymbol, global)
  }

  if (surprise != null) {
    const longOk =
      surprise >= SURPRISE_BEAT_MIN_PCT && gapPct >= MOMENTUM_GAP_MIN_PCT && bar.close > bar.open
    const shortOk =
      surprise <= SURPRISE_MISS_MAX_PCT && gapPct <= -MOMENTUM_GAP_MIN_PCT && bar.close < bar.open
    if ((longOk || shortOk) && rvol >= RVOL_MIN) {
      const richtung: MomentumRichtung = longOk ? 'long' : 'short'
      const outcome = simuliereEarningsTrade(bars, barIdx, bar.close, atr, richtung)
      if (outcome) registriereOutcome('earnings_momentum', event.symbol, outcome, perSymbol, global)
    }
  }

  for (let t = EARNINGS_POST_RUN_MIN; t <= EARNINGS_POST_RUN_MAX; t++) {
    const idx = barIdx + t
    if (idx >= bars.length) break
    const b = bars[idx]!
    const lauf = ((b.close - bar.close) / bar.close) * 100
    if (surprise != null && surprise >= SURPRISE_BEAT_MIN_PCT && lauf >= 1.5 && gapPct > 0) {
      const outcome = simuliereEarningsTrade(bars, idx, b.close, atr, 'long')
      if (outcome) registriereOutcome('earnings_post_run', event.symbol, outcome, perSymbol, global)
      break
    }
  }

  if (
    event.guidanceFlag === 'raise' &&
    gapPct >= GUIDANCE_SHOCK_GAP_MIN_PCT &&
    surprise != null &&
    surprise > 0
  ) {
    const outcome = simuliereEarningsTrade(bars, barIdx, bar.open, atr, 'long')
    if (outcome) registriereOutcome('guidance_shock', event.symbol, outcome, perSymbol, global)
  }
  if (event.guidanceFlag === 'lower' && gapPct <= -GUIDANCE_SHOCK_GAP_MIN_PCT) {
    const outcome = simuliereEarningsTrade(bars, barIdx, bar.open, atr, 'short')
    if (outcome) registriereOutcome('guidance_shock', event.symbol, outcome, perSymbol, global)
  }

  const revSurp = event.surpriseRevPct
  if (
    surprise != null &&
    surprise >= REV_DIVERGENCE_EPS_MIN &&
    revSurp != null &&
    revSurp <= REV_DIVERGENCE_REV_MAX &&
    gapPct >= REV_DIVERGENCE_GAP_MIN
  ) {
    const outcome = simuliereEarningsTrade(bars, barIdx, bar.open, atr, 'short')
    if (outcome) registriereOutcome('revenue_beat_divergence', event.symbol, outcome, perSymbol, global)
  }
}

export type BacktestEingabe = {
  symbol: string
  bars: MomentumBarDaily[]
  spyBars: MomentumBarDaily[]
  sectorBars: MomentumBarDaily[]
  sectorEtf: string | null
  kalender: MomentumEarningsKalenderEintrag[]
  events: MomentumEarningsEvent[]
}

function seitIdxFuerLookback(bars: MomentumBarDaily[], fensterTage: number): number {
  if (bars.length <= fensterTage) return 54
  return Math.max(54, bars.length - fensterTage)
}

/** Backtest für alle Symbole — liefert aggregierte Stats-Zeilen. */
export function fuehrePlaybookBacktestAus(
  eingaben: BacktestEingabe[],
  fensterTage = BACKTEST_LOOKBACK_TAGE,
): MomentumPlaybookStat[] {
  const perSymbol = new Map<string, Zaehler>()
  const global = new Map<string, Zaehler>()
  const berechnetAm = new Date().toISOString()

  for (const e of eingaben) {
    if (e.bars.length < 60) continue
    const seitIdx = seitIdxFuerLookback(e.bars, fensterTage)

    backtesteSymbolDaily(
      e.symbol,
      e.bars,
      e.spyBars,
      e.sectorBars,
      e.kalender,
      e.sectorEtf,
      perSymbol,
      global,
      seitIdx,
    )

    const lastBar = e.bars[e.bars.length - 1]!.handelstag
    const eventsImFenster = e.events.filter((ev) => {
      const diff = tageZwischenIso(ev.earningsDate, lastBar)
      return diff >= 0 && diff <= fensterTage + EARNINGS_EXTENDED_LOOKBACK_TAGE + EARNINGS_LOOKBACK_TAGE
    })

    for (const ev of eventsImFenster) {
      backtesteEarningsEvent(ev, e.bars, e.events, perSymbol, global)
    }
  }

  const out: MomentumPlaybookStat[] = []

  for (const [key, z] of global) {
    const playbook = key.split('|')[0] as MomentumPlaybook
    const n = z.wins + z.losses + z.timeouts
    if (n === 0) continue
    out.push({
      playbook,
      symbol: '',
      wins: z.wins,
      losses: z.losses,
      timeouts: z.timeouts,
      sampleSize: n,
      trefferPct: trefferPct(z),
      fensterTage,
      berechnetAm,
    })
  }

  for (const [key, z] of perSymbol) {
    const [playbook, symbol] = key.split('|') as [MomentumPlaybook, string]
    const n = z.wins + z.losses + z.timeouts
    if (n < 3) continue
    out.push({
      playbook,
      symbol,
      wins: z.wins,
      losses: z.losses,
      timeouts: z.timeouts,
      sampleSize: n,
      trefferPct: trefferPct(z),
      fensterTage,
      berechnetAm,
    })
  }

  return out
}

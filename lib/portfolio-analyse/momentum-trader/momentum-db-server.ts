/** Momentum Trader — Supabase-Persistenz (Service Role, server-only). */

import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { MOMENTUM_REGIME_SYMBOLS } from '@/lib/portfolio-analyse/momentum-trader/momentum-universe'
import { MOMENTUM_WATCHLIST_MAX } from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-server'
import type {
  MomentumBarDaily,
  MomentumDatenStatus,
  MomentumEarningsKalenderEintrag,
  MomentumEarningsEvent,
  MomentumMarketRegime,
  MomentumScanEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const TABLE_BARS = 'momentum_bars_daily' as const
const TABLE_EARNINGS_CAL = 'momentum_earnings_calendar' as const
const TABLE_REGIME = 'momentum_market_regime_daily' as const
const TABLE_SCAN = 'momentum_scan_results' as const
const TABLE_EVENTS = 'momentum_earnings_events' as const

function istKonfiguriert(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

function admin() {
  return createSupabaseAdmin()
}

type BarDbZeile = {
  symbol: string
  handelstag: string
  open: number
  high: number
  low: number
  close: number
  adj_close: number | null
  volume: number
}

function barZuDb(bar: MomentumBarDaily): BarDbZeile {
  return {
    symbol: bar.symbol,
    handelstag: bar.handelstag,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    adj_close: bar.adjClose,
    volume: bar.volume,
  }
}

function dbZuBar(row: BarDbZeile): MomentumBarDaily {
  return {
    symbol: row.symbol,
    handelstag: row.handelstag,
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    adjClose: row.adj_close != null ? Number(row.adj_close) : null,
    volume: Number(row.volume),
  }
}

// ---------------------------------------------------------------------------
// Bars — schreiben / lesen
// ---------------------------------------------------------------------------

export async function speichereMomentumBars(bars: MomentumBarDaily[]): Promise<number> {
  if (!istKonfiguriert() || bars.length === 0) return 0
  const zeilen = bars.map(barZuDb)
  const { error } = await admin()
    .from(TABLE_BARS)
    .upsert(zeilen, { onConflict: 'symbol,handelstag' })
  if (error) {
    console.warn('[momentum-trader] Bars speichern:', error.message)
    throw new Error(error.message)
  }
  return zeilen.length
}

export async function ladeMomentumBars(
  symbol: string,
  vonDatum?: string,
  bisDatum?: string,
): Promise<MomentumBarDaily[]> {
  if (!istKonfiguriert()) return []
  let q = admin()
    .from(TABLE_BARS)
    .select('*')
    .eq('symbol', symbol.trim().toUpperCase())
    .order('handelstag', { ascending: true })
  if (vonDatum) q = q.gte('handelstag', vonDatum)
  if (bisDatum) q = q.lte('handelstag', bisDatum)
  const { data, error } = await q
  if (error) {
    console.warn('[momentum-trader] Bars laden:', error.message)
    return []
  }
  return (data ?? []).map((r) => dbZuBar(r as BarDbZeile))
}

type EarningsKalenderDbZeile = {
  symbol: string
  earnings_date: string
  time_bmo_amc: string
  eps_estimate: number | null
  revenue_estimate: number | null
  quarter: number | null
  year: number | null
}

function kalenderZuDb(e: MomentumEarningsKalenderEintrag): EarningsKalenderDbZeile {
  return {
    symbol: e.symbol.trim().toUpperCase(),
    earnings_date: e.earningsDate,
    time_bmo_amc: e.timeBmoAmc,
    eps_estimate: e.epsEstimate,
    revenue_estimate: e.revenueEstimate,
    quarter: e.quarter,
    year: e.year,
  }
}

export async function speichereMomentumEarningsKalender(
  eintraege: MomentumEarningsKalenderEintrag[],
): Promise<number> {
  if (!istKonfiguriert() || eintraege.length === 0) return 0
  const zeilen = eintraege.map(kalenderZuDb)
  const { error } = await admin()
    .from(TABLE_EARNINGS_CAL)
    .upsert(zeilen, { onConflict: 'symbol,earnings_date' })
  if (error) {
    console.warn('[momentum-trader] Earnings-Kalender speichern:', error.message)
    throw new Error(error.message)
  }
  return zeilen.length
}

export async function ladeMomentumEarningsKalenderFuerSymbole(
  symbole: string[],
): Promise<MomentumEarningsKalenderEintrag[]> {
  if (!istKonfiguriert() || symbole.length === 0) return []
  const uniq = [...new Set(symbole.map((s) => s.trim().toUpperCase()).filter(Boolean))]
  const { data, error } = await admin()
    .from(TABLE_EARNINGS_CAL)
    .select('*')
    .in('symbol', uniq)
    .order('earnings_date', { ascending: true })
  if (error) {
    console.warn('[momentum-trader] Earnings-Kalender laden:', error.message)
    return []
  }
  return (data ?? []).map((r) => {
    const row = r as EarningsKalenderDbZeile
    return {
      symbol: row.symbol,
      earningsDate: row.earnings_date,
      timeBmoAmc: row.time_bmo_amc as MomentumEarningsKalenderEintrag['timeBmoAmc'],
      epsEstimate: row.eps_estimate != null ? Number(row.eps_estimate) : null,
      revenueEstimate: row.revenue_estimate != null ? Number(row.revenue_estimate) : null,
      quarter: row.quarter,
      year: row.year,
    }
  })
}

export async function zaehleMomentumBarsFuerSymbole(symbole: string[]): Promise<number> {
  if (!istKonfiguriert() || symbole.length === 0) return 0
  const uniq = [...new Set(symbole.map((s) => s.trim().toUpperCase()).filter(Boolean))]
  const { count, error } = await admin()
    .from(TABLE_BARS)
    .select('*', { count: 'exact', head: true })
    .in('symbol', uniq)
  if (error) return 0
  return count ?? 0
}

// ---------------------------------------------------------------------------
// Earnings-Events (Historie)
// ---------------------------------------------------------------------------

type EventDbZeile = {
  symbol: string
  earnings_date: string
  time_bmo_amc: string
  eps_estimate: number | null
  eps_actual: number | null
  revenue_estimate: number | null
  revenue_actual: number | null
  surprise_eps_pct: number | null
  surprise_rev_pct: number | null
  guidance_flag: string
  price_prev_close: number | null
  open_gap: number | null
  close_day1: number | null
  gap_pct: number | null
  rvol: number | null
}

function eventZuDb(e: MomentumEarningsEvent): EventDbZeile {
  return {
    symbol: e.symbol.trim().toUpperCase(),
    earnings_date: e.earningsDate,
    time_bmo_amc: e.timeBmoAmc,
    eps_estimate: e.epsEstimate,
    eps_actual: e.epsActual,
    revenue_estimate: e.revenueEstimate,
    revenue_actual: e.revenueActual,
    surprise_eps_pct: e.surpriseEpsPct,
    surprise_rev_pct: e.surpriseRevPct,
    guidance_flag: e.guidanceFlag,
    price_prev_close: e.pricePrevClose,
    open_gap: e.openGap,
    close_day1: e.closeDay1,
    gap_pct: e.gapPct,
    rvol: e.rvol,
  }
}

function dbZuEvent(row: EventDbZeile): MomentumEarningsEvent {
  return {
    symbol: row.symbol,
    earningsDate: row.earnings_date,
    timeBmoAmc: row.time_bmo_amc as MomentumEarningsEvent['timeBmoAmc'],
    epsEstimate: row.eps_estimate != null ? Number(row.eps_estimate) : null,
    epsActual: row.eps_actual != null ? Number(row.eps_actual) : null,
    revenueEstimate: row.revenue_estimate != null ? Number(row.revenue_estimate) : null,
    revenueActual: row.revenue_actual != null ? Number(row.revenue_actual) : null,
    surpriseEpsPct: row.surprise_eps_pct != null ? Number(row.surprise_eps_pct) : null,
    surpriseRevPct: row.surprise_rev_pct != null ? Number(row.surprise_rev_pct) : null,
    guidanceFlag: row.guidance_flag as MomentumEarningsEvent['guidanceFlag'],
    pricePrevClose: row.price_prev_close != null ? Number(row.price_prev_close) : null,
    openGap: row.open_gap != null ? Number(row.open_gap) : null,
    closeDay1: row.close_day1 != null ? Number(row.close_day1) : null,
    gapPct: row.gap_pct != null ? Number(row.gap_pct) : null,
    rvol: row.rvol != null ? Number(row.rvol) : null,
  }
}

export async function speichereMomentumEarningsEvents(events: MomentumEarningsEvent[]): Promise<number> {
  if (!istKonfiguriert() || events.length === 0) return 0
  const { error } = await admin()
    .from(TABLE_EVENTS)
    .upsert(events.map(eventZuDb), { onConflict: 'symbol,earnings_date' })
  if (error) throw new Error(error.message)
  return events.length
}

export async function ladeMomentumEarningsEventsFuerSymbol(symbol: string): Promise<MomentumEarningsEvent[]> {
  if (!istKonfiguriert()) return []
  const sym = symbol.trim().toUpperCase()
  const { data, error } = await admin()
    .from(TABLE_EVENTS)
    .select('*')
    .eq('symbol', sym)
    .order('earnings_date', { ascending: false })
    .limit(12)
  if (error) return []
  return (data ?? []).map((r) => dbZuEvent(r as EventDbZeile))
}

// ---------------------------------------------------------------------------
// Markt-Regime
// ---------------------------------------------------------------------------

type RegimeDbZeile = {
  handelstag: string
  spy_close: number | null
  spy_ma20: number | null
  spy_above_20ma: boolean | null
  vix_close: number | null
  vix_change_pct: number | null
}

function dbZuRegime(row: RegimeDbZeile): MomentumMarketRegime {
  return {
    handelstag: row.handelstag,
    spyClose: row.spy_close != null ? Number(row.spy_close) : null,
    spyMa20: row.spy_ma20 != null ? Number(row.spy_ma20) : null,
    spyAbove20Ma: row.spy_above_20ma,
    vixClose: row.vix_close != null ? Number(row.vix_close) : null,
    vixChangePct: row.vix_change_pct != null ? Number(row.vix_change_pct) : null,
  }
}

export async function speichereMomentumMarketRegime(regime: MomentumMarketRegime): Promise<void> {
  if (!istKonfiguriert()) return
  const { error } = await admin()
    .from(TABLE_REGIME)
    .upsert(
      {
        handelstag: regime.handelstag,
        spy_close: regime.spyClose,
        spy_ma20: regime.spyMa20,
        spy_above_20ma: regime.spyAbove20Ma,
        vix_close: regime.vixClose,
        vix_change_pct: regime.vixChangePct,
      },
      { onConflict: 'handelstag' },
    )
  if (error) throw new Error(error.message)
}

export async function ladeNeuestesMomentumRegime(): Promise<MomentumMarketRegime | null> {
  if (!istKonfiguriert()) return null
  const { data, error } = await admin()
    .from(TABLE_REGIME)
    .select('*')
    .order('handelstag', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return dbZuRegime(data as RegimeDbZeile)
}

// ---------------------------------------------------------------------------
// Scan-Ergebnisse
// ---------------------------------------------------------------------------

export async function loescheMomentumScanFuerDatum(scanDate: string): Promise<void> {
  if (!istKonfiguriert()) return
  await admin().from(TABLE_SCAN).delete().eq('scan_date', scanDate)
}

export async function speichereMomentumScanErgebnisse(ergebnisse: MomentumScanEintrag[]): Promise<void> {
  if (!istKonfiguriert() || ergebnisse.length === 0) return
  const zeilen = ergebnisse.map((e) => ({
    scan_date: e.scanDate,
    symbol: e.symbol,
    playbook: e.playbook,
    score: e.score,
    ampel: e.ampel,
    gates_passed: e.gatesPassed,
    gates_failed: e.gatesFailed,
    indikatoren: e.indikatoren,
  }))
  const { error } = await admin().from(TABLE_SCAN).insert(zeilen)
  if (error) throw new Error(error.message)
}

export async function ladeMomentumScanFuerDatum(scanDate: string): Promise<MomentumScanEintrag[]> {
  if (!istKonfiguriert()) return []
  const { data, error } = await admin()
    .from(TABLE_SCAN)
    .select('*')
    .eq('scan_date', scanDate)
    .order('score', { ascending: false })
  if (error) return []
  return (data ?? []).map((r) => {
    const row = r as {
      scan_date: string
      symbol: string
      playbook: string
      score: number
      ampel: string
      gates_passed: string[]
      gates_failed: string[]
      indikatoren: Record<string, unknown>
    }
    return {
      scanDate: row.scan_date,
      symbol: row.symbol,
      playbook: row.playbook as MomentumScanEintrag['playbook'],
      score: row.score,
      ampel: row.ampel as MomentumScanEintrag['ampel'],
      gatesPassed: row.gates_passed ?? [],
      gatesFailed: row.gates_failed ?? [],
      indikatoren: (row.indikatoren ?? {}) as MomentumScanEintrag['indikatoren'],
    }
  })
}

export async function ladeNeuestenMomentumScan(): Promise<{ scanDate: string; ergebnisse: MomentumScanEintrag[] } | null> {
  if (!istKonfiguriert()) return null
  const { data, error } = await admin()
    .from(TABLE_SCAN)
    .select('scan_date')
    .order('scan_date', { ascending: false })
    .limit(1)
  if (error || !data?.length) return null
  const scanDate = (data[0] as { scan_date: string }).scan_date
  const ergebnisse = await ladeMomentumScanFuerDatum(scanDate)
  return { scanDate, ergebnisse }
}

export async function ladeMomentumDatenStatus(opts?: {
  watchlistAnzahl?: number
  watchlistSymbole?: string[]
  tradesAnzahl?: number
}): Promise<MomentumDatenStatus> {
  const leer: MomentumDatenStatus = {
    watchlistAnzahl: opts?.watchlistAnzahl ?? 0,
    watchlistMax: MOMENTUM_WATCHLIST_MAX,
    barsAnzahl: 0,
    barsNeuesterTag: null,
    earningsKalenderAnzahl: 0,
    earningsEventsAnzahl: 0,
    regimeNeuesterTag: null,
    regime: null,
    scanAnzahl: 0,
    tradesAnzahl: 0,
    supabaseKonfiguriert: istKonfiguriert(),
  }
  if (!istKonfiguriert()) return leer

  const symbole = [
    ...new Set([...MOMENTUM_REGIME_SYMBOLS, ...(opts?.watchlistSymbole ?? [])]),
  ]

  try {
    const [barsCount, barsNeueste, kalenderCount, eventsCount, regimeRow, scanCount] =
      await Promise.all([
        symbole.length > 0
          ? admin().from(TABLE_BARS).select('*', { count: 'exact', head: true }).in('symbol', symbole)
          : admin().from(TABLE_BARS).select('*', { count: 'exact', head: true }),
        admin().from(TABLE_BARS).select('handelstag').order('handelstag', { ascending: false }).limit(1),
        symbole.length > 0
          ? admin().from(TABLE_EARNINGS_CAL).select('*', { count: 'exact', head: true }).in('symbol', symbole)
          : Promise.resolve({ count: 0, data: null, error: null }),
        symbole.length > 0
          ? admin()
              .from('momentum_earnings_events')
              .select('*', { count: 'exact', head: true })
              .in('symbol', symbole)
          : admin().from('momentum_earnings_events').select('*', { count: 'exact', head: true }),
        admin()
          .from(TABLE_REGIME)
          .select('*')
          .order('handelstag', { ascending: false })
          .limit(1)
          .maybeSingle(),
        symbole.length > 0
          ? admin()
              .from('momentum_scan_results')
              .select('*', { count: 'exact', head: true })
              .in('symbol', symbole.filter((s) => !s.startsWith('^')))
          : admin().from('momentum_scan_results').select('*', { count: 'exact', head: true }),
      ])

    const regime = regimeRow.data ? dbZuRegime(regimeRow.data as RegimeDbZeile) : null

    return {
      watchlistAnzahl: opts?.watchlistAnzahl ?? 0,
      watchlistMax: MOMENTUM_WATCHLIST_MAX,
      barsAnzahl: barsCount.count ?? 0,
      barsNeuesterTag: (barsNeueste.data?.[0] as { handelstag: string } | undefined)?.handelstag ?? null,
      earningsKalenderAnzahl: kalenderCount.count ?? 0,
      earningsEventsAnzahl: eventsCount.count ?? 0,
      regimeNeuesterTag: regime?.handelstag ?? null,
      regime,
      scanAnzahl: scanCount.count ?? 0,
      tradesAnzahl: opts?.tradesAnzahl ?? 0,
      supabaseKonfiguriert: true,
    }
  } catch (e) {
    console.warn('[momentum-trader] Status laden fehlgeschlagen:', e)
    return leer
  }
}

export { istKonfiguriert as momentumSupabaseKonfiguriert }

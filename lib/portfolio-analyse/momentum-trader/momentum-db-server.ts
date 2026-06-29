/** Momentum Trader — Supabase-Persistenz (Service Role, server-only). */

import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type {
  MomentumBarDaily,
  MomentumDatenStatus,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const TABLE_BARS = 'momentum_bars_daily' as const

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

export async function ladeMomentumDatenStatus(): Promise<MomentumDatenStatus> {
  const leer: MomentumDatenStatus = {
    barsAnzahl: 0,
    barsNeuesterTag: null,
    earningsKalenderAnzahl: 0,
    earningsEventsAnzahl: 0,
    regimeNeuesterTag: null,
    scanAnzahl: 0,
    tradesAnzahl: 0,
    supabaseKonfiguriert: istKonfiguriert(),
  }
  if (!istKonfiguriert()) return leer

  try {
    const [barsCount, barsNeueste, kalenderCount, eventsCount, regimeNeueste, scanCount, tradesCount] =
      await Promise.all([
        admin().from(TABLE_BARS).select('*', { count: 'exact', head: true }),
        admin().from(TABLE_BARS).select('handelstag').order('handelstag', { ascending: false }).limit(1),
        admin().from('momentum_earnings_calendar').select('*', { count: 'exact', head: true }),
        admin().from('momentum_earnings_events').select('*', { count: 'exact', head: true }),
        admin()
          .from('momentum_market_regime_daily')
          .select('handelstag')
          .order('handelstag', { ascending: false })
          .limit(1),
        admin().from('momentum_scan_results').select('*', { count: 'exact', head: true }),
        admin().from('momentum_trades').select('*', { count: 'exact', head: true }),
      ])

    return {
      barsAnzahl: barsCount.count ?? 0,
      barsNeuesterTag: (barsNeueste.data?.[0] as { handelstag: string } | undefined)?.handelstag ?? null,
      earningsKalenderAnzahl: kalenderCount.count ?? 0,
      earningsEventsAnzahl: eventsCount.count ?? 0,
      regimeNeuesterTag: (regimeNeueste.data?.[0] as { handelstag: string } | undefined)?.handelstag ?? null,
      scanAnzahl: scanCount.count ?? 0,
      tradesAnzahl: tradesCount.count ?? 0,
      supabaseKonfiguriert: true,
    }
  } catch (e) {
    console.warn('[momentum-trader] Status laden fehlgeschlagen:', e)
    return leer
  }
}

export { istKonfiguriert as momentumSupabaseKonfiguriert }

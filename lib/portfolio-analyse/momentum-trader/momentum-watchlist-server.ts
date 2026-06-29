import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { MomentumWatchlistEintrag } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

export const MOMENTUM_WATCHLIST_MAX = 32

const TABLE = 'momentum_watchlist' as const
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/

type WatchlistDbZeile = {
  isin: string
  name: string
  symbol_yahoo: string | null
  symbol_candidates: string[] | null
  hinzugefuegt_am: string
  earnings_sync_am: string | null
}

function dbZuEintrag(row: WatchlistDbZeile): MomentumWatchlistEintrag {
  return {
    isin: row.isin,
    name: row.name,
    symbolYahoo: row.symbol_yahoo,
    symbolCandidates: Array.isArray(row.symbol_candidates) ? row.symbol_candidates : [],
    hinzugefuegtAm: row.hinzugefuegt_am,
    earningsSyncAm: row.earnings_sync_am,
  }
}

export function istGueltigeMomentumIsin(isin: string): boolean {
  return ISIN_RE.test(isin.trim().toUpperCase())
}

export async function ladeMomentumWatchlist(sb: SupabaseClient): Promise<MomentumWatchlistEintrag[]> {
  const { data, error } = await sb
    .from(TABLE)
    .select('*')
    .order('hinzugefuegt_am', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => dbZuEintrag(r as WatchlistDbZeile))
}

export async function fuegeZurMomentumWatchlist(
  sb: SupabaseClient,
  eintrag: {
    isin: string
    name: string
    symbolYahoo: string | null
    symbolCandidates: string[]
  },
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const isin = eintrag.isin.trim().toUpperCase()
  if (!istGueltigeMomentumIsin(isin)) {
    return { ok: false, fehler: 'Ungültige ISIN.' }
  }

  const { count, error: countErr } = await sb
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
  if (countErr) return { ok: false, fehler: countErr.message }
  if ((count ?? 0) >= MOMENTUM_WATCHLIST_MAX) {
    return {
      ok: false,
      fehler: 'Watchlist voll (max. ' + MOMENTUM_WATCHLIST_MAX + ' Titel).',
    }
  }

  const { error } = await sb.from(TABLE).upsert(
    {
      isin,
      name: eintrag.name.trim() || isin,
      symbol_yahoo: eintrag.symbolYahoo?.trim().toUpperCase() || null,
      symbol_candidates: eintrag.symbolCandidates.map((s) => s.trim().toUpperCase()).filter(Boolean),
    },
    { onConflict: 'owner_user_id,isin' },
  )
  if (error) return { ok: false, fehler: error.message }
  return { ok: true }
}

export async function entferneAusMomentumWatchlist(sb: SupabaseClient, isin: string): Promise<void> {
  const isinNorm = isin.trim().toUpperCase()
  const { error } = await sb.from(TABLE).delete().eq('isin', isinNorm)
  if (error) throw new Error(error.message)
}

export async function setzeMomentumWatchlistEarningsSync(sb: SupabaseClient, isin: string): Promise<void> {
  const { error } = await sb
    .from(TABLE)
    .update({ earnings_sync_am: new Date().toISOString() })
    .eq('isin', isin.trim().toUpperCase())
  if (error) throw new Error(error.message)
}

/** Yahoo-Symbole aus der Watchlist (+ Kandidaten), ohne Duplikate. */
export function symboleAusWatchlist(eintraege: MomentumWatchlistEintrag[]): string[] {
  const out: string[] = []
  const add = (s: string | null | undefined) => {
    const sym = s?.trim().toUpperCase()
    if (sym && !out.includes(sym)) out.push(sym)
  }
  for (const e of eintraege) {
    add(e.symbolYahoo)
    for (const c of e.symbolCandidates) add(c)
  }
  return out
}

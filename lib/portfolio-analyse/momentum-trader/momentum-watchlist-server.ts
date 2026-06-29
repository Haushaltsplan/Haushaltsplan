import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { ladeFinnhubIpoDatum } from '@/lib/portfolio-analyse/momentum-trader/momentum-finnhub-ipo-server'
import type { MomentumWatchlistEintrag } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

export const MOMENTUM_WATCHLIST_MAX = 32

const TABLE = 'momentum_watchlist' as const
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/

type WatchlistDbZeile = {
  owner_user_id?: string
  isin: string
  name: string
  symbol_yahoo: string | null
  symbol_candidates: string[] | null
  hinzugefuegt_am: string
  earnings_sync_am: string | null
  ipo_datum: string | null
  ipo_sync_am: string | null
}

function dbZuEintrag(row: WatchlistDbZeile): MomentumWatchlistEintrag {
  return {
    isin: row.isin,
    name: row.name,
    symbolYahoo: row.symbol_yahoo,
    symbolCandidates: Array.isArray(row.symbol_candidates) ? row.symbol_candidates : [],
    hinzugefuegtAm: row.hinzugefuegt_am,
    earningsSyncAm: row.earnings_sync_am,
    ipoDatum: row.ipo_datum?.slice(0, 10) ?? null,
    ipoSyncAm: row.ipo_sync_am,
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

/** IPO-Datum aus Finnhub laden und in Watchlist speichern. */
export async function syncIpoDatumFuerWatchlist(
  sb: SupabaseClient,
  eintraege: MomentumWatchlistEintrag[],
): Promise<{ aktualisiert: number; fehler: string[] }> {
  const fehler: string[] = []
  let aktualisiert = 0

  for (const e of eintraege) {
    const symbol = e.symbolYahoo?.trim().toUpperCase() || e.symbolCandidates[0]?.trim().toUpperCase()
    if (!symbol) continue
    if (e.ipoDatum) continue

    try {
      const ipo = await ladeFinnhubIpoDatum(symbol)
      if (!ipo) continue
      const { error } = await sb
        .from(TABLE)
        .update({ ipo_datum: ipo, ipo_sync_am: new Date().toISOString() })
        .eq('isin', e.isin)
      if (error) fehler.push(e.isin + ': ' + error.message)
      else aktualisiert++
    } catch (err) {
      fehler.push(e.isin + ': ' + String(err))
    }
  }

  return { aktualisiert, fehler }
}

/** Alle Watchlists gruppiert nach owner_user_id (Cron / Admin). */
export async function ladeAlleMomentumWatchlistenGruppiert(): Promise<
  Map<string, MomentumWatchlistEintrag[]>
> {
  const { data, error } = await createSupabaseAdmin().from(TABLE).select('*')
  if (error) throw new Error(error.message)

  const gruppen = new Map<string, MomentumWatchlistEintrag[]>()
  for (const row of data ?? []) {
    const r = row as WatchlistDbZeile
    const uid = r.owner_user_id ?? 'unknown'
    const liste = gruppen.get(uid) ?? []
    liste.push(dbZuEintrag(r))
    gruppen.set(uid, liste)
  }
  return gruppen
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

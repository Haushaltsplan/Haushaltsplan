import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { ladeMomentumIpoDatum } from '@/lib/portfolio-analyse/momentum-trader/momentum-ipo-server'
import {
  momentumBarsSymboleAusWatchlist,
  normalisiereMomentumWatchlistSymbole,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-symbol-hilfen'
import {
  istMomentumListedPlatzhalterIsin,
  istMomentumPreIpoEintrag,
  istMomentumPseudoIsin,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-pseudo-isin'
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
  notiz: string | null
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
    notiz: row.notiz,
  }
}

export function istGueltigeMomentumIsin(isin: string): boolean {
  const n = isin.trim().toUpperCase()
  return ISIN_RE.test(n)
}

/** Echte ISIN, Pre-IPO (XP) oder gelisteter Platzhalter (XL). */
export function istGueltigeMomentumWatchlistIsin(isin: string): boolean {
  const n = isin.trim().toUpperCase()
  return istGueltigeMomentumIsin(n) || istMomentumPseudoIsin(n) || istMomentumListedPlatzhalterIsin(n)
}

export async function repariereWatchlistSymbolKandidaten(
  sb: SupabaseClient,
  eintraege: MomentumWatchlistEintrag[],
): Promise<number> {
  let aktualisiert = 0
  for (const e of eintraege) {
    const norm = normalisiereMomentumWatchlistSymbole({
      symbolYahoo: e.symbolYahoo,
      symbolCandidates: e.symbolCandidates,
    })
    const alt = [...e.symbolCandidates].sort().join(',')
    const neu = [...norm.symbolCandidates].sort().join(',')
    if (alt === neu && e.symbolYahoo === norm.symbolYahoo) continue

    const { error } = await sb
      .from(TABLE)
      .update({
        symbol_yahoo: norm.symbolYahoo,
        symbol_candidates: norm.symbolCandidates,
      })
      .eq('isin', e.isin)
    if (!error) aktualisiert++
  }
  return aktualisiert
}

export async function ladeMomentumWatchlist(sb: SupabaseClient): Promise<MomentumWatchlistEintrag[]> {
  const { data, error } = await sb
    .from(TABLE)
    .select('*')
    .order('hinzugefuegt_am', { ascending: false })
  if (error) throw new Error(error.message)
  const eintraege = (data ?? []).map((r) => dbZuEintrag(r as WatchlistDbZeile))
  return repariereFalschKlassifizierteWatchlistEintraege(sb, eintraege)
}

/** XP-ISIN + Börsenticker = fälschlich als Pre-IPO gespeichert (z. B. Accenture). */
async function repariereFalschKlassifizierteWatchlistEintraege(
  sb: SupabaseClient,
  eintraege: MomentumWatchlistEintrag[],
): Promise<MomentumWatchlistEintrag[]> {
  const zuReparieren = eintraege.filter((e) => istMomentumPseudoIsin(e.isin) && e.symbolYahoo?.trim())
  if (zuReparieren.length === 0) return eintraege

  const { loeseIsinFuerTicker } = await import('@/lib/portfolio-analyse/ticker-isin-aufloesung-server')
  const { erzeugeMomentumListedIsin } = await import(
    '@/lib/portfolio-analyse/momentum-trader/momentum-pseudo-isin'
  )

  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return eintraege

  const ersetzt = new Map<string, MomentumWatchlistEintrag>()

  for (const e of zuReparieren) {
    const sym = e.symbolYahoo!.trim().toUpperCase()
    const echteIsin = await loeseIsinFuerTicker(sym)
    const neueIsin =
      echteIsin && ISIN_RE.test(echteIsin.toUpperCase())
        ? echteIsin.toUpperCase()
        : erzeugeMomentumListedIsin(sym)

    if (neueIsin === e.isin) continue

    const { data: dup } = await sb.from(TABLE).select('isin').eq('isin', neueIsin).maybeSingle()
    if (dup) {
      await sb.from(TABLE).delete().eq('isin', e.isin)
      ersetzt.set(e.isin, { ...e, isin: neueIsin, ipoDatum: null, ipoSyncAm: null })
      continue
    }

    const { error: insErr } = await sb.from(TABLE).insert({
      owner_user_id: user.id,
      isin: neueIsin,
      name: e.name,
      symbol_yahoo: e.symbolYahoo,
      symbol_candidates: e.symbolCandidates,
      hinzugefuegt_am: e.hinzugefuegtAm,
      earnings_sync_am: e.earningsSyncAm,
      ipo_datum: null,
      ipo_sync_am: null,
      notiz: e.notiz,
    })
    if (insErr) continue

    await sb.from(TABLE).delete().eq('isin', e.isin)
    ersetzt.set(e.isin, { ...e, isin: neueIsin, ipoDatum: null, ipoSyncAm: null })
  }

  if (ersetzt.size === 0) return eintraege
  const entfernteAlte = new Set(ersetzt.keys())
  return [...eintraege.filter((e) => !entfernteAlte.has(e.isin)), ...ersetzt.values()].sort((a, b) =>
    b.hinzugefuegtAm.localeCompare(a.hinzugefuegtAm),
  )
}

export async function fuegeZurMomentumWatchlist(
  sb: SupabaseClient,
  eintrag: {
    isin: string
    name: string
    symbolYahoo: string | null
    symbolCandidates: string[]
    ipoDatum?: string | null
    notiz?: string | null
  },
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const isin = eintrag.isin.trim().toUpperCase()
  if (!istGueltigeMomentumWatchlistIsin(isin)) {
    return { ok: false, fehler: 'Ungültige ISIN.' }
  }

  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser()
  if (userErr || !user) {
    return { ok: false, fehler: 'Nicht angemeldet.' }
  }

  const symNorm = normalisiereMomentumWatchlistSymbole({
    symbolYahoo: eintrag.symbolYahoo,
    symbolCandidates: eintrag.symbolCandidates,
  })

  const { count, error: countErr } = await sb
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
  if (countErr) return { ok: false, fehler: countErr.message }

  const { data: vorhanden } = await sb.from(TABLE).select('isin').eq('isin', isin).maybeSingle()
  if (!vorhanden && (count ?? 0) >= MOMENTUM_WATCHLIST_MAX) {
    return {
      ok: false,
      fehler: 'Watchlist voll (max. ' + MOMENTUM_WATCHLIST_MAX + ' Titel).',
    }
  }

  const { error } = await sb.from(TABLE).upsert(
    {
      owner_user_id: user.id,
      isin,
      name: eintrag.name.trim() || isin,
      symbol_yahoo: symNorm.symbolYahoo?.trim().toUpperCase() || null,
      symbol_candidates: symNorm.symbolCandidates.map((s) => s.trim().toUpperCase()).filter(Boolean),
      ...(eintrag.ipoDatum ? { ipo_datum: eintrag.ipoDatum.slice(0, 10), ipo_sync_am: new Date().toISOString() } : {}),
      ...(eintrag.notiz ? { notiz: eintrag.notiz.trim() } : {}),
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

/** IPO-Datum scrapen (MarketBeat → Yahoo) und in Watchlist speichern. */
export async function syncIpoDatumFuerWatchlist(
  sb: SupabaseClient,
  eintraege: MomentumWatchlistEintrag[],
): Promise<{ aktualisiert: number; fehler: string[] }> {
  const fehler: string[] = []
  let aktualisiert = 0

  for (const e of eintraege) {
    if (!istMomentumPreIpoEintrag(e)) continue
    const symbol = e.symbolYahoo?.trim().toUpperCase() || e.symbolCandidates[0]?.trim().toUpperCase()
    if (!symbol) continue
    if (e.ipoDatum) continue

    try {
      const ipo = await ladeMomentumIpoDatum(symbol, e.symbolYahoo)
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

/** IPO-Datum und/oder Notiz aktualisieren. */
export async function aktualisiereMomentumWatchlistMeta(
  sb: SupabaseClient,
  isin: string,
  meta: { ipoDatum?: string | null; notiz?: string | null },
): Promise<void> {
  const isinNorm = isin.trim().toUpperCase()
  const patch: Record<string, string | null> = {}

  if ('ipoDatum' in meta) {
    const d = meta.ipoDatum?.trim().slice(0, 10) ?? null
    if (d != null && !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      throw new Error('ipoDatum muss YYYY-MM-DD sein.')
    }
    patch.ipo_datum = d
    if (d) patch.ipo_sync_am = new Date().toISOString()
  }
  if ('notiz' in meta) {
    patch.notiz = meta.notiz?.trim() || null
  }

  if (Object.keys(patch).length === 0) return

  const { error } = await sb.from(TABLE).update(patch).eq('isin', isinNorm)
  if (error) throw new Error(error.message)
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

/** Yahoo-Symbole aus der Watchlist (+ US-Basis bei EU-Tickern). */
export function symboleAusWatchlist(eintraege: MomentumWatchlistEintrag[]): string[] {
  return momentumBarsSymboleAusWatchlist(eintraege)
}

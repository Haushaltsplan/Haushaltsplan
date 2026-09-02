/**
 * Nachkauf-Radar — Watchlist-Kandidaten aus Supabase.
 *
 * Die Portfolioanalyse-Watchlist lebt im Browser (localStorage) und wird von der
 * Watchlist-Seite automatisch in die Tabelle `nachkauf_radar_watchlist` gespiegelt.
 * Der Radar (Scan, Deep Research, Kaufempfehlung — auch Cron) liest sie hier und
 * behandelt die Titel als zusätzliche Kandidaten neben der festen Whitelist.
 */

import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { istPortfolioGastKontext, requireOwnerUserId } from '@/lib/request-owner'
import { ladeDepotRadarAktien } from '@/lib/portfolio-analyse/depot-gewichte-server'
import { NACHKAUF_RADAR_WHITELIST, type WhitelistPosition } from './nachkauf-radar-whitelist'

const TABLE_WATCHLIST = 'nachkauf_radar_watchlist' as const

export type NachkaufWatchlistEintrag = {
  isin: string
  name: string
  symbolYahoo: string | null
  symbolCandidates: string[]
  hinzugefuegtAm: string
}

function istKonfiguriert(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

export async function ladeNachkaufWatchlistAusCloud(): Promise<NachkaufWatchlistEintrag[]> {
  if (!istKonfiguriert()) return []
  try {
    const { data, error } = await createSupabaseAdmin()
      .from(TABLE_WATCHLIST)
      .select('isin, name, symbol_yahoo, symbol_candidates, hinzugefuegt_am')
      .eq('owner_user_id', requireOwnerUserId())
      .order('hinzugefuegt_am', { ascending: false })
    if (error) {
      console.warn('[nachkauf-watchlist] Laden:', error.message)
      return []
    }
    return (data ?? []).map((r) => {
      const row = r as {
        isin: string
        name: string
        symbol_yahoo: string | null
        symbol_candidates: unknown
        hinzugefuegt_am: string
      }
      return {
        isin: row.isin,
        name: row.name,
        symbolYahoo: row.symbol_yahoo,
        symbolCandidates: Array.isArray(row.symbol_candidates)
          ? row.symbol_candidates.filter((s): s is string => typeof s === 'string')
          : [],
        hinzugefuegtAm: row.hinzugefuegt_am,
      }
    })
  } catch (e) {
    console.warn('[nachkauf-watchlist] Laden fehlgeschlagen:', e)
    return []
  }
}

/**
 * Spiegelt die komplette Browser-Watchlist in die Cloud (Vollabgleich):
 * Einträge upserten, nicht mehr vorhandene löschen.
 */
export async function syncNachkaufWatchlistZurCloud(
  eintraege: NachkaufWatchlistEintrag[],
): Promise<{ ok: boolean; fehler?: string }> {
  if (!istKonfiguriert()) return { ok: false, fehler: 'Supabase nicht konfiguriert.' }
  const admin = createSupabaseAdmin()
  const ownerUserId = requireOwnerUserId()
  const gueltig = eintraege.filter((e) => /^[A-Z]{2}[A-Z0-9]{10}$/.test(e.isin))

  try {
    if (gueltig.length > 0) {
      const { error } = await admin.from(TABLE_WATCHLIST).upsert(
        gueltig.map((e) => ({
          owner_user_id: ownerUserId,
          isin: e.isin,
          name: e.name,
          symbol_yahoo: e.symbolYahoo,
          symbol_candidates: e.symbolCandidates,
          hinzugefuegt_am: e.hinzugefuegtAm,
          aktualisiert_am: new Date().toISOString(),
        })),
        { onConflict: 'owner_user_id,isin' },
      )
      if (error) return { ok: false, fehler: error.message }
    }

    // Nicht mehr vorhandene Einträge entfernen (nur dieses Konto)
    const behalten = new Set(gueltig.map((e) => e.isin))
    const { data: vorhandene, error: leseFehler } = await admin
      .from(TABLE_WATCHLIST)
      .select('isin')
      .eq('owner_user_id', ownerUserId)
    if (!leseFehler) {
      const zuLoeschen = (vorhandene ?? [])
        .map((r) => (r as { isin: string }).isin)
        .filter((isin) => !behalten.has(isin))
      if (zuLoeschen.length > 0) {
        await admin.from(TABLE_WATCHLIST).delete().eq('owner_user_id', ownerUserId).in('isin', zuLoeschen)
        const depot = await ladeDepotRadarAktien().catch(() => [])
        const depotIsins = new Set(depot.map((d) => d.isin.toUpperCase()))
        const whitelistIsins = new Set(NACHKAUF_RADAR_WHITELIST.map((p) => p.isin.toUpperCase()))
        const schuetzen = istPortfolioGastKontext() ? depotIsins : whitelistIsins
        const scanZuLoeschen = zuLoeschen.filter((isin) => !schuetzen.has(isin.toUpperCase()))
        if (scanZuLoeschen.length > 0) {
          await admin
            .from('nachkauf_radar_scan')
            .delete()
            .eq('owner_user_id', ownerUserId)
            .in('isin', scanZuLoeschen)
        }
      }
    }

    return { ok: true }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : String(e) }
  }
}

function kandidatAusTitel(opts: {
  isin: string
  name: string
  symbolYahoo?: string | null
  symbolCandidates?: string[]
  quelle: 'depot' | 'watchlist'
}): WhitelistPosition {
  const isin = opts.isin.trim().toUpperCase()
  const wl = NACHKAUF_RADAR_WHITELIST.find((p) => p.isin.toUpperCase() === isin)
  if (wl) {
    return {
      ...wl,
      quelle: opts.quelle,
      symbolYahoo: opts.symbolYahoo ?? wl.symbolYahoo,
      symbolCandidates: opts.symbolCandidates?.length ? opts.symbolCandidates : wl.symbolCandidates,
    }
  }
  return {
    isin,
    name: opts.name,
    quelle: opts.quelle,
    symbolYahoo: opts.symbolYahoo ?? null,
    symbolCandidates: opts.symbolCandidates ?? [],
    risikoKlasse: opts.quelle === 'depot' ? 'moderat' : 'spekulativ',
  }
}

/**
 * Effektive Radar-Kandidaten.
 * Eigentümer: feste Whitelist + eigene Watchlist.
 * Portfolio-Gast: nur eigenes Depot + eigene Watchlist (keine fremde 32er-Liste).
 */
export async function ladeNachkaufKandidaten(): Promise<WhitelistPosition[]> {
  const watchlist = await ladeNachkaufWatchlistAusCloud()
  const gast = istPortfolioGastKontext()

  if (gast) {
    const depot = await ladeDepotRadarAktien().catch(() => [])
    const byIsin = new Map<string, WhitelistPosition>()
    for (const d of depot) {
      byIsin.set(
        d.isin.toUpperCase(),
        kandidatAusTitel({
          isin: d.isin,
          name: d.name,
          symbolYahoo: d.symbolYahoo,
          symbolCandidates: d.symbolCandidates,
          quelle: 'depot',
        }),
      )
    }
    for (const w of watchlist) {
      const key = w.isin.toUpperCase()
      if (byIsin.has(key)) continue
      byIsin.set(
        key,
        kandidatAusTitel({
          isin: w.isin,
          name: w.name,
          symbolYahoo: w.symbolYahoo,
          symbolCandidates: w.symbolCandidates,
          quelle: 'watchlist',
        }),
      )
    }
    return [...byIsin.values()]
  }

  const whitelist: WhitelistPosition[] = NACHKAUF_RADAR_WHITELIST.map((p) => ({
    ...p,
    quelle: 'whitelist' as const,
  }))

  if (watchlist.length === 0) return whitelist

  const bekannteIsins = new Set(whitelist.map((p) => p.isin.toUpperCase()))
  const zusatz: WhitelistPosition[] = watchlist
    .filter((w) => !bekannteIsins.has(w.isin.toUpperCase()))
    .map((w) =>
      kandidatAusTitel({
        isin: w.isin,
        name: w.name,
        symbolYahoo: w.symbolYahoo,
        symbolCandidates: w.symbolCandidates,
        quelle: 'watchlist',
      }),
    )

  return [...whitelist, ...zusatz]
}

/** Gäste sehen nur Titel aus ihrem aktuellen Depot + Watchlist — keine Alt-Scans. */
export function filtereGastScanAufKandidaten<T extends { isin: string }>(
  eintraege: T[],
  kandidaten: { isin: string }[],
): T[] {
  if (!istPortfolioGastKontext()) return eintraege
  const keep = new Set(kandidaten.map((p) => p.isin.toUpperCase()))
  return eintraege.filter((e) => keep.has((e.isin ?? '').trim().toUpperCase()))
}

export function behalteGastKandidatenInPlace<T extends { isin: string }>(
  eintraege: T[],
  kandidaten: { isin: string }[],
): void {
  if (!istPortfolioGastKontext()) return
  const keep = new Set(kandidaten.map((p) => p.isin.toUpperCase()))
  for (let i = eintraege.length - 1; i >= 0; i--) {
    if (!keep.has((eintraege[i]!.isin ?? '').trim().toUpperCase())) eintraege.splice(i, 1)
  }
}

export function setzeKandidatenQuelle(
  eintraege: { isin: string; kandidatenQuelle?: WhitelistPosition['quelle'] | null }[],
  kandidaten: WhitelistPosition[],
): void {
  const map = new Map(kandidaten.map((p) => [p.isin.toUpperCase(), p.quelle ?? 'whitelist'] as const))
  for (const e of eintraege) {
    const q = map.get((e.isin ?? '').toUpperCase())
    if (q) e.kandidatenQuelle = q
  }
}

/**
 * Nachkauf-Radar — Kandidaten-Universum: Whitelist ∪ aktuelles Depot ∪ Watchlist.
 *
 * Die Portfolioanalyse-Watchlist lebt im Browser (localStorage) und wird von der
 * Watchlist-Seite automatisch in die Tabelle `nachkauf_radar_watchlist` gespiegelt.
 * Entfernte Watchlist-Titel und verkaufte Depot-Positionen werden nicht mehr
 * gescannt und aus Scan-/Deep-Research-Zeilen bereinigt (Whitelist bleibt geschützt).
 */

import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { istPortfolioGastKontext, requireOwnerUserId } from '@/lib/request-owner'
import { ladeDepotRadarAktien } from '@/lib/portfolio-analyse/depot-gewichte-server'
import { NACHKAUF_RADAR_WHITELIST, type WhitelistPosition } from './nachkauf-radar-whitelist'

const TABLE_WATCHLIST = 'nachkauf_radar_watchlist' as const
const TABLE_SCAN = 'nachkauf_radar_scan' as const
const TABLE_DEEP = 'nachkauf_radar_deep_research' as const

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

/** ISINs, deren Scan-Zeilen beim Watchlist-Entfernen erhalten bleiben. */
async function geschuetzteRadarIsins(): Promise<Set<string>> {
  const depot = await ladeDepotRadarAktien().catch(() => [])
  const depotIsins = depot.map((d) => d.isin.toUpperCase())
  if (istPortfolioGastKontext()) return new Set(depotIsins)
  return new Set([
    ...NACHKAUF_RADAR_WHITELIST.map((p) => p.isin.toUpperCase()),
    ...depotIsins,
  ])
}

/**
 * Spiegelt die komplette Browser-Watchlist in die Cloud (Vollabgleich):
 * Einträge upserten, nicht mehr vorhandene löschen.
 * Scan/Deep-Research nur löschen, wenn Titel weder Whitelist noch Depot ist.
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
        const schuetzen = await geschuetzteRadarIsins()
        const radarZuLoeschen = zuLoeschen.filter((isin) => !schuetzen.has(isin.toUpperCase()))
        if (radarZuLoeschen.length > 0) {
          await Promise.all([
            admin.from(TABLE_SCAN).delete().eq('owner_user_id', ownerUserId).in('isin', radarZuLoeschen),
            admin.from(TABLE_DEEP).delete().eq('owner_user_id', ownerUserId).in('isin', radarZuLoeschen),
          ])
        }
      }
    }

    // Verkauft / nicht mehr im Universum → Alt-Scans entfernen (Whitelist ∪ Depot ∪ Watchlist)
    const kandidaten = await ladeNachkaufKandidaten()
    await bereinigeNachkaufRadarAusserhalbKandidaten(kandidaten)

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
 * Effektive Radar-Kandidaten — immer abgestimmt auf aktuelles Depot + Watchlist.
 * Eigentümer: feste Whitelist ∪ Depot ∪ Watchlist.
 * Portfolio-Gast: Depot ∪ Watchlist (keine 32er-Whitelist).
 * Priorität der Quelle: whitelist > depot > watchlist.
 */
export async function ladeNachkaufKandidaten(): Promise<WhitelistPosition[]> {
  const [watchlist, depot] = await Promise.all([
    ladeNachkaufWatchlistAusCloud(),
    ladeDepotRadarAktien().catch(() => []),
  ])
  const gast = istPortfolioGastKontext()
  const byIsin = new Map<string, WhitelistPosition>()

  if (!gast) {
    for (const p of NACHKAUF_RADAR_WHITELIST) {
      byIsin.set(p.isin.toUpperCase(), { ...p, quelle: 'whitelist' })
    }
  }

  for (const d of depot) {
    const key = d.isin.toUpperCase()
    if (byIsin.has(key)) continue
    byIsin.set(
      key,
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

/**
 * Löscht Scan- und Deep-Research-Zeilen, deren ISIN nicht mehr im Kandidaten-Universum liegt.
 * Whitelist-/Depot-/Watchlist-Titel bleiben. Rückgabe = Anzahl gelöschter Scan-ISINs.
 */
export async function bereinigeNachkaufRadarAusserhalbKandidaten(
  kandidaten: { isin: string }[],
): Promise<number> {
  if (!istKonfiguriert()) return 0
  const keep = new Set(kandidaten.map((p) => p.isin.trim().toUpperCase()).filter(Boolean))
  if (keep.size === 0) return 0
  try {
    const admin = createSupabaseAdmin()
    const ownerUserId = requireOwnerUserId()
    const { data: scanRows, error } = await admin
      .from(TABLE_SCAN)
      .select('isin')
      .eq('owner_user_id', ownerUserId)
    if (error) {
      console.warn('[nachkauf-watchlist] Scan-Bereinigung lesen:', error.message)
      return 0
    }
    const orphans = [
      ...new Set(
        (scanRows ?? [])
          .map((r) => ((r as { isin?: string }).isin ?? '').trim().toUpperCase())
          .filter((isin) => isin && !keep.has(isin)),
      ),
    ]
    if (orphans.length === 0) return 0
    await Promise.all([
      admin.from(TABLE_SCAN).delete().eq('owner_user_id', ownerUserId).in('isin', orphans),
      admin.from(TABLE_DEEP).delete().eq('owner_user_id', ownerUserId).in('isin', orphans),
    ])
    console.info(`[nachkauf-watchlist] ${orphans.length} Radar-Titel außerhalb Universum entfernt`)
    return orphans.length
  } catch (e) {
    console.warn('[nachkauf-watchlist] Scan-Bereinigung fehlgeschlagen:', e)
    return 0
  }
}

/** Nur Titel aus dem aktuellen Universum (Whitelist ∪ Depot ∪ Watchlist) — keine Alt-Scans. */
export function filtereGastScanAufKandidaten<T extends { isin: string }>(
  eintraege: T[],
  kandidaten: { isin: string }[],
): T[] {
  const keep = new Set(kandidaten.map((p) => p.isin.toUpperCase()))
  return eintraege.filter((e) => keep.has((e.isin ?? '').trim().toUpperCase()))
}

export function behalteGastKandidatenInPlace<T extends { isin: string }>(
  eintraege: T[],
  kandidaten: { isin: string }[],
): void {
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

/**
 * Nachkauf-Radar — Kandidaten-Universum: nur aktuelles Depot ∪ Watchlist.
 *
 * Die Portfolioanalyse-Watchlist lebt im Browser (localStorage) und wird von der
 * Watchlist-Seite automatisch in die Tabelle `nachkauf_radar_watchlist` gespiegelt.
 * Verkaufte / von der Watchlist entfernte Titel werden nicht gescannt und aus
 * Scan-/Deep-Research-Zeilen bereinigt. Die alte 32er-Whitelist ist kein Universum mehr.
 */

import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { requireOwnerUserId } from '@/lib/request-owner'
import { ladeDepotRadarAktien } from '@/lib/portfolio-analyse/depot-gewichte-server'
import { ladeClientStateAusCloud } from '@/lib/client-state/client-state-server'
import { loeseIsinFuerTicker } from '@/lib/portfolio-analyse/ticker-isin-aufloesung-server'
import { isinAusYahooSymbol, loesePortfolioIsin } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { NACHKAUF_RADAR_WHITELIST, type WhitelistPosition } from './nachkauf-radar-whitelist'

const TABLE_WATCHLIST = 'nachkauf_radar_watchlist' as const
const TABLE_SCAN = 'nachkauf_radar_scan' as const
const TABLE_DEEP = 'nachkauf_radar_deep_research' as const
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/

export type NachkaufWatchlistEintrag = {
  isin: string
  name: string
  symbolYahoo: string | null
  symbolCandidates: string[]
  hinzugefuegtAm: string
}

/** Roh-Eintrag vor ISIN-Auflösung (Client-State / Sync). */
export type WatchlistRohEintrag = {
  isin?: string | null
  name: string
  symbolYahoo?: string | null
  symbolCandidates?: string[]
  hinzugefuegtAm?: string
}

function istKonfiguriert(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

/** Fehlende ISINs über Kenntnisse / Finnhub / DivvyDiary nachziehen. */
export async function anreichereWatchlistIsins(
  roh: WatchlistRohEintrag[],
): Promise<NachkaufWatchlistEintrag[]> {
  const out: NachkaufWatchlistEintrag[] = []
  const gesehen = new Set<string>()
  for (const e of roh) {
    const name = e.name?.trim()
    if (!name) continue
    let isin = (e.isin ?? '').trim().toUpperCase()
    if (!ISIN_RE.test(isin)) {
      isin =
        loesePortfolioIsin({
          isin: e.isin,
          symbolYahoo: e.symbolYahoo,
          ticker: e.symbolYahoo,
          firmenname: name,
        }) ??
        isinAusYahooSymbol(e.symbolYahoo) ??
        ''
    }
    if (!ISIN_RE.test(isin) && e.symbolYahoo?.trim()) {
      isin = (await loeseIsinFuerTicker(e.symbolYahoo.trim())) ?? ''
    }
    if (!ISIN_RE.test(isin)) continue
    if (gesehen.has(isin)) continue
    gesehen.add(isin)
    out.push({
      isin,
      name,
      symbolYahoo: e.symbolYahoo?.trim() || null,
      symbolCandidates: Array.isArray(e.symbolCandidates)
        ? e.symbolCandidates.filter((s): s is string => typeof s === 'string')
        : [],
      hinzugefuegtAm: e.hinzugefuegtAm?.trim() || new Date().toISOString(),
    })
  }
  return out
}

async function ladeWatchlistAusClientState(): Promise<WatchlistRohEintrag[]> {
  if (!istKonfiguriert()) return []
  try {
    const rows = await ladeClientStateAusCloud(requireOwnerUserId())
    const hit = rows.find((r) => r.schluessel === 'watchlist')
    if (!hit) return []
    const payload = hit.payload
    const liste = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as { eintraege?: unknown })?.eintraege)
        ? (payload as { eintraege: unknown[] }).eintraege
        : []
    return liste
      .map((raw) => {
        const r = (raw ?? {}) as Record<string, unknown>
        return {
          isin: r.isin != null ? String(r.isin) : null,
          name: String(r.name ?? '').trim(),
          symbolYahoo: r.symbolYahoo != null ? String(r.symbolYahoo) : null,
          symbolCandidates: Array.isArray(r.symbolCandidates)
            ? r.symbolCandidates.filter((s): s is string => typeof s === 'string')
            : [],
          hinzugefuegtAm: typeof r.hinzugefuegtAm === 'string' ? r.hinzugefuegtAm : undefined,
        }
      })
      .filter((e) => e.name)
  } catch (e) {
    console.warn('[nachkauf-watchlist] Client-State lesen:', e)
    return []
  }
}

/**
 * Effektive Watchlist = Radar-Tabelle ∪ Client-State (mit ISIN-Anreicherung).
 * Viele UI-Einträge hatten nur Ticker ohne ISIN und fehlten deshalb im Radar.
 */
export async function ladeEffektiveNachkaufWatchlist(): Promise<NachkaufWatchlistEintrag[]> {
  const [radar, clientRoh] = await Promise.all([
    ladeNachkaufWatchlistAusCloud(),
    ladeWatchlistAusClientState(),
  ])
  return anreichereWatchlistIsins([
    ...radar.map((e) => ({
      isin: e.isin,
      name: e.name,
      symbolYahoo: e.symbolYahoo,
      symbolCandidates: e.symbolCandidates,
      hinzugefuegtAm: e.hinzugefuegtAm,
    })),
    ...clientRoh,
  ])
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

/** ISINs, deren Scan-Zeilen beim Watchlist-Entfernen erhalten bleiben (nur noch Depot). */
async function geschuetzteRadarIsins(): Promise<Set<string>> {
  const depot = await ladeDepotRadarAktien().catch(() => [])
  return new Set(depot.map((d) => d.isin.toUpperCase()))
}

/**
 * Spiegelt die komplette Browser-Watchlist in die Cloud (Vollabgleich):
 * Einträge upserten, nicht mehr vorhandene löschen.
 * Scan/Deep-Research nur löschen, wenn Titel nicht mehr im Depot liegt.
 */
export async function syncNachkaufWatchlistZurCloud(
  eintraege: Array<NachkaufWatchlistEintrag | WatchlistRohEintrag>,
): Promise<{ ok: boolean; fehler?: string }> {
  if (!istKonfiguriert()) return { ok: false, fehler: 'Supabase nicht konfiguriert.' }
  const admin = createSupabaseAdmin()
  const ownerUserId = requireOwnerUserId()
  const gueltig = await anreichereWatchlistIsins(
    eintraege.map((e) => ({
      isin: 'isin' in e ? e.isin : null,
      name: e.name,
      symbolYahoo: e.symbolYahoo,
      symbolCandidates: e.symbolCandidates,
      hinzugefuegtAm: 'hinzugefuegtAm' in e ? e.hinzugefuegtAm : undefined,
    })),
  )

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
 * Effektive Radar-Kandidaten — nur aktuelles Depot ∪ Watchlist.
 * Priorität: depot > watchlist. Verkaufte / entfernte Titel erscheinen nicht.
 */
export async function ladeNachkaufKandidaten(): Promise<WhitelistPosition[]> {
  const [watchlist, depot] = await Promise.all([
    ladeEffektiveNachkaufWatchlist(),
    ladeDepotRadarAktien().catch(() => []),
  ])
  const byIsin = new Map<string, WhitelistPosition>()

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
 * Nur Depot-/Watchlist-Titel bleiben. Rückgabe = Anzahl gelöschter Scan-ISINs.
 */
export async function bereinigeNachkaufRadarAusserhalbKandidaten(
  kandidaten: { isin: string }[],
): Promise<number> {
  if (!istKonfiguriert()) return 0
  const keep = new Set(kandidaten.map((p) => p.isin.trim().toUpperCase()).filter(Boolean))
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

/** Nur Titel aus dem aktuellen Universum (Depot ∪ Watchlist) — keine Alt-Scans. */
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

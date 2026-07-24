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
  const gueltig = eintraege.filter((e) => /^[A-Z]{2}[A-Z0-9]{10}$/.test(e.isin))

  try {
    if (gueltig.length > 0) {
      const { error } = await admin.from(TABLE_WATCHLIST).upsert(
        gueltig.map((e) => ({
          isin: e.isin,
          name: e.name,
          symbol_yahoo: e.symbolYahoo,
          symbol_candidates: e.symbolCandidates,
          hinzugefuegt_am: e.hinzugefuegtAm,
          aktualisiert_am: new Date().toISOString(),
        })),
        { onConflict: 'isin' },
      )
      if (error) return { ok: false, fehler: error.message }
    }

    // Nicht mehr vorhandene Einträge entfernen
    const behalten = new Set(gueltig.map((e) => e.isin))
    const { data: vorhandene, error: leseFehler } = await admin
      .from(TABLE_WATCHLIST)
      .select('isin')
    if (!leseFehler) {
      const zuLoeschen = (vorhandene ?? [])
        .map((r) => (r as { isin: string }).isin)
        .filter((isin) => !behalten.has(isin))
      if (zuLoeschen.length > 0) {
        await admin.from(TABLE_WATCHLIST).delete().in('isin', zuLoeschen)
        // Scan-Ergebnisse entfernter Watchlist-Titel aufräumen — aber nie Whitelist-Positionen
        const whitelistIsins = new Set(NACHKAUF_RADAR_WHITELIST.map((p) => p.isin.toUpperCase()))
        const scanZuLoeschen = zuLoeschen.filter((isin) => !whitelistIsins.has(isin.toUpperCase()))
        if (scanZuLoeschen.length > 0) {
          await admin.from('nachkauf_radar_scan').delete().in('isin', scanZuLoeschen)
        }
      }
    }

    return { ok: true }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Effektive Radar-Kandidaten: feste Whitelist + Watchlist-Titel aus der Cloud.
 * Watchlist-Kandidaten haben keine kuratierten Kauf-Trigger/Mediane und werden
 * als 'spekulativ' (≤ 100 €/Monat) eingestuft — Neukauf mit härterer Hürde;
 * historische Mediane kommen dann automatisch aus Macrotrends. Duplikate zur Whitelist werden ignoriert.
 */
export async function ladeNachkaufKandidaten(): Promise<WhitelistPosition[]> {
  const whitelist: WhitelistPosition[] = NACHKAUF_RADAR_WHITELIST.map((p) => ({
    ...p,
    quelle: 'whitelist' as const,
  }))

  const watchlist = await ladeNachkaufWatchlistAusCloud()
  if (watchlist.length === 0) return whitelist

  const bekannteIsins = new Set(whitelist.map((p) => p.isin.toUpperCase()))
  const zusatz: WhitelistPosition[] = watchlist
    .filter((w) => !bekannteIsins.has(w.isin.toUpperCase()))
    .map((w) => ({
      isin: w.isin,
      name: w.name,
      quelle: 'watchlist' as const,
      symbolYahoo: w.symbolYahoo,
      symbolCandidates: w.symbolCandidates,
      risikoKlasse: 'spekulativ' as const,
    }))

  return [...whitelist, ...zusatz]
}

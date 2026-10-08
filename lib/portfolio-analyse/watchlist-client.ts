import { lesePersonlichenStorage, schreibePersonlichenStorage } from '@/lib/zugriff-client'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import { isinKenntnis, loesePortfolioIsin } from '@/lib/portfolio-analyse/isin-kenntnisse'

export type WatchlistEintrag = {
  isin: string | null
  name: string
  symbolYahoo: string | null
  symbolCandidates: string[]
  hinzugefuegtAm: string
}

export const WATCHLIST_STORAGE_KEY = 'pa-watchlist-v1'
const LS_KEY = WATCHLIST_STORAGE_KEY
export const WATCHLIST_CHANGED_EVENT = 'omnia-watchlist-changed'
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/

export function istGueltigeIsin(isin: string): boolean {
  return ISIN_RE.test(isin.trim().toUpperCase())
}

export function watchlistSchluessel(e: WatchlistEintrag): string {
  if (e.isin?.trim()) return e.isin.trim().toUpperCase()
  if (e.symbolYahoo?.trim()) return e.symbolYahoo.trim().toUpperCase()
  return e.name.trim().toUpperCase()
}

export function ladeWatchlist(): WatchlistEintrag[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = lesePersonlichenStorage(LS_KEY)
    if (!raw) return []
    const j = JSON.parse(raw) as WatchlistEintrag[]
    if (!Array.isArray(j)) return []
    return j.filter((e) => e.isin?.trim() ? istGueltigeIsin(e.isin) : Boolean(e.symbolYahoo?.trim() || e.name?.trim()))
  } catch {
    return []
  }
}

export function speichereWatchlist(eintraege: WatchlistEintrag[]): void {
  if (typeof window === 'undefined') return
  const angereichert = eintraege.map(anreichereWatchlistIsinLokal)
  try {
    schreibePersonlichenStorage(LS_KEY, JSON.stringify(angereichert))
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(WATCHLIST_CHANGED_EVENT))
  }
  syncWatchlistZurCloud(angereichert)
  void import('@/lib/client-state/client-state-sync').then((m) => {
    m.pushClientState('watchlist', angereichert)
  })
}

export function watchlistEintragAusMeta(m: IsinMetadata, isin: string | null): WatchlistEintrag {
  const isinNorm = isin?.trim().toUpperCase() || (istGueltigeIsin(m.isin) ? m.isin.trim().toUpperCase() : null)
  const k = isinNorm ? isinKenntnis(isinNorm) : null
  return {
    isin: isinNorm,
    name: k?.name ?? m.name,
    symbolYahoo: k?.symbolYahoo ?? m.symbolYahoo,
    symbolCandidates:
      k?.symbolCandidates ??
      (m.symbolCandidates?.length ? m.symbolCandidates : m.symbolYahoo ? [m.symbolYahoo] : []),
    hinzugefuegtAm: new Date().toISOString(),
  }
}

export function findeWatchlistIdx(
  eintraege: WatchlistEintrag[],
  opts: { isin?: string | null; symbol?: string | null },
): number {
  const isin = opts.isin?.trim().toUpperCase()
  if (isin) {
    const idx = eintraege.findIndex((e) => e.isin?.trim().toUpperCase() === isin)
    if (idx >= 0) return idx
  }
  const symbol = opts.symbol?.trim().toUpperCase()
  if (symbol) {
    return eintraege.findIndex((e) => e.symbolYahoo?.trim().toUpperCase() === symbol)
  }
  return -1
}

export function entferneAusWatchlist(schluessel: string): WatchlistEintrag[] {
  const norm = schluessel.trim().toUpperCase()
  const next = ladeWatchlist().filter((e) => watchlistSchluessel(e) !== norm)
  speichereWatchlist(next)
  return next
}

export function fuegeZurWatchlistHinzu(eintrag: WatchlistEintrag): WatchlistEintrag[] {
  const key = watchlistSchluessel(eintrag)
  const bestehend = ladeWatchlist().filter((e) => watchlistSchluessel(e) !== key)
  const next = [anreichereWatchlistIsinLokal(eintrag), ...bestehend]
  speichereWatchlist(next)
  return next
}

/**
 * Watchlist-Add mit ISIN-Auflösung (Screener/Ticker ohne ISIN) + Cloud-Sync.
 * Bevorzugt nutzen, wenn der Eintrag noch keine ISIN hat.
 */
export async function fuegeZurWatchlistHinzuAsync(eintrag: WatchlistEintrag): Promise<WatchlistEintrag[]> {
  let e = anreichereWatchlistIsinLokal(eintrag)
  if ((!e.isin || !istGueltigeIsin(e.isin)) && e.symbolYahoo?.trim()) {
    try {
      const res = await fetch('/api/portfolio-analyse/ticker-isin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: e.symbolYahoo }),
      })
      const j = (await res.json()) as {
        ok?: boolean
        isin?: string | null
        name?: string | null
        symbolYahoo?: string | null
        symbolCandidates?: string[]
      }
      if (j.ok && j.isin && istGueltigeIsin(j.isin)) {
        e = {
          ...e,
          isin: j.isin,
          name: j.name?.trim() || e.name,
          symbolYahoo: j.symbolYahoo || e.symbolYahoo,
          symbolCandidates: j.symbolCandidates?.length ? j.symbolCandidates : e.symbolCandidates,
        }
      }
    } catch {
      /* Sync versucht Server-seitig nochmal */
    }
  }
  const next = fuegeZurWatchlistHinzu(e)
  await syncWatchlistZurCloudAwait(next)
  return next
}

// ---------------------------------------------------------------------------
// Cloud-Sync (Nachkauf-Radar): Watchlist nach Supabase spiegeln,
// damit Scan/Deep Research/Kaufempfehlung (auch Cron) die Titel kennen.
// ---------------------------------------------------------------------------

/** ISIN nachziehen (Kenntnisse), damit Radar/Scrape nicht nur 4/12 Titel sieht. */
export function anreichereWatchlistIsinLokal(e: WatchlistEintrag): WatchlistEintrag {
  if (e.isin && istGueltigeIsin(e.isin)) return e
  const isin = loesePortfolioIsin({
    isin: e.isin,
    symbolYahoo: e.symbolYahoo,
    ticker: e.symbolYahoo,
    firmenname: e.name,
  })
  return isin && istGueltigeIsin(isin) ? { ...e, isin } : e
}

/** Spiegelt die Watchlist fire-and-forget in die Cloud (ISIN wo möglich angereichert). */
export function syncWatchlistZurCloud(eintraege: WatchlistEintrag[]): void {
  if (typeof window === 'undefined') return
  void syncWatchlistZurCloudAwait(eintraege)
}

/** Awaitable Sync — nach Erfolg Universum/Radar nachziehen. */
export async function syncWatchlistZurCloudAwait(
  eintraege: WatchlistEintrag[],
): Promise<{ ok: boolean; anzahl?: number; fehler?: string }> {
  if (typeof window === 'undefined') return { ok: false, fehler: 'Nur im Browser.' }
  const payload = eintraege
    .map(anreichereWatchlistIsinLokal)
    .filter((e) => e.name?.trim() && (e.isin || e.symbolYahoo))
  try {
    const res = await fetch('/api/portfolio-analyse/watchlist-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eintraege: payload }),
    })
    const j = (await res.json()) as { ok?: boolean; anzahl?: number; fehler?: string }
    if (!res.ok || !j.ok) return { ok: false, fehler: j.fehler ?? 'Watchlist-Sync fehlgeschlagen.' }
    // Depot-Cache irrelevant, aber Radar-Scans außerhalb Watchlist bereinigen
    const { syncNachkaufUniversum } = await import('@/lib/portfolio-analyse/universum-sync-client')
    syncNachkaufUniversum()
    return { ok: true, anzahl: j.anzahl }
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Watchlist-Sync fehlgeschlagen.' }
  }
}

/**
 * Lädt die lokale Watchlist und vereinigt sie mit dem Cloud-Stand
 * (Einträge von anderen Geräten kommen dazu). Ergebnis wird lokal
 * gespeichert und zurück in die Cloud gespiegelt.
 */
function mergeWatchlisten(...listen: WatchlistEintrag[][]): WatchlistEintrag[] {
  const map = new Map<string, WatchlistEintrag>()
  for (const liste of listen) {
    for (const roh of liste) {
      const e = anreichereWatchlistIsinLokal(roh)
      const key = watchlistSchluessel(e)
      if (!key) continue
      const prev = map.get(key)
      if (!prev) {
        map.set(key, e)
        continue
      }
      map.set(key, {
        ...prev,
        ...e,
        isin: e.isin && istGueltigeIsin(e.isin) ? e.isin : prev.isin,
        symbolYahoo: e.symbolYahoo || prev.symbolYahoo,
        symbolCandidates: [...new Set([...(prev.symbolCandidates ?? []), ...(e.symbolCandidates ?? [])])],
        name: e.name || prev.name,
        hinzugefuegtAm:
          prev.hinzugefuegtAm && e.hinzugefuegtAm
            ? prev.hinzugefuegtAm < e.hinzugefuegtAm
              ? prev.hinzugefuegtAm
              : e.hinzugefuegtAm
            : prev.hinzugefuegtAm || e.hinzugefuegtAm,
      })
    }
  }
  return [...map.values()]
}

export async function ladeWatchlistMitCloudMerge(): Promise<WatchlistEintrag[]> {
  const { holeClientStateCache, pullClientState } = await import('@/lib/client-state/client-state-sync')
  await pullClientState()
  const lokal = ladeWatchlist().map(anreichereWatchlistIsinLokal)
  // Client-State hat oft die volle Liste — nie mit kurzer Radar-Cloud überschreiben.
  const ausState = holeClientStateCache('watchlist')
  if (ausState) {
    const merged = mergeWatchlisten(lokal)
    if (merged.length > 0) {
      speichereWatchlist(merged)
      return merged
    }
    return lokal
  }

  try {
    const res = await fetch('/api/portfolio-analyse/watchlist-sync')
    const j = (await res.json()) as {
      ok?: boolean
      eintraege?: { isin?: string; name?: string; symbolYahoo?: string | null; symbolCandidates?: string[]; hinzugefuegtAm?: string }[]
    }
    if (j.ok && Array.isArray(j.eintraege)) {
      const cloud: WatchlistEintrag[] = j.eintraege
        .filter((e) => e.name)
        .map((e) =>
          anreichereWatchlistIsinLokal({
            isin: e.isin?.trim().toUpperCase() || null,
            name: e.name!,
            symbolYahoo: e.symbolYahoo ?? null,
            symbolCandidates: Array.isArray(e.symbolCandidates) ? e.symbolCandidates : [],
            hinzugefuegtAm: e.hinzugefuegtAm ?? new Date().toISOString(),
          }),
        )
      const merged = mergeWatchlisten(lokal, cloud)
      if (merged.length > 0) {
        speichereWatchlist(merged)
        return merged
      }
      return lokal
    }
  } catch {
    /* offline / Fehler → lokale Liste reicht */
  }
  if (lokal.length > 0) syncWatchlistZurCloud(lokal)
  return lokal
}

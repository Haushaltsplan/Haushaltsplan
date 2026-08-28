import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

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
    const raw = localStorage.getItem(LS_KEY)
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
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(eintraege))
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(WATCHLIST_CHANGED_EVENT))
  }
  syncWatchlistZurCloud(eintraege)
  void import('@/lib/client-state/client-state-sync').then((m) => {
    m.pushClientState('watchlist', eintraege)
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
  const next = [eintrag, ...bestehend]
  speichereWatchlist(next)
  return next
}

// ---------------------------------------------------------------------------
// Cloud-Sync (Nachkauf-Radar): Watchlist nach Supabase spiegeln,
// damit Scan/Deep Research/Kaufempfehlung (auch Cron) die Titel kennen.
// ---------------------------------------------------------------------------

/** Spiegelt die Watchlist fire-and-forget in die Cloud (nur Einträge mit gültiger ISIN). */
export function syncWatchlistZurCloud(eintraege: WatchlistEintrag[]): void {
  if (typeof window === 'undefined') return
  const mitIsin = eintraege.filter((e) => e.isin && istGueltigeIsin(e.isin))
  void fetch('/api/portfolio-analyse/watchlist-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eintraege: mitIsin }),
  }).catch(() => {
    /* Sync darf die UI nie blockieren */
  })
}

/**
 * Lädt die lokale Watchlist und vereinigt sie mit dem Cloud-Stand
 * (Einträge von anderen Geräten kommen dazu). Ergebnis wird lokal
 * gespeichert und zurück in die Cloud gespiegelt.
 */
export async function ladeWatchlistMitCloudMerge(): Promise<WatchlistEintrag[]> {
  const { holeClientStateCache, pullClientState } = await import('@/lib/client-state/client-state-sync')
  await pullClientState()
  const ausState = holeClientStateCache('watchlist')
  if (ausState) return ladeWatchlist()

  const lokal = ladeWatchlist()
  try {
    const res = await fetch('/api/portfolio-analyse/watchlist-sync')
    const j = (await res.json()) as {
      ok?: boolean
      eintraege?: { isin?: string; name?: string; symbolYahoo?: string | null; symbolCandidates?: string[]; hinzugefuegtAm?: string }[]
    }
    if (j.ok && Array.isArray(j.eintraege)) {
      const cloud: WatchlistEintrag[] = j.eintraege
        .filter((e) => e.isin && istGueltigeIsin(e.isin) && e.name)
        .map((e) => ({
          isin: e.isin!.trim().toUpperCase(),
          name: e.name!,
          symbolYahoo: e.symbolYahoo ?? null,
          symbolCandidates: Array.isArray(e.symbolCandidates) ? e.symbolCandidates : [],
          hinzugefuegtAm: e.hinzugefuegtAm ?? new Date().toISOString(),
        }))
      // Cloud ist die volle Liste (Löschen muss ankommen). Leere Cloud + lokale Daten = Erst-Upload.
      if (cloud.length > 0) {
        speichereWatchlist(cloud)
        return cloud
      }
      if (lokal.length > 0) {
        speichereWatchlist(lokal)
        return lokal
      }
      return lokal
    }
  } catch {
    /* offline / Fehler → lokale Liste reicht */
  }
  if (lokal.length > 0) syncWatchlistZurCloud(lokal)
  return lokal
}

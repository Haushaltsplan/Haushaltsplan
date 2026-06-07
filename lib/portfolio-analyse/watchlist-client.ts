import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

export type WatchlistEintrag = {
  isin: string | null
  name: string
  symbolYahoo: string | null
  symbolCandidates: string[]
  hinzugefuegtAm: string
}

const LS_KEY = 'pa-watchlist-v1'
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

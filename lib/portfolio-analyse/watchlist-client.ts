import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

export type WatchlistEintrag = {
  isin: string
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

export function ladeWatchlist(): WatchlistEintrag[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const j = JSON.parse(raw) as WatchlistEintrag[]
    if (!Array.isArray(j)) return []
    return j.filter((e) => istGueltigeIsin(e.isin))
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

export function watchlistEintragAusMeta(m: IsinMetadata): WatchlistEintrag {
  const isin = m.isin.trim().toUpperCase()
  const k = isinKenntnis(isin)
  return {
    isin,
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
  opts: { isin?: string | null },
): number {
  const isin = opts.isin?.trim().toUpperCase()
  if (!isin) return -1
  return eintraege.findIndex((e) => e.isin === isin)
}

export function entferneAusWatchlist(isin: string): WatchlistEintrag[] {
  const norm = isin.trim().toUpperCase()
  const next = ladeWatchlist().filter((e) => e.isin !== norm)
  speichereWatchlist(next)
  return next
}

export function fuegeZurWatchlistHinzu(eintrag: WatchlistEintrag): WatchlistEintrag[] {
  const norm = eintrag.isin.trim().toUpperCase()
  const bestehend = ladeWatchlist().filter((e) => e.isin !== norm)
  const next = [{ ...eintrag, isin: norm }, ...bestehend]
  speichereWatchlist(next)
  return next
}

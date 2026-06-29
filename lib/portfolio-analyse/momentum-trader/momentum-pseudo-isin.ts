/** Pseudo-ISIN für Pre-IPO / noch nicht gelistete Titel (Momentum-Watchlist). */

const PSEUDO_PREFIX = 'XP'
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/

export function istMomentumPseudoIsin(isin: string): boolean {
  const n = isin.trim().toUpperCase()
  return ISIN_RE.test(n) && n.startsWith(PSEUDO_PREFIX)
}

/** 12-stellige Pseudo-ISIN aus internem Symbol (z. B. SPACEX → XPSPACEX0000). */
export function erzeugeMomentumPseudoIsin(symbol: string): string {
  const slug = symbol
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10)
    .padEnd(10, '0')
  return PSEUDO_PREFIX + slug
}

export function symbolAusMomentumPseudoIsin(isin: string): string | null {
  if (!istMomentumPseudoIsin(isin)) return null
  const slug = isin.trim().toUpperCase().slice(2).replace(/0+$/g, '')
  return slug || null
}

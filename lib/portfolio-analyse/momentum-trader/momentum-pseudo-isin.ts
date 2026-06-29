/** Pseudo-ISIN für Pre-IPO / noch nicht gelistete Titel (Momentum-Watchlist). */

const PRE_IPO_PREFIX = 'XP'
const LISTED_PLATZHALTER_PREFIX = 'XL'
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/

export function istMomentumPseudoIsin(isin: string): boolean {
  const n = isin.trim().toUpperCase()
  return ISIN_RE.test(n) && n.startsWith(PRE_IPO_PREFIX)
}

export function istMomentumListedPlatzhalterIsin(isin: string): boolean {
  const n = isin.trim().toUpperCase()
  return ISIN_RE.test(n) && n.startsWith(LISTED_PLATZHALTER_PREFIX)
}

/** Nur echte Pre-IPO-Einträge (manuell, ohne Börsenticker). */
export function istMomentumPreIpoEintrag(e: { isin: string; symbolYahoo?: string | null }): boolean {
  return istMomentumPseudoIsin(e.isin) && !e.symbolYahoo?.trim()
}

function slugAusSymbol(symbol: string): string {
  return symbol
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10)
    .padEnd(10, '0')
}

/** 12-stellige Pseudo-ISIN aus internem Symbol (z. B. SPACEX → XPSPACEX0000). Nur für Pre-IPO. */
export function erzeugeMomentumPseudoIsin(symbol: string): string {
  return PRE_IPO_PREFIX + slugAusSymbol(symbol)
}

/** Platzhalter-ISIN für gelistete Aktien ohne auflösbare ISIN — kein Pre-IPO. */
export function erzeugeMomentumListedIsin(symbol: string): string {
  return LISTED_PLATZHALTER_PREFIX + slugAusSymbol(symbol)
}

export function symbolAusMomentumPseudoIsin(isin: string): string | null {
  if (!istMomentumPseudoIsin(isin) && !istMomentumListedPlatzhalterIsin(isin)) return null
  const slug = isin.trim().toUpperCase().slice(2).replace(/0+$/g, '')
  return slug || null
}

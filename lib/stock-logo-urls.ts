/** Finnhub-Slug aus Yahoo-Symbol (`RMS.PA` → `RMS`). META → FB (Finnhub). */
export function basisTickerAusSymbol(symbol: string): string {
  const t = symbol.trim().toUpperCase().replace(/\s+/g, '')
  const dot = t.indexOf('.')
  const basis = dot > 0 ? t.slice(0, dot) : t
  const normalized = basis.replace(/-/g, '')
  return normalized === 'META' ? 'FB' : normalized
}

/** Mehrere Finnhub-URLs probieren (Suffix-, Punkt-Varianten). */
export function finnhubLogoUrls(symbol: string): string[] {
  const t = symbol.trim().toUpperCase().replace(/\s+/g, '')
  const basis = basisTickerAusSymbol(symbol)
  const urls: string[] = []
  const push = (slug: string) => {
    const u = `https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/${encodeURIComponent(slug)}.png`
    if (!urls.includes(u)) urls.push(u)
  }
  push(basis)
  if (t.includes('.')) {
    push(t.replace(/\./g, '-'))
    push(t.replace(/\./g, ''))
  }
  /** Bekannte Abweichungen Finnhub ↔ Yahoo-Kürzel */
  const alias: Record<string, string> = {
    GOOGL: 'GOOG',
    BRK_B: 'BRK-B',
    'BRK.B': 'BRK-B',
  }
  const a = alias[basis] ?? alias[t]
  if (a) push(a)
  return urls
}

/** Initialen für Fallback-Avatar (z. B. „MC“ aus MC.PA). */
export function logoInitialen(symbol: string): string {
  const b = basisTickerAusSymbol(symbol || '?')
  if (b.length <= 2) return b
  return b.slice(0, 2)
}

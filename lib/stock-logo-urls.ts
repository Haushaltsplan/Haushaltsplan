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
    MC: 'MC',
    'MC.PA': 'MC',
    HLMA: 'HLMA',
    'HLMA.L': 'HLMA',
    H11: 'HLMA',
    'H11.MU': 'HLMA',
    ATD: 'ATD',
    'ATD.TO': 'ATD',
    WKL: 'WKL',
    'WKL.AS': 'WKL',
    STMN: 'STMN',
    'STMN.SW': 'STMN',
    SIKA: 'SIKA',
    'SIKA.SW': 'SIKA',
    MUM: 'MUM',
    'MUM.DE': 'MUM',
    USU: 'USU',
    RMS: 'RMS',
    'RMS.PA': 'RMS',
    ASML: 'ASML',
    'ASML.AS': 'ASML',
    UPST: 'UPST',
    OSP2: 'OSP2',
    'OSP2.HM': 'OSP2',
  }
  const a = alias[basis] ?? alias[t]
  if (a) push(a)
  return urls
}

export function clearbitLogoUrls(domains: string[]): string[] {
  const urls: string[] = []
  for (const raw of domains) {
    const domain = raw.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0]
    if (!domain) continue
    const u = `https://logo.clearbit.com/${domain}`
    if (!urls.includes(u)) urls.push(u)
  }
  return urls
}

/** Finnhub + optional Clearbit-Fallback. */
export function alleLogoUrls(
  symbol: string,
  opts?: { finnhubSlug?: string; clearbitDomains?: string[] },
): string[] {
  const slug = opts?.finnhubSlug?.trim() || symbol
  const finnhub = finnhubLogoUrls(slug)
  const clearbit = clearbitLogoUrls(opts?.clearbitDomains ?? [])
  const out: string[] = []
  for (const u of [...finnhub, ...clearbit]) {
    if (!out.includes(u)) out.push(u)
  }
  return out
}

/** Initialen für Fallback-Avatar (z. B. „MC“ aus MC.PA). */
export function logoInitialen(symbol: string): string {
  const b = basisTickerAusSymbol(symbol || '?')
  if (b.length <= 2) return b
  return b.slice(0, 2)
}

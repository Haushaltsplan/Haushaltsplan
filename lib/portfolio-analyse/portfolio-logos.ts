import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

export type PortfolioLogoQuelle = {
  /** Finnhub-Dateiname ohne .png (z. B. RMS, HLMA) */
  finnhubSlug?: string
  /** Clearbit-Logo per Firmen-Domain */
  clearbitDomains?: string[]
}

/** ISIN → Logo-Quellen (unabhängig vom Yahoo-Kursticker). */
const LOGO_NACH_ISIN: Record<string, PortfolioLogoQuelle> = {
  FR0000052292: { finnhubSlug: 'RMS', clearbitDomains: ['hermes.com'] },
  NL0010273215: { finnhubSlug: 'ASML', clearbitDomains: ['asml.com'] },
  US91680M1071: { finnhubSlug: 'UPST', clearbitDomains: ['upstart.com'] },
  GB0004052071: { finnhubSlug: 'HLMA', clearbitDomains: ['halma.com'] },
  CA15135U1093: { finnhubSlug: 'ATD', clearbitDomains: ['couche-tard.com'] },
  CA015DM1098: { finnhubSlug: 'ATD', clearbitDomains: ['couche-tard.com'] },
  IE00BLNMYC90: { clearbitDomains: ['xtrackers.com', 'dws.com'] },
  IE00BJXRZJ40: { clearbitDomains: ['rizetf.com'] },
  CH0012221716: { finnhubSlug: 'STMN', clearbitDomains: ['straumann.com'] },
  CH0418792922: { finnhubSlug: 'SIKA', clearbitDomains: ['sika.com'] },
  FR0000121014: { finnhubSlug: 'MC', clearbitDomains: ['lvmh.com'] },
  NL0000395903: { finnhubSlug: 'WKL', clearbitDomains: ['wolterskluwer.com'] },
  DE0005785802: { finnhubSlug: 'MUM', clearbitDomains: ['mum.de'] },
  DE000A0BVU28: { finnhubSlug: 'USU', clearbitDomains: ['usu.com', 'usu.de'] },
  /** Amundi S&P 500 UCITS (häufige TR/Parqet-ISINs) */
  LU1681048804: { clearbitDomains: ['amundi.com', 'amundietf.com'] },
  LU1681043599: { clearbitDomains: ['amundi.com', 'amundietf.com'] },
  FR0010754120: { clearbitDomains: ['amundi.com', 'amundietf.com'] },
}

/** Namens-Muster → Logo, wenn ISIN unbekannt oder ETF-Bezeichnung lang ist. */
const LOGO_NACH_NAME: Array<{ re: RegExp; quelle: PortfolioLogoQuelle }> = [
  { re: /\bamundi\b/i, quelle: { clearbitDomains: ['amundi.com', 'amundietf.com'] } },
  { re: /\bxtrackers\b/i, quelle: { clearbitDomains: ['xtrackers.com', 'dws.com'] } },
  { re: /herm[eè]s/i, quelle: { finnhubSlug: 'RMS', clearbitDomains: ['hermes.com'] } },
  { re: /\basml\b/i, quelle: { finnhubSlug: 'ASML', clearbitDomains: ['asml.com'] } },
  { re: /\brize\b/i, quelle: { clearbitDomains: ['rizetf.com'] } },
  { re: /\blvmh\b/i, quelle: { finnhubSlug: 'MC', clearbitDomains: ['lvmh.com'] } },
  { re: /straumann/i, quelle: { finnhubSlug: 'STMN', clearbitDomains: ['straumann.com'] } },
  { re: /\bsika\b/i, quelle: { finnhubSlug: 'SIKA', clearbitDomains: ['sika.com'] } },
  { re: /couche[- ]?tard/i, quelle: { finnhubSlug: 'ATD', clearbitDomains: ['couche-tard.com'] } },
  { re: /wolters\s*kluwer/i, quelle: { finnhubSlug: 'WKL', clearbitDomains: ['wolterskluwer.com'] } },
  { re: /\busu\b/i, quelle: { finnhubSlug: 'USU', clearbitDomains: ['usu.com'] } },
  { re: /mensch\s+und\s+maschine/i, quelle: { finnhubSlug: 'MUM', clearbitDomains: ['mum.de'] } },
  { re: /\bhalma\b/i, quelle: { finnhubSlug: 'HLMA', clearbitDomains: ['halma.com'] } },
  { re: /\bupstart\b/i, quelle: { finnhubSlug: 'UPST', clearbitDomains: ['upstart.com'] } },
  { re: /\bdatadog\b/i, quelle: { finnhubSlug: 'DDOG', clearbitDomains: ['datadoghq.com'] } },
]

function mergeQuellen(...teile: (PortfolioLogoQuelle | null | undefined)[]): PortfolioLogoQuelle {
  const finnhub = new Set<string>()
  const domains = new Set<string>()
  for (const t of teile) {
    if (!t) continue
    if (t.finnhubSlug) finnhub.add(t.finnhubSlug)
    for (const d of t.clearbitDomains ?? []) domains.add(d)
  }
  const slugs = [...finnhub]
  return {
    finnhubSlug: slugs[0],
    clearbitDomains: [...domains],
  }
}

export function portfolioLogoQuellen(
  isin: string | null | undefined,
  symbolYahoo: string | null | undefined,
  anzeigeName: string,
): PortfolioLogoQuelle {
  const isinKey = isin?.trim().toUpperCase() ?? ''
  const k = isinKey ? isinKenntnis(isinKey) : null
  const ausIsin = isinKey ? LOGO_NACH_ISIN[isinKey] : undefined
  let ausName: PortfolioLogoQuelle | undefined
  for (const { re, quelle } of LOGO_NACH_NAME) {
    if (re.test(anzeigeName)) {
      ausName = quelle
      break
    }
  }
  const ausKenntnisSlug = k?.logoSymbol ? { finnhubSlug: k.logoSymbol } : null
  return mergeQuellen(ausIsin, ausName, ausKenntnisSlug)
}

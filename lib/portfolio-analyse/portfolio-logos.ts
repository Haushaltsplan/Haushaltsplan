import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

export type PortfolioLogoQuelle = {
  /** Lokales Logo unter public/ (z. B. /portfolio-logos/hermes.png) */
  localPath?: string
  /** Finnhub-Dateiname ohne .png (z. B. RMS, HLMA) */
  finnhubSlug?: string
  /** Clearbit-Logo per Firmen-Domain */
  clearbitDomains?: string[]
}

const LOKAL = {
  hermes: '/portfolio-logos/hermes.png',
  asml: '/portfolio-logos/asml.png',
  halma: '/portfolio-logos/halma.png',
  coucheTard: '/portfolio-logos/couche-tard.png',
  xtrackers: '/portfolio-logos/xtrackers.png',
  rize: '/portfolio-logos/rize.png',
  straumann: '/portfolio-logos/straumann.png',
  sika: '/portfolio-logos/sika.png',
  lvmh: '/portfolio-logos/lvmh.png',
  woltersKluwer: '/portfolio-logos/wolters-kluwer.png',
  usu: '/portfolio-logos/usu.png',
  amundi: '/portfolio-logos/amundi.png',
  mum: '/portfolio-logos/mum.png',
} as const

/** ISIN → Logo-Quellen (unabhängig vom Yahoo-Kursticker). */
const LOGO_NACH_ISIN: Record<string, PortfolioLogoQuelle> = {
  FR0000052292: { localPath: LOKAL.hermes, finnhubSlug: 'RMS', clearbitDomains: ['hermes.com'] },
  NL0010273215: { localPath: LOKAL.asml, finnhubSlug: 'ASML', clearbitDomains: ['asml.com'] },
  US91680M1071: { finnhubSlug: 'UPST', clearbitDomains: ['upstart.com'] },
  GB0004052071: { localPath: LOKAL.halma, finnhubSlug: 'HLMA', clearbitDomains: ['halma.com'] },
  CA01626P1484: { localPath: LOKAL.coucheTard, finnhubSlug: 'ATD', clearbitDomains: ['couche-tard.com'] },
  CA15135U1093: { localPath: LOKAL.coucheTard, finnhubSlug: 'ATD', clearbitDomains: ['couche-tard.com'] },
  CA015DM1098: { localPath: LOKAL.coucheTard, finnhubSlug: 'ATD', clearbitDomains: ['couche-tard.com'] },
  IE00BLNMYC90: { localPath: LOKAL.xtrackers, clearbitDomains: ['xtrackers.com', 'dws.com'] },
  IE00BJXRZJ40: { localPath: LOKAL.rize, clearbitDomains: ['rizetf.com'] },
  CH0012221716: { localPath: LOKAL.straumann, finnhubSlug: 'STMN', clearbitDomains: ['straumann.com'] },
  CH1175448666: { localPath: LOKAL.straumann, finnhubSlug: 'STMN', clearbitDomains: ['straumann.com'] },
  CH0418792922: { localPath: LOKAL.sika, finnhubSlug: 'SIKA', clearbitDomains: ['sika.com'] },
  FR0000121014: { localPath: LOKAL.lvmh, finnhubSlug: 'MC', clearbitDomains: ['lvmh.com'] },
  NL0000395903: { localPath: LOKAL.woltersKluwer, finnhubSlug: 'WKL', clearbitDomains: ['wolterskluwer.com'] },
  DE0006580806: { localPath: LOKAL.mum, finnhubSlug: 'MUM', clearbitDomains: ['mum.de'] },
  DE0005785802: { localPath: LOKAL.mum, finnhubSlug: 'MUM', clearbitDomains: ['mum.de'] },
  DE000A0BVU28: { localPath: LOKAL.usu, finnhubSlug: 'USU', clearbitDomains: ['usu.com', 'usu.de'] },
  /** Amundi S&P 500 UCITS (häufige TR/Parqet-ISINs) */
  LU1681038243: { localPath: LOKAL.amundi, clearbitDomains: ['amundi.com', 'amundietf.com'] },
  LU1681048804: { localPath: LOKAL.amundi, clearbitDomains: ['amundi.com', 'amundietf.com'] },
  LU1681043599: { localPath: LOKAL.amundi, clearbitDomains: ['amundi.com', 'amundietf.com'] },
  FR0010754120: { localPath: LOKAL.amundi, clearbitDomains: ['amundi.com', 'amundietf.com'] },
}

/** Namens-Muster → Logo, wenn ISIN unbekannt oder ETF-Bezeichnung lang ist. */
const LOGO_NACH_NAME: Array<{ re: RegExp; quelle: PortfolioLogoQuelle }> = [
  { re: /\bamundi\b/i, quelle: { localPath: LOKAL.amundi, clearbitDomains: ['amundi.com', 'amundietf.com'] } },
  { re: /\bxtrackers\b/i, quelle: { localPath: LOKAL.xtrackers, clearbitDomains: ['xtrackers.com', 'dws.com'] } },
  { re: /herm[eè]s/i, quelle: { localPath: LOKAL.hermes, finnhubSlug: 'RMS', clearbitDomains: ['hermes.com'] } },
  { re: /\basml\b/i, quelle: { localPath: LOKAL.asml, finnhubSlug: 'ASML', clearbitDomains: ['asml.com'] } },
  { re: /\brize\b/i, quelle: { localPath: LOKAL.rize, clearbitDomains: ['rizetf.com'] } },
  { re: /\blvmh\b/i, quelle: { localPath: LOKAL.lvmh, finnhubSlug: 'MC', clearbitDomains: ['lvmh.com'] } },
  { re: /straumann/i, quelle: { localPath: LOKAL.straumann, finnhubSlug: 'STMN', clearbitDomains: ['straumann.com'] } },
  { re: /\bsika\b/i, quelle: { localPath: LOKAL.sika, finnhubSlug: 'SIKA', clearbitDomains: ['sika.com'] } },
  { re: /couche[- ]?tard/i, quelle: { localPath: LOKAL.coucheTard, finnhubSlug: 'ATD', clearbitDomains: ['couche-tard.com'] } },
  { re: /wolters\s*kluwer/i, quelle: { localPath: LOKAL.woltersKluwer, finnhubSlug: 'WKL', clearbitDomains: ['wolterskluwer.com'] } },
  { re: /\busu\b/i, quelle: { localPath: LOKAL.usu, finnhubSlug: 'USU', clearbitDomains: ['usu.com'] } },
  { re: /mensch\s+und\s+maschine/i, quelle: { localPath: LOKAL.mum, finnhubSlug: 'MUM', clearbitDomains: ['mum.de'] } },
  { re: /\bhalma\b/i, quelle: { localPath: LOKAL.halma, finnhubSlug: 'HLMA', clearbitDomains: ['halma.com'] } },
  { re: /\bupstart\b/i, quelle: { finnhubSlug: 'UPST', clearbitDomains: ['upstart.com'] } },
  { re: /\bdatadog\b/i, quelle: { finnhubSlug: 'DDOG', clearbitDomains: ['datadoghq.com'] } },
]

function mergeQuellen(...teile: (PortfolioLogoQuelle | null | undefined)[]): PortfolioLogoQuelle {
  const finnhub = new Set<string>()
  const domains = new Set<string>()
  let localPath: string | undefined
  for (const t of teile) {
    if (!t) continue
    if (!localPath && t.localPath) localPath = t.localPath
    if (t.finnhubSlug) finnhub.add(t.finnhubSlug)
    for (const d of t.clearbitDomains ?? []) domains.add(d)
  }
  const slugs = [...finnhub]
  return {
    localPath,
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

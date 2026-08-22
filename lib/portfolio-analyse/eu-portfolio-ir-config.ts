/** Kuratierte IR-Scraper-Konfiguration — Portfolio-EU/CH/CA. */

export type EuPortfolioIrConfig = {
  isins: string[]
  /** Seiten zum Crawlen (HTML + eingebettete JSON-Listen). */
  seedUrls: string[]
  /** Basis-Host für relative PDF-Pfade. */
  origin: string
  /** Referer für PDF-Downloads (Bot-Schutz). */
  referer: string
  /** Feste AEM/JSON-Listen (Straumann, …). */
  listingJsonUrls?: string[]
}

export const EU_PORTFOLIO_IR_CONFIGS: EuPortfolioIrConfig[] = [
  {
    isins: ['DE0006580806', 'DE0005785802'],
    origin: 'https://www.mum.de',
    referer: 'https://www.mum.de/unternehmen/investor-relations/finanzberichte',
    seedUrls: [
      'https://www.mum.de/unternehmen/investor-relations/finanzberichte',
      'https://www.mum.de/unternehmen/investor-relations/publikationen',
      'https://www.mum.de/unternehmen/investor-relations/praesentationen-presentations',
    ],
  },
  {
    isins: ['CH1175448666', 'CH0012221716'],
    origin: 'https://www.straumann.com',
    referer: 'https://www.straumann.com/group/en/home/investors/financial-reports.html',
    seedUrls: [
      'https://www.straumann.com/group/en/home/investors/financial-reports/conference-presentations.html',
      'https://www.straumann.com/group/en/home/media/annual-reports-and-publications.html',
      'https://www.straumann.com/group/en/home/investors/financial-reports/annual-reports.html',
    ],
    listingJsonUrls: [
      'https://www.straumann.com/group/en/home/media/annual-reports-and-publications/_jcr_content/content/resourcesearch_copy.listing.json',
      'https://www.straumann.com/group/en/home/investors/financial-reports/conference-presentations/_jcr_content/content/resourcesearch.listing.json',
    ],
  },
  {
    isins: ['CH0418792922'],
    origin: 'https://www.sika.com',
    referer: 'https://www.sika.com/en/investors/reports-publications.html',
    seedUrls: [
      'https://www.sika.com/en/investors/reports-publications/presentations.html',
      'https://www.sika.com/en/investors/reports-publications/financial-reports.html',
    ],
    listingJsonUrls: [
      'https://www.sika.com/en/investors/reports-publications/financial-reports/_jcr_content/content/layoutcontainer_27246852/first/downloads.listing.json',
      'https://www.sika.com/en/investors/reports-publications/presentations/_jcr_content/content/layoutcontainer_550841723/first/container/accordionitem_1531742667/content/downloads.listing.json',
    ],
  },
  {
    isins: ['GB0004052071'],
    origin: 'https://www.halma.com',
    referer: 'https://www.halma.com/investors/results-centre',
    seedUrls: [
      'https://www.halma.com/investors/results-centre',
      'https://www.halma.com/investors/results-reports-presentations/2026',
      'https://www.halma.com/investors/results-reports-presentations/2025',
      'https://www.halma.com/investors/annual-report',
      'https://www.halma.com/investors/annual-report/annual-report-archive',
    ],
  },
  {
    isins: ['NL0000395903'],
    origin: 'https://www.wolterskluwer.com',
    referer: 'https://www.wolterskluwer.com/en/investors/presentations/past-presentations',
    seedUrls: [
      'https://www.wolterskluwer.com/en/investors/presentations/past-presentations',
      'https://www.wolterskluwer.com/en/investors/financials/results',
      'https://www.wolterskluwer.com/en/investors/financials/annual-reports',
    ],
  },
  {
    isins: ['CA01626P1484', 'CA15135U1093', 'CA015DM1098'],
    origin: 'https://corporate.couche-tard.com',
    referer: 'https://corporate.couche-tard.com/investors',
    seedUrls: [
      'https://corporate.couche-tard.com/investors',
      'https://corporate.couche-tard.com/financial-reporting?cat=29',
    ],
  },
  {
    isins: ['NL0010273215'],
    origin: 'https://www.asml.com',
    referer: 'https://www.asml.com/en/investors',
    seedUrls: [
      'https://www.asml.com/en/investors/annual-report',
      'https://www.asml.com/en/investors/financials',
      'https://www.asml.com/en/investors/financials/annual-reports',
      'https://www.asml.com/en/investors/financial-results',
    ],
  },
]

const ISIN_ZU_CONFIG = new Map<string, EuPortfolioIrConfig>()
for (const cfg of EU_PORTFOLIO_IR_CONFIGS) {
  for (const isin of cfg.isins) ISIN_ZU_CONFIG.set(isin, cfg)
}

export function euPortfolioIrConfig(isin: string | null | undefined): EuPortfolioIrConfig | null {
  if (!isin?.trim()) return null
  return ISIN_ZU_CONFIG.get(isin.trim().toUpperCase()) ?? null
}

export const EU_PORTFOLIO_IR_ISINS = new Set(ISIN_ZU_CONFIG.keys())

/** ISINs mit StockAnalysis/Yahoo-GuV-Merge statt rein Macrotrends. */
export const EU_GUV_FALLBACK_ISINS = new Set([
  'DE0006580806',
  'DE0005785802',
  'CH1175448666',
  'CH0012221716',
  'CH0418792922',
  'GB0004052071',
  'NL0000395903',
  'NL0010273215', // ASML
  'IE000S9YS762', // Linde
  'CA01626P1484',
  'CA15135U1093',
  'CA015DM1098',
  'FR0000052292',
])

export const ISIN_WAEHRUNG: Record<string, string> = {
  DE0006580806: 'EUR',
  DE0005785802: 'EUR',
  CH1175448666: 'CHF',
  CH0012221716: 'CHF',
  CH0418792922: 'CHF',
  GB0004052071: 'GBP',
  NL0000395903: 'EUR',
  NL0010273215: 'EUR',
  IE000S9YS762: 'USD',
  CA01626P1484: 'CAD',
  CA15135U1093: 'CAD',
  CA015DM1098: 'CAD',
  FR0000052292: 'EUR',
}

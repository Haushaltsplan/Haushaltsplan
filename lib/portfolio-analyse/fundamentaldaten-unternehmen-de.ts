import 'server-only'

const CACHE_MS = 7 * 24 * 60 * 60 * 1000
const wikiCache = new Map<string, { text: string | null; at: number }>()
const translateCache = new Map<string, { text: string | null; at: number }>()

/** Bekannte Mehrdeutigkeiten: Ticker → exakter Wikipedia-DE-Titel */
const TICKER_WIKI_TITEL: Record<string, string> = {
  GOOGL: 'Alphabet Inc.',
  GOOG: 'Alphabet Inc.',
  META: 'Meta Platforms',
  FB: 'Meta Platforms',
  AMZN: 'Amazon (Unternehmen)',
  MSFT: 'Microsoft',
  AAPL: 'Apple Inc.',
  NVDA: 'Nvidia',
  TSLA: 'Tesla (Unternehmen)',
  BRK: 'Berkshire Hathaway',
  BRK_A: 'Berkshire Hathaway',
  BRK_B: 'Berkshire Hathaway',
}

const SEKTOR_DE: Record<string, string> = {
  'Basic Materials': 'Grundstoffe',
  'Communication Services': 'Telekommunikation & Medien',
  'Consumer Cyclical': 'Zyklische Konsumgüter',
  'Consumer Defensive': 'Nicht-zyklische Konsumgüter',
  Energy: 'Energie',
  'Financial Services': 'Finanzdienstleistungen',
  Healthcare: 'Gesundheitswesen',
  Industrials: 'Industrie',
  'Real Estate': 'Immobilien',
  Technology: 'Technologie',
  Utilities: 'Versorger',
}

const BRANCHE_DE: Record<string, string> = {
  'Advertising Agencies': 'Werbeagenturen',
  'Aerospace & Defense': 'Luft- & Raumfahrt / Verteidigung',
  Airlines: 'Fluggesellschaften',
  'Apparel Manufacturing': 'Bekleidungsherstellung',
  'Apparel Retail': 'Bekleidungseinzelhandel',
  'Asset Management': 'Vermögensverwaltung',
  'Auto Manufacturers': 'Automobilhersteller',
  'Auto Parts': 'Automobilzulieferer',
  'Banks—Diversified': 'Banken (diversifiziert)',
  'Banks—Regional': 'Regionalbanken',
  'Beverages—Non-Alcoholic': 'Getränke (alkoholfrei)',
  Biotechnology: 'Biotechnologie',
  'Building Materials': 'Baustoffe',
  'Capital Markets': 'Kapitalmärkte',
  'Communication Equipment': 'Kommunikationstechnik',
  'Computer Hardware': 'Computer-Hardware',
  Confectioners: 'Süßwaren',
  'Consulting Services': 'Unternehmensberatung',
  'Consumer Electronics': 'Unterhaltungselektronik',
  'Credit Services': 'Kreditdienstleistungen',
  'Department Stores': 'Kaufhäuser',
  'Diagnostics & Research': 'Diagnostik & Forschung',
  'Discount Stores': 'Discounter',
  'Drug Manufacturers—General': 'Pharma (Allgemein)',
  'Drug Manufacturers—Specialty & Generic': 'Pharma (Spezial & Generika)',
  'Electrical Equipment & Parts': 'Elektrotechnik & Zubehör',
  'Electronic Components': 'Elektronikkomponenten',
  'Electronic Gaming & Multimedia': 'Elektronische Spiele & Multimedia',
  'Engineering & Construction': 'Ingenieur- & Bauwesen',
  Entertainment: 'Unterhaltung',
  'Farm & Heavy Construction Machinery': 'Land- & Baumaschinen',
  'Financial Conglomerates': 'Finanzkonglomerate',
  'Financial Data & Stock Exchanges': 'Finanzdaten & Börsen',
  'Food Distribution': 'Lebensmittelgroßhandel',
  'Footwear & Accessories': 'Schuhe & Accessoires',
  Gambling: 'Glücksspiel',
  Gold: 'Gold',
  'Grocery Stores': 'Lebensmittelhandel',
  'Health Information Services': 'Gesundheitsinformationssysteme',
  'Home Improvement Retail': 'Baumarkt & Heimwerker',
  'Household & Personal Products': 'Haushalts- & Körperpflegeprodukte',
  'Industrial Distribution': 'Industriehandel',
  'Information Technology Services': 'IT-Dienstleistungen',
  'Insurance—Diversified': 'Versicherungen (diversifiziert)',
  'Insurance—Life': 'Lebensversicherungen',
  'Insurance—Property & Casualty': 'Sach- & Unfallversicherungen',
  'Integrated Freight & Logistics': 'Logistik & Spedition',
  'Internet Content & Information': 'Internetinhalte & Informationen',
  'Internet Retail': 'Online-Einzelhandel',
  Leisure: 'Freizeit',
  Lodging: 'Beherbergung / Hotellerie',
  'Luxury Goods': 'Luxusgüter',
  'Medical Care Facilities': 'Medizinische Einrichtungen',
  'Medical Devices': 'Medizintechnik',
  'Medical Instruments & Supplies': 'Medizinische Instrumente & Verbrauchsmaterial',
  'Metal Fabrication': 'Metallverarbeitung',
  'Oil & Gas E&P': 'Öl- & Gasförderung',
  'Oil & Gas Integrated': 'Öl- & Gas (integriert)',
  'Oil & Gas Midstream': 'Öl- & Gas (Midstream)',
  'Packaged Foods': 'Verpackte Lebensmittel',
  'Packaging & Containers': 'Verpackung & Behälter',
  'Personal Services': 'Persönliche Dienstleistungen',
  'Pharmaceutical Retailers': 'Apotheken & Pharmahandel',
  'Pollution & Treatment Controls': 'Umwelt- & Abwassertechnik',
  Railroads: 'Eisenbahnen',
  'Real Estate Services': 'Immobiliendienstleistungen',
  'Recreational Vehicles': 'Freizeitfahrzeuge',
  'REIT—Diversified': 'Immobilienfonds (REIT, diversifiziert)',
  'REIT—Healthcare Facilities': 'Immobilienfonds (Gesundheit)',
  'REIT—Industrial': 'Immobilienfonds (Industrie)',
  'REIT—Office': 'Immobilienfonds (Büro)',
  'REIT—Residential': 'Immobilienfonds (Wohnen)',
  'REIT—Retail': 'Immobilienfonds (Einzelhandel)',
  'Renewable Utilities': 'Erneuerbare Energien (Versorger)',
  'Residential Construction': 'Wohnungsbau',
  Restaurants: 'Restaurants',
  'Scientific & Technical Instruments': 'Wissenschaftliche & technische Instrumente',
  'Semiconductor Equipment & Materials': 'Halbleiterausrüstung & -materialien',
  Semiconductors: 'Halbleiter',
  'Software—Application': 'Software (Anwendungen)',
  'Software—Infrastructure': 'Software (Infrastruktur)',
  Solar: 'Solarenergie',
  'Specialty Chemicals': 'Spezialchemie',
  'Specialty Industrial Machinery': 'Spezialmaschinenbau',
  'Specialty Retail': 'Spezial-Einzelhandel',
  'Staffing & Employment Services': 'Personalvermittlung',
  Steel: 'Stahl',
  'Telecom Services': 'Telekommunikation',
  'Textile Manufacturing': 'Textilherstellung',
  Tobacco: 'Tabak',
  'Travel Services': 'Reisedienstleistungen',
  Trucking: 'Spedition / LKW-Transport',
  'Utilities—Diversified': 'Versorger (diversifiziert)',
  'Utilities—Regulated Electric': 'Stromversorger (reguliert)',
  'Utilities—Regulated Gas': 'Gasversorger (reguliert)',
  'Utilities—Renewable': 'Versorger (Erneuerbare)',
  'Waste Management': 'Abfallwirtschaft',
  'Wineries & Distilleries': 'Wein- & Spirituosenherstellung',
}

const UNTERNEHMENS_SUFFIX = /\b(Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|PLC|AG|SE|SA|NV|N\.V\.|Holdings?|Group|LLC)\b/i

function ausCache<T>(map: Map<string, { text: T; at: number }>, key: string): T | undefined {
  const hit = map.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.text
  return undefined
}

function hatUnternehmensSuffix(name: string): boolean {
  return UNTERNEHMENS_SUFFIX.test(name)
}

function wikiSuchbegriffe(firmenname: string, ticker: string): string[] {
  const basis = firmenname.trim()
  const tickerUp = ticker.trim().toUpperCase()
  const uniq: string[] = []

  const push = (s?: string) => {
    const t = s?.trim()
    if (t && !uniq.includes(t)) uniq.push(t)
  }

  const knownTitle = TICKER_WIKI_TITEL[tickerUp]
  if (knownTitle) push(knownTitle)

  if (hatUnternehmensSuffix(basis)) {
    push(basis)
  } else {
    push(`${basis} Inc.`)
    push(`${basis} (Unternehmen)`)
    push(`${basis} AG`)
    push(basis)
  }

  push(`${basis} Unternehmen`)
  if (tickerUp.length >= 2) push(`${basis} ${tickerUp}`)

  return uniq
}

function istBegriffsklaerung(titel: string): boolean {
  return /\(Begriffskl[aä]rung\)/i.test(titel)
}

function istUnternehmensArtikel(titel: string, extract: string): boolean {
  if (istBegriffsklaerung(titel)) return false

  const t = titel.toLowerCase()
  const e = extract.toLowerCase()

  const titelUnternehmen =
    /\b(inc\.?|corp\.?|ag|se|plc|llc|holding|platforms|group)\b/i.test(titel) ||
    titel.includes('(Unternehmen)') ||
    titel.includes('Aktiengesellschaft')

  const schriftArtikel =
    /^alphabet$/i.test(titel.trim()) ||
    /\b(buchstaben|schrift|alphabetisch|lautschrift|schriftzeichen)\b/i.test(e.slice(0, 280))

  const unternehmensSignale =
    /\b(unternehmen|konzern|aktie|aktien|börsennotiert|umsatz|tochter|muttergesellschaft|software|hardware|dienstleist|entwickelt|vertreibt|produziert)\b/i.test(
      e,
    )

  if (schriftArtikel && !titelUnternehmen) return false
  if (titelUnternehmen && unternehmensSignale) return true
  if (unternehmensSignale && extract.length > 120) return true
  return titelUnternehmen && extract.length > 100
}

function scoreWikiTreffer(titel: string, suchbegriff: string, firmenname: string): number {
  let score = 0
  const tl = titel.toLowerCase()
  const sl = suchbegriff.toLowerCase()
  const fl = firmenname.toLowerCase()

  if (istBegriffsklaerung(titel)) return -100
  if (tl === sl) score += 40
  if (tl.includes('inc.') || tl.includes('(unternehmen)')) score += 30
  if (/\b(inc\.?|ag|se|corp|llc|platforms)\b/i.test(titel)) score += 20
  if (tl.startsWith(fl)) score += 15
  if (tl === fl && !hatUnternehmensSuffix(firmenname)) score -= 25
  if (/^(alphabet|apple|amazon|meta|oracle|target|square|block)$/i.test(titel.trim())) score -= 40
  return score
}

async function wikiExtractByTitle(titel: string): Promise<string | null> {
  const cacheKey = `title:${titel.toLowerCase()}`
  const cached = ausCache(wikiCache, cacheKey)
  if (cached !== undefined) return cached

  try {
    const extractUrl = new URL('https://de.wikipedia.org/w/api.php')
    extractUrl.searchParams.set('action', 'query')
    extractUrl.searchParams.set('prop', 'extracts')
    extractUrl.searchParams.set('exintro', '1')
    extractUrl.searchParams.set('explaintext', '1')
    extractUrl.searchParams.set('titles', titel)
    extractUrl.searchParams.set('format', 'json')
    extractUrl.searchParams.set('origin', '*')

    const er = await fetch(extractUrl.toString(), { cache: 'no-store' })
    if (!er.ok) {
      wikiCache.set(cacheKey, { text: null, at: Date.now() })
      return null
    }
    const ej = (await er.json()) as { query?: { pages?: Record<string, { extract?: string; title?: string }> } }
    const page = Object.values(ej.query?.pages ?? {})[0]
    const extract = page?.extract?.trim() ?? null
    if (!extract || extract.length < 80) {
      wikiCache.set(cacheKey, { text: null, at: Date.now() })
      return null
    }
    if (!istUnternehmensArtikel(page?.title ?? titel, extract)) {
      wikiCache.set(cacheKey, { text: null, at: Date.now() })
      return null
    }
    wikiCache.set(cacheKey, { text: extract, at: Date.now() })
    return extract
  } catch {
    wikiCache.set(cacheKey, { text: null, at: Date.now() })
    return null
  }
}

async function wikiDeExtract(suchbegriff: string, firmenname: string): Promise<string | null> {
  const cacheKey = `search:${suchbegriff.toLowerCase()}`
  const cached = ausCache(wikiCache, cacheKey)
  if (cached !== undefined) return cached

  try {
    const searchUrl = new URL('https://de.wikipedia.org/w/api.php')
    searchUrl.searchParams.set('action', 'query')
    searchUrl.searchParams.set('list', 'search')
    searchUrl.searchParams.set('srsearch', suchbegriff)
    searchUrl.searchParams.set('srlimit', '8')
    searchUrl.searchParams.set('format', 'json')
    searchUrl.searchParams.set('origin', '*')

    const sr = await fetch(searchUrl.toString(), { cache: 'no-store' })
    if (!sr.ok) {
      wikiCache.set(cacheKey, { text: null, at: Date.now() })
      return null
    }
    const sj = (await sr.json()) as { query?: { search?: Array<{ title: string }> } }
    const treffer = (sj.query?.search ?? [])
      .map((t) => ({ ...t, score: scoreWikiTreffer(t.title, suchbegriff, firmenname) }))
      .filter((t) => t.score > 0)
      .sort((a, b) => b.score - a.score)

    for (const t of treffer) {
      const text = await wikiExtractByTitle(t.title)
      if (text) {
        wikiCache.set(cacheKey, { text, at: Date.now() })
        return text
      }
    }

    wikiCache.set(cacheKey, { text: null, at: Date.now() })
    return null
  } catch {
    wikiCache.set(cacheKey, { text: null, at: Date.now() })
    return null
  }
}

async function uebersetzeEnDe(text: string): Promise<string | null> {
  const key = text.slice(0, 200)
  const cached = ausCache(translateCache, key)
  if (cached !== undefined) return cached

  const chunk = text.length > 900 ? `${text.slice(0, 897)}…` : text
  try {
    const u = new URL('https://api.mymemory.translated.net/get')
    u.searchParams.set('q', chunk)
    u.searchParams.set('langpair', 'en|de')
    const res = await fetch(u.toString(), { cache: 'no-store' })
    if (!res.ok) {
      translateCache.set(key, { text: null, at: Date.now() })
      return null
    }
    const j = (await res.json()) as { responseData?: { translatedText?: string } }
    const tr = j.responseData?.translatedText?.trim()
    const ok = tr && tr.length > 40 && !/MYMEMORY WARNING/i.test(tr) ? tr : null
    translateCache.set(key, { text: ok, at: Date.now() })
    return ok
  } catch {
    translateCache.set(key, { text: null, at: Date.now() })
    return null
  }
}

export function brancheAufDeutsch(industry?: string | null): string | null {
  if (!industry?.trim()) return null
  const t = industry.trim()
  return BRANCHE_DE[t] ?? BRANCHE_DE[t.replace(/\s+/g, ' ')] ?? null
}

export function sektorAufDeutsch(sector?: string | null): string | null {
  if (!sector?.trim()) return null
  const t = sector.trim()
  return SEKTOR_DE[t] ?? null
}

export function formatiereBrancheDe(opts: {
  industry?: string | null
  sector?: string | null
}): { branche: string | null; sektor: string | null } {
  const brancheDe = brancheAufDeutsch(opts.industry)
  const sektorDe = sektorAufDeutsch(opts.sector)
  return {
    branche: brancheDe ?? opts.industry?.trim() ?? null,
    sektor: sektorDe ?? opts.sector?.trim() ?? null,
  }
}

/** Firmenbeschreibung auf Deutsch — Wikipedia DE (Unternehmensartikel) oder Yahoo-Übersetzung. */
export async function ladeUnternehmensbeschreibungDe(opts: {
  firmenname: string
  ticker: string
  fallbackEn?: string | null
}): Promise<string | null> {
  const tickerUp = opts.ticker.trim().toUpperCase()
  const knownTitle = TICKER_WIKI_TITEL[tickerUp]
  if (knownTitle) {
    const direct = await wikiExtractByTitle(knownTitle)
    if (direct) return direct
  }

  for (const q of wikiSuchbegriffe(opts.firmenname, opts.ticker)) {
    const wiki = await wikiDeExtract(q, opts.firmenname)
    if (wiki) return wiki
  }

  const en = opts.fallbackEn?.trim()
  if (en && en.length > 40) {
    const tr = await uebersetzeEnDe(en)
    if (tr) return tr
  }

  return null
}

import type { BoersenWaehrung } from '@/lib/portfolio-analyse/kurs-aufloesung'

/**
 * Manuelle Yahoo-Ticker je ISIN (Nutzerliste).
 *
 * - Ohne Klammer-Hinweis: Yahoo-Preis 1:1 als EUR (keine FX-Umrechnung).
 * - Mit „umrechnen von X in Euro“: nur dann symbolWaehrung → FX nach EUR.
 */

export type IsinKenntnis = {
  name?: string
  wkn?: string
  symbolYahoo?: string
  symbolCandidates?: string[]
  logoSymbol?: string
  /** Nur gesetzt, wenn Nutzer explizit Umrechnung verlangt hat. */
  symbolWaehrung?: Record<string, BoersenWaehrung>
  kursNurSymbol?: string
  verboteneSymbole?: string[]
  stooqSymbol?: string
  kursFallbackEur?: number
  /** DivvyDiary-URL-Slug ohne ISIN-Suffix (z. B. mensch-und-maschine-software-aktie). */
  divvydiarySlug?: string
  /** Macrotrends-URL-Slug (z. B. louis-vuitton) — wichtig bei kurzen Tickern (MA, V). */
  macrotrendsSlug?: string
  /** Macrotrends-Chart-Ticker wenn ≠ Yahoo (z. B. MC.PA → LVMUY). */
  macrotrendsTicker?: string
}

function eintrag(
  sym: string,
  name: string,
  umrechnenVon?: BoersenWaehrung,
  extra?: Partial<IsinKenntnis>,
): IsinKenntnis {
  const s = sym.trim().toUpperCase()
  const base: IsinKenntnis = {
    name,
    symbolYahoo: s,
    symbolCandidates: [s],
    kursNurSymbol: s,
    ...extra,
  }
  if (extra?.symbolWaehrung) {
    base.symbolWaehrung = { ...extra.symbolWaehrung }
  }
  if (umrechnenVon) {
    base.symbolWaehrung = { ...base.symbolWaehrung, [s]: umrechnenVon }
  }
  return base
}

/** Yahoo-Preis direkt (keine Umrechnung). */
function direkt(sym: string, name: string, extra?: Partial<IsinKenntnis>): IsinKenntnis {
  return eintrag(sym, name, undefined, extra)
}

/** Yahoo-Preis in Fremdwährung → EUR (laut Nutzerliste in Klammern). */
function usd(sym: string, name: string, extra?: Partial<IsinKenntnis>): IsinKenntnis {
  return eintrag(sym, name, 'USD', extra)
}

function chf(sym: string, name: string, extra?: Partial<IsinKenntnis>): IsinKenntnis {
  return eintrag(sym, name, 'CHF', extra)
}

function cad(sym: string, name: string, extra?: Partial<IsinKenntnis>): IsinKenntnis {
  return eintrag(sym, name, 'CAD', extra)
}

export const ISIN_KENNTNISSE: Record<string, IsinKenntnis> = {
  // --- ohne Klammern: Preis 1:1 ---
  LU1681038243: direkt('ANX.PA', 'Amundi NASDAQ-100 SWAP UCITS ETF EUR ACC'),
  LU1681048804: direkt('500.PA', 'Amundi Index Solutions S&P 500 UCITS ETF EUR ACC'),
  IE00BLNMYC90: usd('XDEW.L', 'Xtrackers S&P 500 Equal Weight UCITS ETF 1C'),
  IE00BJXRZJ40: direkt('IE00BJXRZJ40.SG', 'Rize Cybersecurity and Data Privacy UCITS ETF'),
  FR0000052292: direkt('RMS.PA', 'Hermès', {
    divvydiarySlug: 'hermes-aktie',
    macrotrendsTicker: 'HESAY',
    macrotrendsSlug: 'hermes-international',
  }),
  FR0000121014: direkt('MC.PA', 'LVMH', {
    divvydiarySlug: 'lvmh-aktie',
    macrotrendsTicker: 'LVMUY',
    macrotrendsSlug: 'louis-vuitton',
  }),
  NL0010273215: direkt('ASML.AS', 'ASML Holding', {
    divvydiarySlug: 'asml-aktie',
    macrotrendsSlug: 'asml-holding',
  }),
  NL0000395903: direkt('WKL.AS', 'Wolters Kluwer', {
    divvydiarySlug: 'wolters-kluwer-aktie',
    macrotrendsTicker: 'WTKWY',
    macrotrendsSlug: 'wolters-kluwer',
  }),
  DE0006580806: direkt('MUM.DE', 'Mensch und Maschine', {
    divvydiarySlug: 'mensch-und-maschine-software-aktie',
    macrotrendsSlug: 'mensch-und-maschine',
    logoSymbol: 'MUM',
  }),
  DE0005785802: direkt('MUM.DE', 'Mensch und Maschine', {
    divvydiarySlug: 'mensch-und-maschine-software-aktie',
    macrotrendsSlug: 'mensch-und-maschine',
    logoSymbol: 'MUM',
  }),
  DE000A0BVU28: direkt('OSP2.HM', 'USU Software', {
    wkn: 'A0BVU2',
    logoSymbol: 'USU',
    kursFallbackEur: 9.1,
  }),
  GB0004052071: direkt('H11.SG', 'Halma', {
    logoSymbol: 'HLMA',
    /** Depot-Kurs nur H11.SG; HLMA.L wird intern für Kennzahlen-Fallback genutzt. */
    verboteneSymbole: ['H11.MU', 'HLMA.L'],
    macrotrendsTicker: 'HLMA',
    macrotrendsSlug: 'halma',
  }),

  // --- mit Klammern: Umrechnung ---
  US02079K1079: usd('GOOG', "Alphabet 'C'", { divvydiarySlug: 'alphabet-aktie' }),
  US02079K3059: usd('GOOGL', "Alphabet 'A'", { divvydiarySlug: 'alphabet-aktie' }),
  US57636Q1040: usd('MA', 'Mastercard', { divvydiarySlug: 'mastercard-aktie', macrotrendsSlug: 'mastercard' }),
  US78409V1044: usd('SPGI', 'S&P Global', { divvydiarySlug: 'sp-global-aktie' }),
  US60744M1062: usd('MBGL', 'Mobility Global', { divvydiarySlug: 'mobility-global-aktie' }),
  US5949181045: usd('MSFT', 'Microsoft', { divvydiarySlug: 'microsoft-aktie' }),
  US55354G1004: usd('MSCI', 'MSCI'),
  US91324P1021: usd('UNH', 'UnitedHealth', { divvydiarySlug: 'unitedhealth-aktie' }),
  US8835561023: usd('TMO', 'Thermo Fisher Scientific'),
  US92826C8394: usd('V', 'Visa', { macrotrendsSlug: 'visa' }),
  US81762P1021: usd('NOW', 'ServiceNow'),
  US7611521078: usd('RMD', 'Resmed', { divvydiarySlug: 'resmed-aktie' }),
  US6795801009: usd('ODFL', 'Old Dominion Freight Line'),
  US94106L1098: usd('WM', 'Waste Management', { macrotrendsSlug: 'waste-management' }),
  US9078181081: usd('UNP', 'Union Pacific'),
  US98978V1035: usd('ZTS', 'Zoetis'),
  US5801351017: usd('MCD', "McDonald's"),
  US23804L1035: usd('DDOG', 'Datadog', { logoSymbol: 'DDOG' }),
  US0576652004: usd('BCPC', 'Balchem'),
  IE000S9YS762: usd('LIN', 'Linde'),
  CH1175448666: chf('STMN.SW', 'Straumann Holding', {
    divvydiarySlug: 'straumann-holding-aktie',
    macrotrendsTicker: 'SAUHY',
    macrotrendsSlug: 'straumann-holding',
  }),
  CH0418792922: chf('SIKA.SW', 'Sika', {
    macrotrendsTicker: 'SXYAY',
    macrotrendsSlug: 'sika',
  }),
  US9224751084: usd('VEEV', 'Veeva Systems'),
  US49714P1084: usd('KNSL', 'Kinsale Capital'),
  US4370761029: usd('HD', 'The Home Depot', { macrotrendsSlug: 'home-depot' }),
  US3841091040: usd('GGG', 'Graco'),
  US0404132054: usd('ANET', 'Arista Networks', { wkn: 'A1J4UL', macrotrendsSlug: 'arista-networks' }),
  CA01626P1484: cad('ATD.TO', 'Alimentation Couche-Tard', {
    logoSymbol: 'ATD',
    divvydiarySlug: 'alimentation-couche-tard-aktie',
    macrotrendsSlug: 'alimentation-couche-tard',
  }),
  CA15135U1093: cad('ATD.TO', 'Alimentation Couche-Tard', {
    logoSymbol: 'ATD',
    macrotrendsSlug: 'alimentation-couche-tard',
  }),
  CA015DM1098: cad('ATD.TO', 'Alimentation Couche-Tard', {
    logoSymbol: 'ATD',
    divvydiarySlug: 'alimentation-couche-tard-aktie',
    macrotrendsSlug: 'alimentation-couche-tard',
  }),
  US7757111049: usd('ROL', 'Rollins', { divvydiarySlug: 'rollins-aktie' }),
  US1729081059: usd('CTAS', 'Cintas', { divvydiarySlug: 'cintas-aktie' }),
  US91680M1071: usd('UPST', 'Upstart Holdings', {
    logoSymbol: 'UPST',
    divvydiarySlug: 'upstart-holdings-aktie',
  }),
}

export function isinKenntnis(isin: string | null | undefined): IsinKenntnis | null {
  if (!isin) return null
  return ISIN_KENNTNISSE[isin.trim().toUpperCase()] ?? null
}

/**
 * Analyse-Ticker für Macrotrends/Yahoo/Scan — nicht Kurs-Listing.
 * Priorität: macrotrendsTicker → logoSymbol → US-Bare (ohne .DE/.F) → Suffix strip.
 */
export function analyseTickerFuerPosition(
  isin: string | null | undefined,
  symbolYahoo?: string | null,
): string {
  const k = isinKenntnis(isin)
  const mt = k?.macrotrendsTicker?.trim().toUpperCase()
  if (mt) return mt
  const logo = k?.logoSymbol?.trim().toUpperCase()
  if (logo) return logo

  const sym = (symbolYahoo ?? k?.symbolYahoo ?? '').trim().toUpperCase()
  if (!sym) return (isin ?? '').trim().toUpperCase()

  const bare = sym.includes('.') ? sym.split('.')[0]! : sym
  const isinU = isin?.trim().toUpperCase() ?? ''
  // US: Analyse immer auf NYSE/Nasdaq-Bare, nicht Xetra (.DE/.F)
  if (isinU.startsWith('US') && /^[A-Z0-9.]{1,6}$/.test(bare)) return bare
  return bare
}

/** ISIN aus Yahoo/Xetra-Symbol (manuelle Kenntnisse). */
export function isinAusYahooSymbol(symbol: string | null | undefined): string | null {
  const s = symbol?.trim().toUpperCase()
  if (!s) return null
  const basis = s.split('.')[0]!
  for (const [isin, k] of Object.entries(ISIN_KENNTNISSE)) {
    if (k.symbolYahoo?.toUpperCase() === s) return isin
    if (k.kursNurSymbol?.toUpperCase() === s) return isin
    if (k.symbolCandidates?.some((c) => c.toUpperCase() === s)) return isin
    if (k.symbolYahoo?.split('.')[0]?.toUpperCase() === basis) return isin
    if (k.kursNurSymbol?.split('.')[0]?.toUpperCase() === basis) return isin
  }
  return null
}

/** ISIN aus UI-Feldern (Depot, Watchlist, Ticker) — inkl. RMS → Hermès. */
export function loesePortfolioIsin(opts: {
  isin?: string | null
  symbolYahoo?: string | null
  ticker?: string | null
  firmenname?: string | null
}): string | null {
  const direct = opts.isin?.trim().toUpperCase()
  if (direct && direct.length >= 10) return direct
  if (direct && ISIN_KENNTNISSE[direct]) return direct

  for (const sym of [opts.symbolYahoo, opts.ticker]) {
    const hit = isinAusYahooSymbol(sym)
    if (hit) return hit
  }

  const name = opts.firmenname?.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  if (name && /hermes|hermès/.test(name) && !/federated|federal/.test(name)) {
    return 'FR0000052292'
  }
  if (name && (/\blvmh\b/.test(name) || /louis[\s-]?vuitton/.test(name))) {
    return 'FR0000121014'
  }
  if (name && name.length >= 3) {
    let hit: string | null = null
    for (const [isin, k] of Object.entries(ISIN_KENNTNISSE)) {
      const kn = k.name?.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '') ?? ''
      if (kn.length < 3) continue
      if (name === kn) {
        if (hit && hit !== isin) return null
        hit = isin
      }
    }
    if (hit) return hit
  }

  return direct ?? null
}

export function nameAusKenntnis(isin: string, fallback: string): string {
  const k = isinKenntnis(isin)
  if (k?.name) return k.name
  return fallback
}

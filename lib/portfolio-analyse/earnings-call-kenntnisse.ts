/** ISIN → Ticker/Slugs für Earnings-Call-Suche (Motley Fool, SEC, Finnhub, IR). */

import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

export type EarningsCallKenntnis = {
  name: string
  /** US-/Fool-Ticker ohne Börsensuffix (z. B. ATD statt ATD.TO). */
  foolTicker: string
  /** Zusätzliche Motley-Fool-URL-Slugs. */
  foolSlugs: string[]
  /** Land — steuert SEC-Priorität. */
  land: 'US' | 'CA' | 'EU' | 'CH' | 'GB' | 'DE' | 'IE' | 'NL' | 'FR' | 'ETF'
  /** IR liefert oft nur Webcast, kein volles Transkript. */
  irNurWebcast?: boolean
}

const EINTRAG: Record<string, EarningsCallKenntnis> = {
  US02079K1079: {
    name: "Alphabet 'C'",
    foolTicker: 'GOOG',
    foolSlugs: ['alphabet'],
    land: 'US',
  },
  US57636Q1040: {
    name: 'Mastercard',
    foolTicker: 'MA',
    foolSlugs: ['mastercard'],
    land: 'US',
    irNurWebcast: true,
  },
  US78409V1044: {
    name: 'S&P Global',
    foolTicker: 'SPGI',
    foolSlugs: ['sp-global', 's-p-global'],
    land: 'US',
  },
  FR0000052292: {
    name: 'Hermès',
    foolTicker: 'RMS',
    foolSlugs: ['hermes'],
    land: 'FR',
  },
  NL0010273215: {
    name: 'ASML Holding',
    foolTicker: 'ASML',
    foolSlugs: ['asml', 'asml-holding', 'asml-holding-nv'],
    land: 'NL',
  },
  US91324P1021: {
    name: 'UnitedHealth',
    foolTicker: 'UNH',
    foolSlugs: ['unitedhealth', 'unitedhealth-group', 'united-health'],
    land: 'US',
  },
  US5949181045: {
    name: 'Microsoft',
    foolTicker: 'MSFT',
    foolSlugs: ['microsoft'],
    land: 'US',
  },
  US8835561023: {
    name: 'Thermo Fisher Scientific',
    foolTicker: 'TMO',
    foolSlugs: ['thermo-fisher', 'thermo-fisher-scientific'],
    land: 'US',
  },
  US55354G1004: {
    name: 'MSCI',
    foolTicker: 'MSCI',
    foolSlugs: ['msci'],
    land: 'US',
  },
  US92826C8394: {
    name: 'Visa',
    foolTicker: 'V',
    foolSlugs: ['visa'],
    land: 'US',
    irNurWebcast: true,
  },
  US7611521078: {
    name: 'Resmed',
    foolTicker: 'RMD',
    foolSlugs: ['resmed'],
    land: 'US',
  },
  US6795801009: {
    name: 'Old Dominion Freight Line',
    foolTicker: 'ODFL',
    foolSlugs: ['old-dominion', 'old-dominion-freight-line'],
    land: 'US',
  },
  US94106L1098: {
    name: 'Waste Management',
    foolTicker: 'WM',
    foolSlugs: ['waste-management'],
    land: 'US',
  },
  US98978V1035: {
    name: 'Zoetis',
    foolTicker: 'ZTS',
    foolSlugs: ['zoetis'],
    land: 'US',
  },
  US9078181081: {
    name: 'Union Pacific',
    foolTicker: 'UNP',
    foolSlugs: ['union-pacific'],
    land: 'US',
  },
  US81762P1021: {
    name: 'ServiceNow',
    foolTicker: 'NOW',
    foolSlugs: ['servicenow'],
    land: 'US',
  },
  US5801351017: {
    name: "McDonald's",
    foolTicker: 'MCD',
    foolSlugs: ['mcdonalds', 'mcdonald'],
    land: 'US',
  },
  FR0000121014: {
    name: 'LVMH',
    foolTicker: 'MC',
    foolSlugs: ['lvmh'],
    land: 'FR',
  },
  US0576652004: {
    name: 'Balchem',
    foolTicker: 'BCPC',
    foolSlugs: ['balchem'],
    land: 'US',
  },
  IE000S9YS762: {
    name: 'Linde',
    foolTicker: 'LIN',
    foolSlugs: ['linde'],
    land: 'IE',
  },
  IE00BJXRZJ40: {
    name: 'Rize Cybersecurity ETF',
    foolTicker: 'CYBR',
    foolSlugs: [],
    land: 'ETF',
  },
  US23804L1035: {
    name: 'Datadog',
    foolTicker: 'DDOG',
    foolSlugs: ['datadog'],
    land: 'US',
  },
  GB0004052071: {
    name: 'Halma',
    foolTicker: 'HLMA',
    foolSlugs: ['halma'],
    land: 'GB',
  },
  CH1175448666: {
    name: 'Straumann Holding',
    foolTicker: 'STMN',
    foolSlugs: ['straumann', 'straumann-holding'],
    land: 'CH',
  },
  US49714P1084: {
    name: 'Kinsale Capital',
    foolTicker: 'KNSL',
    foolSlugs: ['kinsale', 'kinsale-capital'],
    land: 'US',
  },
  US4370761029: {
    name: 'The Home Depot',
    foolTicker: 'HD',
    foolSlugs: ['home-depot'],
    land: 'US',
  },
  US9224751084: {
    name: 'Veeva Systems',
    foolTicker: 'VEEV',
    foolSlugs: ['veeva', 'veeva-systems'],
    land: 'US',
  },
  US3841091040: {
    name: 'Graco',
    foolTicker: 'GGG',
    foolSlugs: ['graco'],
    land: 'US',
  },
  CH0418792922: {
    name: 'Sika',
    foolTicker: 'SIKA',
    foolSlugs: ['sika'],
    land: 'CH',
  },
  CA01626P1484: {
    name: 'Alimentation Couche-Tard',
    foolTicker: 'ATD',
    foolSlugs: ['alimentation-couche-tard', 'couche-tard'],
    land: 'CA',
  },
  CA15135U1093: {
    name: 'Alimentation Couche-Tard',
    foolTicker: 'ATD',
    foolSlugs: ['alimentation-couche-tard', 'couche-tard'],
    land: 'CA',
  },
  US0404132054: {
    name: 'Arista Networks',
    foolTicker: 'ANET',
    foolSlugs: ['arista', 'arista-networks'],
    land: 'US',
  },
  US7757111049: {
    name: 'Rollins',
    foolTicker: 'ROL',
    foolSlugs: ['rollins'],
    land: 'US',
  },
  NL0000395903: {
    name: 'Wolters Kluwer',
    foolTicker: 'WKL',
    foolSlugs: ['wolters-kluwer'],
    land: 'NL',
  },
  US1729081059: {
    name: 'Cintas',
    foolTicker: 'CTAS',
    foolSlugs: ['cintas'],
    land: 'US',
  },
  DE0006580806: {
    name: 'Mensch und Maschine',
    foolTicker: 'MUM',
    foolSlugs: ['mensch-und-maschine', 'mensch-und-maschine-software'],
    land: 'DE',
  },
  DE000A0BVU28: {
    name: 'USU Software',
    foolTicker: 'USU',
    foolSlugs: ['usu'],
    land: 'DE',
  },
  US91680M1071: {
    name: 'Upstart Holdings',
    foolTicker: 'UPST',
    foolSlugs: ['upstart'],
    land: 'US',
  },
}

function stripBoersenSuffix(symbol: string): string {
  const s = symbol.trim().toUpperCase()
  if (!s.includes('.')) return s
  const [base, suffix] = s.split('.')
  if (suffix === 'TO' || suffix === 'V' || suffix === 'PA' || suffix === 'AS' || suffix === 'DE') {
    return base
  }
  if (suffix === 'SW') return base
  if (suffix === 'L' || suffix === 'SG' || suffix === 'HM') return base
  return base
}

export function earningsCallKenntnis(isin: string | null | undefined): EarningsCallKenntnis | null {
  if (!isin?.trim()) return null
  return EINTRAG[isin.trim().toUpperCase()] ?? null
}

/** Ticker + Name für Motley Fool / SEC / Finnhub aus ISIN und UI-Fallback. */
export function aufloeseEarningsCallKontext(anfrage: {
  ticker: string
  firmenname?: string | null
  isin?: string | null
}): {
  foolTicker: string
  symbolYahoo: string | null
  firmenname: string | null
  foolSlugs: string[]
  isUsSec: boolean
  irNurWebcast: boolean
  istEtf: boolean
} {
  const hard = earningsCallKenntnis(anfrage.isin)
  const k = isinKenntnis(anfrage.isin)

  let foolTicker = hard?.foolTicker ?? ''
  if (!foolTicker) {
    const sym = k?.symbolYahoo ?? anfrage.ticker
    foolTicker = stripBoersenSuffix(sym)
  }
  if (!foolTicker) {
    foolTicker = stripBoersenSuffix(anfrage.ticker)
  }

  const firmenname = anfrage.firmenname?.trim() || hard?.name || k?.name?.trim() || null
  const foolSlugs = [...new Set([...(hard?.foolSlugs ?? []), ...(k?.macrotrendsSlug ? [k.macrotrendsSlug] : [])])]

  const isin = anfrage.isin?.trim().toUpperCase() ?? ''
  const isUsSec =
    hard?.land === 'US' ||
    hard?.land === 'CA' ||
    isin.startsWith('US') ||
    isin.startsWith('CA')
  const irNurWebcast = hard?.irNurWebcast === true
  const istEtf = hard?.land === 'ETF' || isin.startsWith('IE00BJXR')
  const symbolYahoo = (k?.symbolYahoo ?? anfrage.ticker).trim().toUpperCase() || null

  return { foolTicker, symbolYahoo, firmenname, foolSlugs, isUsSec, irNurWebcast, istEtf }
}

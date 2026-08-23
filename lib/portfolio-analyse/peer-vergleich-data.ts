/** Peer-Gruppen für Sektor-Benchmark (Portfolio + typische Wettbewerber). */

import { analyseTickerFuerPosition } from '@/lib/portfolio-analyse/isin-kenntnisse'

const BOERSEN_SUFFIX = /\.(PA|AS|DE|SW|L|TO|HM|SG|MU|BR|MI|MC|HE|VI|ST|CO|OL|STU|F|BE|HA|DU|PR|WA)$/i

/** Yahoo/Macrotrends-Ticker ohne Börsensuffix für Map-Lookup. */
export function peerLookupKey(ticker: string): string {
  return ticker.trim().toUpperCase().replace(BOERSEN_SUFFIX, '')
}

/**
 * Symbol für Datenabruf (Macrotrends/Yahoo) — berücksichtigt ISIN-Kenntnisse.
 */
export function loesePeerDatenTicker(ticker: string, isin?: string | null): string {
  if (isin?.trim()) {
    return analyseTickerFuerPosition(isin, ticker)
  }
  const key = peerLookupKey(ticker)
  const alias: Record<string, string> = {
    H11: 'HLMA',
    MC: 'LVMUY',
    RMS: 'HESAY',
    WKL: 'WTKWY',
    STMN: 'SAUHY',
    SIKA: 'SXYAY',
    OSP2: 'USU',
  }
  return alias[key] ?? key
}

/** Kuratierte Peer-Listen je Lookup-Key (ohne Börsensuffix). */
export const PEER_NACH_TICKER: Record<string, string[]> = {
  // --- Cloud / Software ---
  MSFT: ['GOOG', 'ORCL', 'CRM', 'ADBE'],
  GOOG: ['MSFT', 'META', 'AMZN', 'AAPL'],
  NOW: ['CRM', 'WDAY', 'TEAM', 'SNOW'],
  DDOG: ['SNOW', 'MDB', 'NET', 'CRWD'],
  VEEV: ['CRM', 'HUBS', 'WDAY', 'HOLX'],

  // --- Payments ---
  MA: ['V', 'AXP', 'FI', 'GPN'],
  V: ['MA', 'AXP', 'FI', 'GPN'],

  // --- Data / Ratings / Exchanges ---
  SPGI: ['MSCI', 'MCO', 'ICE', 'CME'],
  MSCI: ['SPGI', 'MCO', 'ICE', 'NDAQ'],

  // --- Healthcare ---
  UNH: ['ELV', 'CI', 'HUM', 'CNC'],
  TMO: ['DHR', 'ABT', 'WAT', 'IQV'],
  RMD: ['PHG', 'NVST', 'DXCM', 'PODD'],
  ZTS: ['IDXX', 'ELAN', 'MRK', 'PFE'],

  // --- Industrials / Logistics ---
  ODFL: ['JBHT', 'KNX', 'XPO', 'SAIA'],
  WM: ['RSG', 'WCN', 'CWST', 'CLH'],
  UNP: ['CSX', 'NSC', 'CP', 'CNI'],
  GGG: ['ITW', 'ROP', 'IEX', 'DHR'],
  ANET: ['CSCO', 'HPE', 'DELL', 'JNPR'],
  ROL: ['ECL', 'ABM', 'CHE', 'BRC'],
  CTAS: ['UNF', 'ABM', 'FAST', 'RSG'],

  // --- Consumer ---
  MCD: ['YUM', 'CMG', 'QSR', 'SBUX'],
  HD: ['LOW', 'TSCO', 'WSM', 'FND'],
  ATD: ['MUSA', 'CASY', 'PSX', 'L'],

  // --- Chemicals / Materials ---
  BCPC: ['ECL', 'RPM', 'PPG', 'IFF'],
  LIN: ['APD', 'ECL', 'SHW', 'DD'],
  SIKA: ['PPG', 'SHW', 'RPM', 'ECL'],

  // --- Insurance ---
  KNSL: ['PGR', 'TRV', 'ALL', 'CB'],

  // --- Fintech ---
  UPST: ['SOFI', 'LC', 'AFRM', 'PYPL'],

  // --- Luxury (EU) ---
  MC: ['HESAY', 'PPRUY', 'CFRUY', 'MONC'],
  RMS: ['LVMUY', 'PPRUY', 'CFRUY', 'MONC'],
  LVMUY: ['HESAY', 'PPRUY', 'CFRUY', 'TPR'],
  HESAY: ['LVMUY', 'PPRUY', 'CFRUY', 'MONC'],

  // --- Semiconductors / Equipment ---
  ASML: ['AMAT', 'LRCX', 'KLAC', 'TSM'],

  // --- Professional Information ---
  WKL: ['RELX', 'TRI', 'MSCI', 'SPGI'],
  WTKWY: ['RELX', 'TRI', 'MSCI', 'SPGI'],

  // --- CAD / Enterprise Software (DE) ---
  MUM: ['NEM.DE', 'SAP', 'ADSK', 'DASTY'],
  USU: ['SAP', 'NEM.DE', 'SPS.SW', 'ORCL'],
  OSP2: ['SAP', 'NEM.DE', 'SPS.SW', 'ORCL'],

  // --- MedTech / Dental ---
  STMN: ['ALGN', 'XRAY', 'NVST', 'ISRG'],
  SAUHY: ['ALGN', 'XRAY', 'NVST', 'ISRG'],
  HLMA: ['ROP', 'ITW', 'DHR', 'IEX'],
  H11: ['ROP', 'ITW', 'DHR', 'IEX'],
}

/** ISIN → Peer-Override (z. B. wenn Ticker mehrdeutig). */
export const PEER_NACH_ISIN: Record<string, string[]> = {
  FR0000121014: ['HESAY', 'PPRUY', 'CFRUY', 'MONC'],
  FR0000052292: ['LVMUY', 'PPRUY', 'CFRUY', 'MONC'],
  NL0010273215: ['AMAT', 'LRCX', 'KLAC', 'TSM'],
  NL0000395903: ['RELX', 'TRI', 'MSCI', 'SPGI'],
  DE0006580806: ['NEM.DE', 'SAP', 'ADSK', 'DASTY'],
  DE000A0BVU28: ['SAP', 'NEM.DE', 'SPS.SW', 'ORCL'],
  GB0004052071: ['ROP', 'ITW', 'DHR', 'IEX'],
  CH1175448666: ['ALGN', 'XRAY', 'NVST', 'ISRG'],
  CH0418792922: ['PPG', 'SHW', 'RPM', 'ECL'],
  CA01626P1484: ['MUSA', 'CASY', 'PSX', 'L'],
}

export function peersFuerTicker(ticker: string, isin?: string | null): string[] {
  const isinNorm = isin?.trim().toUpperCase() ?? ''
  if (isinNorm && PEER_NACH_ISIN[isinNorm]?.length) {
    return [...new Set(PEER_NACH_ISIN[isinNorm].map((p) => p.toUpperCase()))].slice(0, 5)
  }

  const datenTicker = loesePeerDatenTicker(ticker, isin)
  const keys = [
    peerLookupKey(datenTicker),
    peerLookupKey(ticker),
    datenTicker,
    ticker.trim().toUpperCase(),
  ]

  for (const key of keys) {
    const peers = PEER_NACH_TICKER[key]
    if (peers?.length) {
      return [...new Set(peers.map((p) => p.toUpperCase()))].slice(0, 5)
    }
  }

  return []
}

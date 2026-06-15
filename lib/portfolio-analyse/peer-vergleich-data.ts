/** Peer-Gruppen für Sektor-Benchmark (Portfolio + typische Wettbewerber). */

export type PeerGruppe = {
  label: string
  /** Yahoo/Macrotrends-Ticker */
  ticker: string[]
}

/** Kuratierte Peer-Listen je US/EU-Ticker. */
export const PEER_NACH_TICKER: Record<string, string[]> = {
  MSFT: ['GOOG', 'ORCL', 'CRM', 'ADBE'],
  GOOG: ['MSFT', 'META', 'AMZN', 'AAPL'],
  MA: ['V', 'AXP', 'PYPL', 'FIS'],
  V: ['MA', 'AXP', 'PYPL', 'FIS'],
  SPGI: ['MSCI', 'MCO', 'ICE', 'CME'],
  MSCI: ['SPGI', 'MCO', 'ICE', 'NDAQ'],
  UNH: ['ELV', 'CI', 'HUM', 'CNC'],
  TMO: ['DHR', 'ABT', 'WAT', 'IQV'],
  NOW: ['CRM', 'WDAY', 'TEAM', 'SNOW'],
  RMD: ['PHG', 'FPH', 'NVST', 'DXCM'],
  ODFL: ['JBHT', 'KNX', 'XPO', 'SAIA'],
  WM: ['RSG', 'WCN', 'CWST', 'CLH'],
  UNP: ['CSX', 'NSC', 'CP', 'CNI'],
  ZTS: ['IDXX', 'ELAN', 'MRK', 'BMY'],
  MCD: ['YUM', 'CMG', 'QSR', 'SBUX'],
  DDOG: ['SNOW', 'MDB', 'NET', 'CRWD'],
  BCPC: ['LIN', 'APD', 'ECL', 'PPG'],
  LIN: ['APD', 'ECL', 'SHW', 'DD'],
  VEEV: ['CRM', 'HUBS', 'WDAY', 'DOCU'],
  KNSL: ['PGR', 'TRV', 'ALL', 'CB'],
  HD: ['LOW', 'TSCO', 'WSM', 'FND'],
  GGG: ['ITW', 'ROP', 'IEX', 'DHR'],
  ANET: ['CSCO', 'MSFT', 'HPE', 'JNPR'],
  ROL: ['ECL', 'ABM', 'CLH', 'RSG'],
  CTAS: ['UNF', 'ABM', 'ECL', 'RSG'],
  UPST: ['SOFI', 'LC', 'AFRM', 'PYPL'],
  ATD: ['MUSA', 'ARCO', 'CASY', 'PSX'],
  MC: ['RMS', 'KER', 'CFR', 'MONC'],
  RMS: ['MC', 'KER', 'CFR', 'TPR'],
  ASML: ['AMAT', 'LRCX', 'KLAC', 'TSM'],
  WKL: ['RELX', 'TRI', 'MSCI', 'SPGI'],
  MUM: ['SAP', 'ADYEN', 'SOW', 'NEM'],
  HLMA: ['ROP', 'ITW', 'DHR', 'IEX'],
  STMN: ['ALGN', 'XRAY', 'NVST', 'DHR'],
  SIKA: ['PPG', 'SHW', 'RPM', 'BCPC'],
}

export function peersFuerTicker(ticker: string, _isin?: string | null): string[] {
  const t = ticker.trim().toUpperCase().replace(/\.(PA|AS|DE|SW|L|TO|HM|SG|MU)$/i, '')
  const basis = ticker.trim().toUpperCase()
  const ausMap = PEER_NACH_TICKER[t] ?? PEER_NACH_TICKER[basis] ?? []
  return [...new Set(ausMap.map((p) => p.toUpperCase()))].slice(0, 5)
}

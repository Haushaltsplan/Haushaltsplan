import 'server-only'

import { isinAusYahooSymbol, ISIN_KENNTNISSE } from '@/lib/portfolio-analyse/isin-kenntnisse'

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/

function normTicker(symbol: string): string {
  return symbol.trim().toUpperCase().split('.')[0]!
}

const BEKANNTE_US_TICKER_ISIN: Record<string, string> = {
  AAPL: 'US0378331005',
  MSFT: 'US5949181045',
  GOOGL: 'US02079K3056',
  GOOG: 'US02079K1079',
  AMZN: 'US0231351067',
  META: 'US30303M1027',
  NVDA: 'US67066G1040',
  TSLA: 'US88160R1014',
  NFLX: 'US64110L1061',
  AMD: 'US0079031078',
  INTC: 'US4581401001',
  CRM: 'US79466L3024',
  ORCL: 'US68389X1054',
  ADBE: 'US00724F1012',
  AVGO: 'US11135F1012',
  COST: 'US22160K1051',
  PEP: 'US7134481081',
  KO: 'US1912161007',
  JPM: 'US46625H1005',
  V: 'US92826C8394',
  MA: 'US57636Q1040',
  UNH: 'US91324P1021',
  JNJ: 'US4781601046',
  WMT: 'US9311421039',
  HD: 'US4370761029',
  MCD: 'US5801351017',
  DIS: 'US2546871060',
  BA: 'US0970231058',
  NKE: 'US6541061031',
  ACN: 'IE00B4BNMY34',
  SBUX: 'US8552441094',
  PYPL: 'US70450Y1038',
  SHOP: 'CA82509L1076',
  UBER: 'US90353T1007',
  ABNB: 'US0090661010',
  COIN: 'US19260Q1076',
  SQ: 'US8522341036',
  SNAP: 'US83304A1060',
  PINS: 'US72352L1061',
  SPOT: 'LU1778762911',
  ASML: 'USN070592100',
  SAP: 'US8030542042',
  NOW: 'US81762P1021',
  VEEV: 'US9224751084',
  ANET: 'US0404132054',
  DDOG: 'US23804L1035',
}

// Kenntnisse-Whitelist automatisch eintragen (Nachkauf + Portfolio)
for (const [isin, k] of Object.entries(ISIN_KENNTNISSE)) {
  const syms = [
    k.symbolYahoo,
    k.kursNurSymbol,
    ...(k.symbolCandidates ?? []),
  ].filter(Boolean) as string[]
  for (const s of syms) {
    const basis = normTicker(s)
    if (basis && !BEKANNTE_US_TICKER_ISIN[basis]) {
      BEKANNTE_US_TICKER_ISIN[basis] = isin
    }
  }
}

async function finnhubIsinFuerSymbol(symbol: string): Promise<string | null> {
  const key = (process.env.FINNHUB_API_KEY ?? '').trim()
  if (!key) return null

  const kandidaten = [symbol.trim(), symbol.split('.')[0]?.trim()].filter(Boolean) as string[]
  const uniq = [...new Set(kandidaten.map((s) => s.toUpperCase()))]

  for (const sym of uniq) {
    const u = new URL('https://finnhub.io/api/v1/stock/profile2')
    u.searchParams.set('symbol', sym)
    u.searchParams.set('token', key)
    try {
      const res = await fetch(u.toString(), { next: { revalidate: 86400 } })
      if (!res.ok) continue
      const j = (await res.json()) as { isin?: string }
      const isin = j.isin?.trim().toUpperCase()
      if (isin && ISIN_RE.test(isin)) return isin
    } catch {
      /* nächster Kandidat */
    }
  }
  return null
}

/** DivvyDiary-Symbolsuche — öffentliche API, liefert ISIN für fast alle Ticker (auch ohne Finnhub-Premium). */
async function divvydiaryIsinFuerSymbol(symbol: string): Promise<string | null> {
  const kandidaten = [...new Set([symbol.trim().toUpperCase(), normTicker(symbol)])].filter(Boolean)

  for (const sym of kandidaten) {
    const u = new URL('https://api.divvydiary.com/symbols')
    u.searchParams.set('search', sym)
    try {
      const res = await fetch(u.toString(), {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
        next: { revalidate: 86400 },
      })
      if (!res.ok) continue
      const j = (await res.json()) as {
        symbols?: Array<{ symbol?: string; isin?: string; securityType?: string }>
      }
      const hit = (j.symbols ?? []).find(
        (s) =>
          s.symbol?.trim().toUpperCase() === sym &&
          (s.securityType ?? 'EQUITY').toUpperCase() === 'EQUITY' &&
          s.isin &&
          ISIN_RE.test(s.isin.trim().toUpperCase()),
      )
      if (hit?.isin) return hit.isin.trim().toUpperCase()
    } catch {
      /* nächster Kandidat */
    }
  }
  return null
}

/** ISIN für Yahoo-/US-Ticker auflösen (Finnhub → Kenntnisse → Fallback-Map → DivvyDiary). */
export async function loeseIsinFuerTicker(symbol: string): Promise<string | null> {
  const sym = symbol.trim()
  if (!sym) return null

  const viaFinnhub = await finnhubIsinFuerSymbol(sym)
  if (viaFinnhub) return viaFinnhub

  const viaKenntnis = isinAusYahooSymbol(sym)
  if (viaKenntnis) return viaKenntnis

  const basis = normTicker(sym)
  if (BEKANNTE_US_TICKER_ISIN[basis]) return BEKANNTE_US_TICKER_ISIN[basis]

  return divvydiaryIsinFuerSymbol(sym)
}

export function istGueltigeIsinFormat(isin: string): boolean {
  return ISIN_RE.test(isin.trim().toUpperCase())
}

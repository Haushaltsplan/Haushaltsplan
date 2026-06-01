import { yahooSymbolAbsichern, yahooSymbolAusTicker } from '@/lib/portfolio-analyse/isin-yahoo-symbol'

export type IsinMetadata = {
  isin: string
  name: string
  symbolYahoo: string | null
  assetType: string | null
}

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Referer: 'https://finance.yahoo.com/',
  Accept: 'application/json',
} as const

const DE_EXCH = new Set(['GY', 'GR', 'GT', 'GF', 'GD', 'GS', 'GM', 'DE', 'XETRA', 'XETR'])
const LN_EXCH = new Set(['LN', 'L'])

function normalisiereIsin(isin: string): string | null {
  const s = isin.trim().toUpperCase()
  return ISIN_RE.test(s) ? s : null
}

type OpenFigiRow = {
  ticker?: string
  name?: string
  exchCode?: string
  securityType?: string
  marketSector?: string
  securityType2?: string
}

async function openFigiLookup(isins: string[]): Promise<Map<string, OpenFigiRow[]>> {
  const out = new Map<string, OpenFigiRow[]>()
  if (isins.length === 0) return out

  const body = isins.map((idValue) => ({ idType: 'ID_ISIN', idValue }))
  const res = await fetch('https://api.openfigi.com/v3/mapping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    next: { revalidate: 86400 },
  })
  if (!res.ok) return out

  const rows = (await res.json()) as Array<{ data?: OpenFigiRow[] | null; error?: string }>
  for (let i = 0; i < isins.length; i++) {
    const data = rows[i]?.data?.filter((r) => r.ticker && r.exchCode) ?? []
    if (data.length > 0) out.set(isins[i], data)
  }
  return out
}

function istEtfZeile(row: OpenFigiRow): boolean {
  const t = `${row.securityType ?? ''} ${row.securityType2 ?? ''} ${row.marketSector ?? ''}`.toLowerCase()
  return t.includes('etf') || t.includes('etp') || t.includes('fund')
}

function waehleOpenFigiZeile(rows: OpenFigiRow[]): OpenFigiRow | null {
  if (rows.length === 0) return null
  const etfs = rows.filter(istEtfZeile)
  const pool = etfs.length > 0 ? etfs : rows

  for (const ex of DE_EXCH) {
    const hit = pool.find((r) => r.exchCode?.toUpperCase() === ex)
    if (hit) return hit
  }
  for (const ex of LN_EXCH) {
    const hit = pool.find((r) => r.exchCode?.toUpperCase() === ex)
    if (hit) return hit
  }
  return pool[0] ?? null
}

type YahooQuote = {
  symbol?: string
  longname?: string
  shortname?: string
  quoteType?: string
  exchange?: string
}

async function yahooSearchIsin(isin: string): Promise<YahooQuote[]> {
  const u = new URL('https://query1.finance.yahoo.com/v1/finance/search')
  u.searchParams.set('q', isin)
  u.searchParams.set('quotesCount', '12')
  u.searchParams.set('newsCount', '0')
  const res = await fetch(u.toString(), { headers: YAHOO_HEADERS, next: { revalidate: 86400 } })
  if (!res.ok) return []
  const j = (await res.json()) as { quotes?: YahooQuote[] }
  return j.quotes ?? []
}

function symbolAusYahooQuote(q: YahooQuote): string | null {
  const sym = q.symbol?.trim()
  if (!sym) return null
  const typ = (q.quoteType ?? '').toUpperCase()
  if (typ && typ !== 'ETF' && typ !== 'MUTUALFUND' && typ !== 'EQUITY') return null
  return sym
}

function waehleYahooQuote(quotes: YahooQuote[]): YahooQuote | null {
  const etfQuotes = quotes
    .map((q) => ({ q, sym: symbolAusYahooQuote(q) }))
    .filter((x): x is { q: YahooQuote; sym: string } => x.sym != null)
    .filter(({ q }) => {
      const typ = (q.quoteType ?? '').toUpperCase()
      return typ === 'ETF' || typ === 'MUTUALFUND'
    })

  const pool = etfQuotes.length > 0 ? etfQuotes : quotes.map((q) => ({ q, sym: symbolAusYahooQuote(q) })).filter((x): x is { q: YahooQuote; sym: string } => x.sym != null)

  const de = pool.find(({ sym }) => sym.endsWith('.DE') || sym.endsWith('.F') || sym.endsWith('.PA'))
  if (de) return de.q

  const london = pool.find(({ sym }) => sym.endsWith('.L'))
  if (london) return london.q

  return pool[0]?.q ?? null
}

function nameAusOpenFigi(row: OpenFigiRow): string {
  const raw = (row.name ?? row.ticker ?? '').trim()
  if (!raw) return ''
  return raw
    .split(/\s+/)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ')
}

/** Öffentliche ISIN-Metadaten (keine Nutzerdaten). */
export async function lookupIsinMetadaten(isins: string[]): Promise<IsinMetadata[]> {
  const unique = [...new Set(isins.map(normalisiereIsin).filter((x): x is string => x != null))].slice(0, 80)
  if (unique.length === 0) return []

  const figiMap = await openFigiLookup(unique)
  const results: IsinMetadata[] = []

  for (const isin of unique) {
    const yahooQuotes = await yahooSearchIsin(isin)
    const yahooPick = waehleYahooQuote(yahooQuotes)

    const figiRows = figiMap.get(isin) ?? []
    const figi = waehleOpenFigiZeile(figiRows)

    let symbolYahoo: string | null = null
    let name = isin
    let assetType: string | null = null

    if (figi?.ticker && figi.exchCode) {
      symbolYahoo = yahooSymbolAbsichern(figi.ticker, figi.exchCode)
      name = nameAusOpenFigi(figi) || figi.ticker
      assetType = figi.securityType ?? figi.securityType2 ?? null
    }

    if (yahooPick) {
      const ySym = symbolAusYahooQuote(yahooPick)
      const yName = (yahooPick.longname ?? yahooPick.shortname ?? ySym ?? '').trim()
      if (ySym) {
        const yIsDe = ySym.endsWith('.DE') || ySym.endsWith('.F')
        const curIsBareUs =
          symbolYahoo != null && !symbolYahoo.includes('.') && isin.startsWith('IE')
        if (!symbolYahoo || yIsDe || curIsBareUs) {
          symbolYahoo = ySym
        }
      }
      if (yName.length > 2) name = yName
    }

    if (symbolYahoo === 'CYBR') symbolYahoo = 'CYBR.L'
    if (symbolYahoo === 'CYBP.L') {
      const alt = figi?.ticker && figi.exchCode ? yahooSymbolAbsichern(figi.ticker, figi.exchCode) : 'CYBR.L'
      symbolYahoo = alt === 'CYBP.L' ? 'RCRS.DE' : alt
    }

    results.push({
      isin,
      name,
      symbolYahoo: symbolYahoo || null,
      assetType,
    })
  }

  return results
}

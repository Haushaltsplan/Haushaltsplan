import { yahooSymbolAusTicker } from '@/lib/portfolio-analyse/isin-yahoo-symbol'

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
}

async function openFigiLookup(isins: string[]): Promise<Map<string, OpenFigiRow>> {
  const out = new Map<string, OpenFigiRow>()
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
    const hit = rows[i]?.data?.[0]
    if (hit?.ticker) out.set(isins[i], hit)
  }
  return out
}

async function yahooSearchIsin(isin: string): Promise<{ name: string; symbolYahoo: string } | null> {
  const u = new URL('https://query1.finance.yahoo.com/v1/finance/search')
  u.searchParams.set('q', isin)
  u.searchParams.set('quotesCount', '6')
  u.searchParams.set('newsCount', '0')
  const res = await fetch(u.toString(), { headers: YAHOO_HEADERS, next: { revalidate: 86400 } })
  if (!res.ok) return null
  const j = (await res.json()) as {
    quotes?: Array<{ symbol?: string; longname?: string; shortname?: string; quoteType?: string }>
  }
  for (const q of j.quotes ?? []) {
    const sym = q.symbol?.trim()
    if (!sym) continue
    const name = (q.longname ?? q.shortname ?? sym).trim()
    if (q.quoteType === 'EQUITY' || q.quoteType === 'ETF' || q.quoteType === 'MUTUALFUND') {
      return { name, symbolYahoo: sym }
    }
  }
  const first = j.quotes?.[0]
  if (first?.symbol) {
    return {
      name: (first.longname ?? first.shortname ?? first.symbol).trim(),
      symbolYahoo: first.symbol.trim(),
    }
  }
  return null
}

function nameAusOpenFigi(row: OpenFigiRow): string {
  const raw = (row.name ?? row.ticker ?? '').trim()
  if (!raw) return ''
  return raw
    .replace(/\s+(INC|CORP|LTD|PLC|AG|SE|SA|NV|GROUP)\.?$/i, (m) => m)
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
    const figi = figiMap.get(isin)
    if (figi?.ticker && figi.exchCode) {
      const symbolYahoo = yahooSymbolAusTicker(figi.ticker, figi.exchCode)
      const name = nameAusOpenFigi(figi) || figi.ticker
      results.push({
        isin,
        name,
        symbolYahoo: symbolYahoo || null,
        assetType: figi.securityType ?? figi.marketSector ?? null,
      })
      continue
    }

    const yahoo = await yahooSearchIsin(isin)
    if (yahoo) {
      results.push({
        isin,
        name: yahoo.name,
        symbolYahoo: yahoo.symbolYahoo,
        assetType: null,
      })
    } else {
      results.push({
        isin,
        name: isin,
        symbolYahoo: null,
        assetType: null,
      })
    }
  }

  return results
}

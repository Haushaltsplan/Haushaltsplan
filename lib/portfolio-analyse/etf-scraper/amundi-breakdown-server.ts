import 'server-only'

import type { EtfBreakdown } from '@/lib/portfolio-analyse/parqet-core/types'

const AMUNDI_PRODUCT_API = 'https://www.amundietf.de/mapi/ProductAPI/getProductsData'

const AGGREGATION_FIELDS = [
  'INDEX_TOP10',
  'FUND_TOP10',
  'INDEX_SECTORS',
  'FUND_SECTORS',
  'INDEX_COUNTRIES',
  'FUND_COUNTRIES',
] as const

type AmundiBreakDownRow = {
  aggregationName?: string
  weight?: number
  adjustedWeight?: number
  additionalProperties?: {
    isin?: string
    bbg?: string
    sector?: string
    countryOfRisk?: string
  } | null
}

type AmundiBreakDown = {
  aggregationField?: string
  breakDownData?: AmundiBreakDownRow[]
}

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  'United States': 'US',
  'United Kingdom': 'GB',
  'Germany': 'DE',
  'France': 'FR',
  'Switzerland': 'CH',
  'Netherlands': 'NL',
  'Ireland': 'IE',
  'Canada': 'CA',
  'Japan': 'JP',
  'China': 'CN',
  'Taiwan': 'TW',
  'India': 'IN',
  'Australia': 'AU',
  'Spain': 'ES',
  'Italy': 'IT',
  'Sweden': 'SE',
  'Denmark': 'DK',
  'Norway': 'NO',
  'Finland': 'FI',
  'Belgium': 'BE',
  'Austria': 'AT',
  'Brazil': 'BR',
  'Mexico': 'MX',
  'South Korea': 'KR',
  'Korea (South)': 'KR',
  'Hong Kong': 'HK',
  'Singapore': 'SG',
}

function pctFromRow(row: AmundiBreakDownRow): number | null {
  const raw = row.adjustedWeight ?? row.weight
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null
  return raw <= 1 ? raw * 100 : raw
}

function symbolAusBbg(bbg: string | undefined): string | undefined {
  const token = bbg?.trim().split(/\s+/)[0]
  return token || undefined
}

function countryCode(name: string): string {
  const trimmed = name.trim()
  return COUNTRY_NAME_TO_CODE[trimmed] ?? trimmed
}

function pickBreakDown(breakDowns: AmundiBreakDown[], primary: string, fallback: string): AmundiBreakDownRow[] {
  const primaryRows = breakDowns.find((b) => b.aggregationField === primary)?.breakDownData
  if (primaryRows?.length) return primaryRows
  return breakDowns.find((b) => b.aggregationField === fallback)?.breakDownData ?? []
}

function parseTopHoldings(rows: AmundiBreakDownRow[]): EtfBreakdown['topHoldings'] {
  return rows
    .map((row) => {
      const pct = pctFromRow(row)
      const name = row.aggregationName?.trim()
      if (!name || pct == null) return null
      const out: { name: string; symbol?: string; percentage: number } = { name, percentage: pct }
      const symbol = symbolAusBbg(row.additionalProperties?.bbg)
      if (symbol) out.symbol = symbol
      return out
    })
    .filter((x): x is { name: string; symbol?: string; percentage: number } => x != null)
}

function parseSectors(rows: AmundiBreakDownRow[]): EtfBreakdown['sectors'] {
  return rows
    .map((row) => {
      const pct = pctFromRow(row)
      const sectorName = row.aggregationName?.trim()
      if (!sectorName || pct == null) return null
      return { sectorName, percentage: pct }
    })
    .filter((x): x is { sectorName: string; percentage: number } => x != null)
}

function parseCountries(rows: AmundiBreakDownRow[]): EtfBreakdown['countries'] {
  return rows
    .map((row) => {
      const pct = pctFromRow(row)
      const name = row.aggregationName?.trim()
      if (!name || pct == null) return null
      return { countryCode: countryCode(name), percentage: pct }
    })
    .filter((x): x is { countryCode: string; percentage: number } => x != null)
}

/** Top-Holdings & Allokation über Amundis öffentliche Product-API (UCITS-ETFs). */
export async function ladeAmundiEtfBreakdown(isin: string): Promise<EtfBreakdown | null> {
  const id = isin.trim().toUpperCase()
  if (!id) return null

  try {
    const res = await fetch(AMUNDI_PRODUCT_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; MeinHaushalt/1.0)',
      },
      body: JSON.stringify({
        productIds: [id],
        context: { bcp47Code: 'de-DE', countryCode: 'DEU' },
        breakDown: { aggregationFields: AGGREGATION_FIELDS },
      }),
      cache: 'no-store',
    })
    if (!res.ok) return null

    const j = (await res.json()) as { products?: Array<{ breakDowns?: AmundiBreakDown[] }> }
    const breakDowns = j.products?.[0]?.breakDowns
    if (!breakDowns?.length) return null

    const topHoldings = parseTopHoldings(
      pickBreakDown(breakDowns, 'INDEX_TOP10', 'FUND_TOP10'),
    )
    if (topHoldings.length === 0) return null

    return {
      topHoldings,
      sectors: parseSectors(pickBreakDown(breakDowns, 'INDEX_SECTORS', 'FUND_SECTORS')),
      countries: parseCountries(pickBreakDown(breakDowns, 'INDEX_COUNTRIES', 'FUND_COUNTRIES')),
    }
  } catch {
    return null
  }
}

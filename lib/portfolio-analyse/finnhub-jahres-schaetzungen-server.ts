import 'server-only'

const CACHE_REVALIDATE = 3600

function finnhubKey(): string | null {
  const k = (process.env.FINNHUB_API_KEY ?? '').trim()
  return k.length > 0 ? k : null
}

function finnhubSymbole(sym: string): string[] {
  const s = sym.trim().toUpperCase()
  if (!s) return []
  const out = [s]
  const m = /^([A-Z0-9-]+)\.([A-Z]{1,3})$/.exec(s)
  if (m && !out.includes(m[1]!)) out.push(m[1]!)
  return out
}

type EstimateRow = {
  period?: string
  year?: number
  quarter?: number
  revenueAvg?: number
  epsAvg?: number
}

export type FinnhubJahresForecast = {
  quelle: 'finnhub'
  fy0Jahr: number | null
  fy1Jahr: number | null
  umsatzUsdFy0: number | null
  umsatzUsdFy1: number | null
  epsFy0: number | null
  epsFy1: number | null
}

async function ladeAnnualEstimates(symbol: string, kind: 'revenue' | 'eps'): Promise<EstimateRow[]> {
  const key = finnhubKey()
  if (!key) return []

  const endpoint =
    kind === 'revenue'
      ? 'https://finnhub.io/api/v1/stock/revenue-estimate'
      : 'https://finnhub.io/api/v1/stock/eps-estimate'

  for (const sym of finnhubSymbole(symbol)) {
    const u = new URL(endpoint)
    u.searchParams.set('symbol', sym)
    u.searchParams.set('freq', 'annual')
    u.searchParams.set('token', key)
    try {
      const res = await fetch(u.toString(), { next: { revalidate: CACHE_REVALIDATE } })
      if (!res.ok) continue
      const j = (await res.json()) as { data?: EstimateRow[] }
      const rows = j.data ?? []
      if (rows.length > 0) return rows
    } catch {
      continue
    }
  }
  return []
}

function naechsteAnnualZeilen(rows: EstimateRow[]): EstimateRow[] {
  const heuteJahr = new Date().getUTCFullYear()
  const sorted = [...rows]
    .filter((r) => r.year != null && r.year >= heuteJahr - 1)
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
  const future = sorted.filter((r) => (r.year ?? 0) >= heuteJahr)
  return (future.length >= 2 ? future.slice(0, 2) : sorted.slice(-2)).slice(0, 2)
}

/** Finnhub Annual Revenue/EPS Estimates (API-Key nötig). */
export async function ladeFinnhubJahresForecast(symbol: string): Promise<FinnhubJahresForecast | null> {
  const [revRows, epsRows] = await Promise.all([
    ladeAnnualEstimates(symbol, 'revenue'),
    ladeAnnualEstimates(symbol, 'eps'),
  ])
  if (revRows.length === 0 && epsRows.length === 0) return null

  const revFuture = naechsteAnnualZeilen(revRows)
  const epsFuture = naechsteAnnualZeilen(epsRows)

  return {
    quelle: 'finnhub',
    fy0Jahr: revFuture[0]?.year ?? epsFuture[0]?.year ?? null,
    fy1Jahr: revFuture[1]?.year ?? epsFuture[1]?.year ?? null,
    umsatzUsdFy0: revFuture[0]?.revenueAvg ?? null,
    umsatzUsdFy1: revFuture[1]?.revenueAvg ?? null,
    epsFy0: epsFuture[0]?.epsAvg ?? null,
    epsFy1: epsFuture[1]?.epsAvg ?? null,
  }
}

import 'server-only'

import { beatMissSymbolKandidaten } from '@/lib/portfolio-analyse/beat-miss-symbole'

const CACHE_REVALIDATE = 3600

type FinnhubEarningsRow = {
  actual?: number
  estimate?: number
  period?: string
  quarter?: number
  year?: number
  surprisePercent?: number
}

export type FinnhubBeatMissZeile = {
  quartalLabel: string
  period: string | null
  epsIst: number | null
  epsSchaetzung: number | null
  surprisePercent: number | null
}

function finnhubKey(): string | null {
  const k = (process.env.FINNHUB_API_KEY ?? '').trim()
  return k.length > 0 ? k : null
}

function quartalLabel(q: number | null | undefined, jahr: number | null | undefined): string | null {
  if (q != null && jahr != null) return `Q${q} ${jahr}`
  return null
}

function mappeFinnhubRows(rows: FinnhubEarningsRow[]): FinnhubBeatMissZeile[] {
  const out: FinnhubBeatMissZeile[] = []
  for (const row of rows) {
    if (row.actual == null && row.estimate == null) continue
    const label = quartalLabel(row.quarter, row.year)
    if (!label) continue
    out.push({
      quartalLabel: label,
      period: row.period?.slice(0, 10) ?? null,
      epsIst: row.actual ?? null,
      epsSchaetzung: row.estimate ?? null,
      surprisePercent: row.surprisePercent ?? null,
    })
  }
  out.sort((a, b) => (b.period ?? b.quartalLabel).localeCompare(a.period ?? a.quartalLabel))
  return out
}

export async function ladeFinnhubBeatMissHistorie(opts: {
  ticker: string
  symbolYahoo?: string | null
  isin?: string | null
  limit?: number
}): Promise<FinnhubBeatMissZeile[]> {
  const key = finnhubKey()
  if (!key) return []

  const symbole = beatMissSymbolKandidaten(opts)
  const limit = opts.limit ?? 8
  let best: FinnhubBeatMissZeile[] = []

  for (const sym of symbole) {
    const u = new URL('https://finnhub.io/api/v1/stock/earnings')
    u.searchParams.set('symbol', sym)
    u.searchParams.set('token', key)

    try {
      const res = await fetch(u.toString(), { next: { revalidate: CACHE_REVALIDATE } })
      if (!res.ok) continue
      const raw = await res.json()
      if (!Array.isArray(raw) || raw.length === 0) continue
      const rows = mappeFinnhubRows(raw as FinnhubEarningsRow[])
      if (rows.length > best.length) best = rows
      if (best.length >= limit) break
    } catch {
      continue
    }
  }

  return best.slice(0, limit)
}

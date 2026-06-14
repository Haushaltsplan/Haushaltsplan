'use client'

import type { EtfBreakdown } from '@/lib/portfolio-analyse/parqet-core/types'
import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'

const clientCache = new Map<string, EtfBreakdown | null>()

export function etfBreakdownMapAusRecord(record: Record<string, EtfBreakdown>): Map<string, EtfBreakdown> {
  return new Map(Object.entries(record).map(([k, v]) => [k.toUpperCase(), v]))
}

export async function ladeEtfBreakdownsFuerPositionen(
  positionen: LivePosition[],
  meta: Map<string, IsinMetadata>,
): Promise<Map<string, EtfBreakdown>> {
  const etfs = positionen.filter((p) => p.assetKlasse === 'etf' && p.isin && p.wertLiveEur > 0)
  if (!etfs.length) return new Map()

  const fehlend: Array<{ isin: string; symbolYahoo: string | null }> = []
  const out = new Map<string, EtfBreakdown>()

  for (const p of etfs) {
    const isin = p.isin!.trim().toUpperCase()
    if (clientCache.has(isin)) {
      const hit = clientCache.get(isin)
      if (hit) out.set(isin, hit)
      continue
    }
    const m = meta.get(isin)
    const symbolYahoo = m?.symbolYahoo ?? m?.symbolCandidates?.[0] ?? null
    fehlend.push({ isin, symbolYahoo })
  }

  if (fehlend.length === 0) return out

  try {
    const res = await fetch('/api/portfolio-analyse/etf-breakdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etfs: fehlend }),
      signal: AbortSignal.timeout(60_000),
    })
    const j = (await res.json()) as { ok?: boolean; breakdowns?: Record<string, EtfBreakdown> }
    if (!res.ok || !j.ok || !j.breakdowns) return out

    for (const req of fehlend) {
      const isin = req.isin.toUpperCase()
      const hit = j.breakdowns[isin] ?? j.breakdowns[req.isin]
      clientCache.set(isin, hit ?? null)
      if (hit) out.set(isin, hit)
    }
  } catch {
    /* offline */
  }

  return out
}

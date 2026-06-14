import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import type { SinglePortfolioReport } from '@/lib/portfolio-analyse/parqet-core/types'
import type { SektorBatchEintrag, SektorBatchItem } from '@/lib/portfolio-analyse/sektor-batch-server'

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/

export type FundamentalSektorLookup = {
  byIsin: Map<string, string>
  bySymbol: Map<string, string>
}

export const LEERER_SEKTOR_LOOKUP: FundamentalSektorLookup = {
  byIsin: new Map(),
  bySymbol: new Map(),
}

function gruppenLabel(entry: SektorBatchEintrag): string | null {
  return entry.sektor ?? entry.branche ?? null
}

export function lookupAusSektorBatch(raw: Record<string, SektorBatchEintrag>): FundamentalSektorLookup {
  const byIsin = new Map<string, string>()
  const bySymbol = new Map<string, string>()

  for (const [key, entry] of Object.entries(raw)) {
    const label = gruppenLabel(entry)
    if (!label) continue
    const k = key.trim().toUpperCase()
    if (ISIN_RE.test(k)) {
      byIsin.set(k, label)
      continue
    }
    bySymbol.set(k, label)
    bySymbol.set(k.split('.')[0]!, label)
  }

  return { byIsin, bySymbol }
}

export function sammleSektorAnfragen(
  positionen: LivePosition[],
  meta: Map<string, IsinMetadata>,
  report: SinglePortfolioReport | null,
  xrayAn: boolean,
): SektorBatchItem[] {
  const seen = new Set<string>()
  const items: SektorBatchItem[] = []

  const add = (item: SektorBatchItem) => {
    const isin = item.isin?.trim().toUpperCase()
    const sym = item.symbolYahoo?.trim().toUpperCase()
    const key = isin ?? sym ?? item.name?.trim()
    if (!key || seen.has(key)) return
    seen.add(key)
    items.push({ isin, symbolYahoo: sym ?? null, name: item.name ?? null })
  }

  for (const p of positionen) {
    if (p.wertLiveEur <= 0) continue
    const isin = p.isin?.trim().toUpperCase()
    const sym = (p.symbolYahoo ?? (isin ? meta.get(isin)?.symbolYahoo : null))?.trim().toUpperCase() ?? null
    add({ isin, symbolYahoo: sym, name: p.anzeigeName })
  }

  if (xrayAn && report) {
    for (const h of report.xRay.topHoldings) {
      if (h.valueEUR <= 0 && h.weightPercent <= 0) continue
      const key = h.key.trim().toUpperCase()
      if (ISIN_RE.test(key)) continue
      add({ symbolYahoo: key, name: h.label })
    }
  }

  return items
}

export async function ladeFundamentalSektoren(
  items: SektorBatchItem[],
): Promise<FundamentalSektorLookup> {
  if (items.length === 0) return LEERER_SEKTOR_LOOKUP

  const res = await fetch('/api/portfolio-analyse/sektor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  const j = (await res.json()) as { ok?: boolean; sektoren?: Record<string, SektorBatchEintrag> }
  if (!res.ok || !j.ok || !j.sektoren) return LEERER_SEKTOR_LOOKUP
  return lookupAusSektorBatch(j.sektoren)
}

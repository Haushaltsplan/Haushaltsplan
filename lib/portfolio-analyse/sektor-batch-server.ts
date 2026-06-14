import 'server-only'

import { brokerSymbolKandidaten } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { formatiereBrancheDe } from '@/lib/portfolio-analyse/fundamentaldaten-unternehmen-de'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import {
  holeYahooFinanceAuth,
  YAHOO_FINANCE_FETCH_HEADERS,
} from '@/lib/portfolio-analyse/yahoo-finance-auth-server'

export type SektorBatchItem = {
  isin?: string | null
  symbolYahoo?: string | null
  name?: string | null
}

export type SektorBatchEintrag = {
  sektor: string | null
  branche: string | null
}

const CACHE_MS = 7 * 24 * 60 * 60 * 1000
const cache = new Map<string, { at: number; data: SektorBatchEintrag }>()

function symboleFuerItem(item: SektorBatchItem): string[] {
  const out = new Set<string>()
  const add = (s?: string | null) => {
    for (const t of brokerSymbolKandidaten(s ?? '')) {
      if (t) out.add(t.trim().toUpperCase())
    }
  }
  add(item.symbolYahoo)
  const isin = item.isin?.trim().toUpperCase()
  if (isin) {
    const k = isinKenntnis(isin)
    add(k?.symbolYahoo)
    for (const s of k?.symbolCandidates ?? []) add(s)
  }
  return [...out]
}

async function yahooBrancheFuerSymbol(basisSymbol: string): Promise<SektorBatchEintrag> {
  const sym = basisSymbol.trim().toUpperCase().split('.')[0]!
  if (!sym) return { sektor: null, branche: null }

  const hit = cache.get(sym)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  const auth = await holeYahooFinanceAuth()
  if (!auth) {
    const leer = { sektor: null, branche: null }
    cache.set(sym, { at: Date.now(), data: leer })
    return leer
  }

  const u = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}`)
  u.searchParams.set('modules', 'assetProfile')
  u.searchParams.set('crumb', auth.crumb)

  try {
    const res = await fetch(u.toString(), {
      headers: { ...YAHOO_FINANCE_FETCH_HEADERS, Cookie: auth.cookie },
      cache: 'no-store',
    })
    if (!res.ok) {
      const leer = { sektor: null, branche: null }
      cache.set(sym, { at: Date.now(), data: leer })
      return leer
    }
    const j = (await res.json()) as {
      quoteSummary?: { result?: Array<{ assetProfile?: { sector?: string; industry?: string } }> }
    }
    const ap = j.quoteSummary?.result?.[0]?.assetProfile
    const meta = formatiereBrancheDe({ sector: ap?.sector, industry: ap?.industry })
    const data: SektorBatchEintrag = { sektor: meta.sektor, branche: meta.branche }
    cache.set(sym, { at: Date.now(), data })
    return data
  } catch {
    const leer = { sektor: null, branche: null }
    cache.set(sym, { at: Date.now(), data: leer })
    return leer
  }
}

/** Gleiche Sektor/Branche-Quelle wie Fundamentaldaten (Yahoo assetProfile + DE-Labels). */
export async function holeSektorenBatch(
  items: SektorBatchItem[],
): Promise<Record<string, SektorBatchEintrag>> {
  const result: Record<string, SektorBatchEintrag> = {}
  const symbolZuItems = new Map<string, SektorBatchItem[]>()

  for (const item of items.slice(0, 120)) {
    const symbole = symboleFuerItem(item)
    const basis = symbole[0]
    if (!basis) continue
    const list = symbolZuItems.get(basis) ?? []
    list.push(item)
    symbolZuItems.set(basis, list)
  }

  for (let i = 0; i < [...symbolZuItems.entries()].length; i += 12) {
    const chunk = [...symbolZuItems.entries()].slice(i, i + 12)
    await Promise.all(
      chunk.map(async ([basis, related]) => {
        const data = await yahooBrancheFuerSymbol(basis)
        for (const item of related) {
          const isin = item.isin?.trim().toUpperCase()
          if (isin) result[isin] = data
          for (const sym of symboleFuerItem(item)) {
            result[sym] = data
            result[sym.split('.')[0]!] = data
          }
        }
      }),
    )
  }

  return result
}

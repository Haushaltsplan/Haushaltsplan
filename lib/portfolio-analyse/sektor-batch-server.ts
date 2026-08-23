import 'server-only'

import { brokerSymbolKandidaten } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { formatiereBrancheDe } from '@/lib/portfolio-analyse/fundamentaldaten-unternehmen-de'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import {
  ladeSektorenAusCloud,
  speichereSektorenInCloud,
} from '@/lib/portfolio-analyse/sektor-cache-cloud-server'
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
  // Volle Yahoo-Symbole zuerst (WKL.AS, SIKA.SW, H11.SG) — kein blindes Strippen der Börse.
  const raw = basisSymbol.trim().toUpperCase()
  if (!raw) return { sektor: null, branche: null }
  const bare = raw.split('.')[0]!
  const kandidaten = raw.includes('.') && bare !== raw ? [raw, bare] : [raw]

  for (const sym of kandidaten) {
    const hit = cache.get(sym)
    if (hit && Date.now() - hit.at < CACHE_MS) {
      if (hit.data.sektor || hit.data.branche) return hit.data
      continue
    }

    const auth = await holeYahooFinanceAuth()
    if (!auth) {
      const leer = { sektor: null, branche: null }
      cache.set(sym, { at: Date.now(), data: leer })
      continue
    }

    const u = new URL(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}`,
    )
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
        continue
      }
      const j = (await res.json()) as {
        quoteSummary?: { result?: Array<{ assetProfile?: { sector?: string; industry?: string } }> }
      }
      const ap = j.quoteSummary?.result?.[0]?.assetProfile
      const meta = formatiereBrancheDe({ sector: ap?.sector, industry: ap?.industry })
      const data: SektorBatchEintrag = { sektor: meta.sektor, branche: meta.branche }
      cache.set(sym, { at: Date.now(), data })
      if (data.sektor || data.branche) return data
    } catch {
      const leer = { sektor: null, branche: null }
      cache.set(sym, { at: Date.now(), data: leer })
    }
  }
  return { sektor: null, branche: null }
}

async function yahooBrancheFuerSymbole(symbole: string[]): Promise<SektorBatchEintrag> {
  for (const sym of symbole) {
    const data = await yahooBrancheFuerSymbol(sym)
    if (data.sektor || data.branche) return data
  }
  return { sektor: null, branche: null }
}

/** Yahoo assetProfile (GICS) + DE-Labels; Cloud-Cache + In-Memory. */
export async function holeSektorenBatch(
  items: SektorBatchItem[],
): Promise<Record<string, SektorBatchEintrag>> {
  const result: Record<string, SektorBatchEintrag> = {}
  const symbolZuItems = new Map<string, SektorBatchItem[]>()

  const isins = items
    .map((i) => i.isin?.trim().toUpperCase())
    .filter((i): i is string => Boolean(i && i.length >= 12))

  const cloud = await ladeSektorenAusCloud(isins)
  for (const [isin, data] of cloud) {
    result[isin] = data
    for (const sym of symboleFuerItem({ isin })) {
      result[sym] = data
      result[sym.split('.')[0]!] = data
    }
  }

  for (const item of items.slice(0, 120)) {
    const isin = item.isin?.trim().toUpperCase()
    if (isin && result[isin]?.sektor) continue

    const symbole = symboleFuerItem(item)
    if (symbole.length === 0) continue

    const basis = symbole[0]!
    const list = symbolZuItems.get(basis) ?? []
    list.push(item)
    symbolZuItems.set(basis, list)
  }

  const cloudWrites: Array<{ isin: string; data: SektorBatchEintrag; symbolYahoo?: string | null }> = []

  const entries = [...symbolZuItems.entries()]
  for (let i = 0; i < entries.length; i += 8) {
    const chunk = entries.slice(i, i + 8)
    await Promise.all(
      chunk.map(async ([basis, related]) => {
        const symbole = [...new Set(related.flatMap((item) => symboleFuerItem(item)))]
        const data = await yahooBrancheFuerSymbole(symbole.length > 0 ? symbole : [basis])
        for (const item of related) {
          const isin = item.isin?.trim().toUpperCase()
          if (isin) {
            result[isin] = data
            if (data.sektor || data.branche) {
              cloudWrites.push({ isin, data, symbolYahoo: item.symbolYahoo })
            }
          }
          for (const sym of symboleFuerItem(item)) {
            result[sym] = data
            result[sym.split('.')[0]!] = data
          }
        }
      }),
    )
  }

  if (cloudWrites.length > 0) {
    void speichereSektorenInCloud(cloudWrites)
  }

  return result
}

import 'server-only'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

import type { FundamentalNewsArtikel } from '@/lib/portfolio-analyse/fundamentaldaten-types'

export type { FundamentalNewsArtikel }

export async function ladeFundamentalNews(symbol: string, firmenname?: string): Promise<FundamentalNewsArtikel[]> {
  const sym = symbol.trim()
  if (!sym) return []

  const suchbegriffe = [sym, firmenname?.trim()].filter(Boolean) as string[]
  const seen = new Set<string>()
  const out: FundamentalNewsArtikel[] = []

  for (const q of suchbegriffe) {
    try {
      const u = new URL('https://query2.finance.yahoo.com/v1/finance/search')
      u.searchParams.set('q', q)
      u.searchParams.set('quotesCount', '0')
      u.searchParams.set('newsCount', '15')
      const res = await fetch(u.toString(), {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        cache: 'no-store',
      })
      if (!res.ok) continue
      const j = (await res.json()) as {
        news?: Array<{
          title?: string
          link?: string
          publisher?: string
          providerPublishTime?: number
          summary?: string
        }>
      }
      for (const n of j.news ?? []) {
        const link = n.link?.trim()
        const titel = n.title?.trim()
        if (!link || !titel || seen.has(link)) continue
        seen.add(link)
        const ts = n.providerPublishTime
        out.push({
          titel,
          link,
          quelle: n.publisher?.trim() ?? null,
          veroeffentlicht:
            ts != null && Number.isFinite(ts)
              ? new Date(ts * 1000).toISOString()
              : null,
          zusammenfassung: n.summary?.trim() ?? null,
        })
      }
    } catch {
      /* nächster Suchbegriff */
    }
    if (out.length >= 12) break
  }

  return out.slice(0, 12)
}

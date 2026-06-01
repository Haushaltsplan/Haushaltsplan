import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'

const CACHE_KEY = 'mein-haushalt:portfolio-isin-meta-v2'
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

type CacheEntry = Record<string, IsinMetadata & { cachedAt: number }>

function ladeCache(): CacheEntry {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as CacheEntry
  } catch {
    return {}
  }
}

function speichereCache(cache: CacheEntry): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    /* ignore */
  }
}

export function metadatenAusCache(isins: string[]): Map<string, IsinMetadata> {
  const cache = ladeCache()
  const now = Date.now()
  const out = new Map<string, IsinMetadata>()
  for (const isin of isins) {
    const hit = cache[isin]
    if (hit && now - hit.cachedAt < CACHE_MAX_AGE_MS) {
      out.set(isin, { isin: hit.isin, name: hit.name, symbolYahoo: hit.symbolYahoo, assetType: hit.assetType })
    }
  }
  return out
}

export async function ladeIsinMetadaten(isins: string[]): Promise<Map<string, IsinMetadata>> {
  const unique = [...new Set(isins.map((s) => s.trim().toUpperCase()).filter(Boolean))]
  const cache = ladeCache()
  const now = Date.now()
  const out = new Map<string, IsinMetadata>()
  const fehlend: string[] = []

  for (const isin of unique) {
    const hit = cache[isin]
    if (hit && now - hit.cachedAt < CACHE_MAX_AGE_MS) {
      out.set(isin, { isin: hit.isin, name: hit.name, symbolYahoo: hit.symbolYahoo, assetType: hit.assetType })
    } else {
      fehlend.push(isin)
    }
  }

  if (fehlend.length === 0) return out

  const res = await fetch('/api/portfolio-analyse/isin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isins: fehlend }),
  })
  const j = (await res.json()) as { ok?: boolean; metadaten?: IsinMetadata[] }
  if (!j.ok || !Array.isArray(j.metadaten)) return out

  for (const m of j.metadaten) {
    const isin = m.isin.toUpperCase()
    out.set(isin, m)
    cache[isin] = { ...m, cachedAt: now }
  }
  speichereCache(cache)
  return out
}

export function anzeigeNameFuerIsin(
  isin: string | null | undefined,
  fallbackName: string | null | undefined,
  meta: Map<string, IsinMetadata>,
): string {
  if (isin) {
    const m = meta.get(isin.toUpperCase())
    if (m?.name && m.name !== isin) return m.name
  }
  const fb = fallbackName?.trim()
  if (fb && fb.length >= 2) return fb
  if (isin) return isin
  return 'Unbekannt'
}

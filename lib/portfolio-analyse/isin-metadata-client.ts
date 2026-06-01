import { teileArray } from '@/lib/portfolio-analyse/batch-hilfen'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'

const CACHE_KEY = 'mein-haushalt:portfolio-isin-meta-v4'
const ISIN_BATCH = 80
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

function normalisiereMeta(m: IsinMetadata & { cachedAt?: number }): IsinMetadata {
  const k = isinKenntnis(m.isin)
  return {
    isin: m.isin,
    name: k?.name ?? m.name,
    symbolYahoo: k?.symbolYahoo ?? m.symbolYahoo,
    symbolCandidates:
      k?.symbolCandidates ??
      (m.symbolCandidates?.length ? m.symbolCandidates : m.symbolYahoo ? [m.symbolYahoo] : []),
    wkn: k?.wkn ?? m.wkn ?? null,
    assetType: m.assetType,
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
      out.set(isin, normalisiereMeta(hit))
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
      out.set(isin, normalisiereMeta(hit))
    } else {
      fehlend.push(isin)
    }
  }

  if (fehlend.length === 0) return out

  for (const batch of teileArray(fehlend, ISIN_BATCH)) {
    const res = await fetch('/api/portfolio-analyse/isin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isins: batch }),
    })
    const j = (await res.json()) as { ok?: boolean; metadaten?: IsinMetadata[] }
    if (!j.ok || !Array.isArray(j.metadaten)) continue
    for (const raw of j.metadaten) {
      const m = normalisiereMeta(raw)
      const isin = m.isin.toUpperCase()
      out.set(isin, m)
      cache[isin] = { ...m, cachedAt: now }
    }
  }
  speichereCache(cache)
  return out
}

export function wknFuerIsin(isin: string | null | undefined, meta: Map<string, IsinMetadata>): string | null {
  if (!isin) return null
  const k = isinKenntnis(isin)
  if (k?.wkn) return k.wkn
  return meta.get(isin.toUpperCase())?.wkn ?? null
}

export function anzeigeNameFuerIsin(
  isin: string | null | undefined,
  fallbackName: string | null | undefined,
  meta: Map<string, IsinMetadata>,
): string {
  const k = isin ? isinKenntnis(isin) : null
  if (k?.name) return k.name
  if (isin) {
    const m = meta.get(isin.toUpperCase())
    if (m?.name && m.name !== isin) return m.name
  }
  const fb = fallbackName?.trim()
  if (fb && fb.length >= 2) return fb
  if (isin) return isin
  return 'Unbekannt'
}

/** Bike24-Katalog, erreichbar ohne Browser. Die Produktseite selbst blockt Server. */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export function bike24Host(roh: string): boolean {
  try {
    const host = new URL(roh).hostname.toLowerCase()
    return host === 'bike24.de' || host.endsWith('.bike24.de')
  } catch {
    return false
  }
}

/** URL `/p1144433.html` gehört zur Katalog-Id 144433. Beide Formen werden geprüft. */
export function bike24IdKandidaten(roh: string): string[] {
  if (!bike24Host(roh)) return []
  try {
    const zahl = new URL(roh).pathname.match(/\/p(\d+)\.html$/i)?.[1] ?? ''
    if (!zahl) return []
    const ohneFuehrendeEins = zahl.startsWith('1') && zahl.length > 5 ? zahl.slice(1) : ''
    return [...new Set([ohneFuehrendeEins, zahl].filter((id) => id.length >= 4))]
  } catch {
    return []
  }
}

export function bike24BildUrl(pfad: string): string {
  const t = pfad.trim()
  if (!t) return ''
  if (/^https?:\/\/images\.bike24\.com\/media\/\d+\//i.test(t)) return t
  const relativ = t
    .replace(/^https?:\/\/images\.bike24\.com\//i, '')
    .replace(/^\/+/, '')
  if (!relativ) return ''
  return `https://images.bike24.com/media/1020/${relativ}`
}

export function bike24Beschreibung(raw: string): string {
  return raw
    .replace(/[✓▶]/g, ' ')
    .replace(/schneller versand/gi, '')
    .replace(/top service/gi, '')
    .replace(/jetzt kaufen!?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

type KatalogHit = {
  name?: unknown
  price?: unknown
  productId?: unknown
  objectID?: unknown
  imageList?: unknown
}

export async function bike24KatalogTreffer(
  suchbegriff: string,
  ids: string[],
): Promise<{ name: string; preisEur: number; bildUrl: string } | null> {
  const term = suchbegriff.replace(/\s+/g, ' ').trim()
  if (term.length < 3 || !ids.length) return null
  const gesucht = new Set(ids)
  for (const page of [1, 2]) {
    const url =
      'https://www.bike24.de/search-page-api/search-page-results?searchTerm=' +
      encodeURIComponent(term) +
      (page > 1 ? `&page=${page}` : '')
    let data: { hits?: KatalogHit[] }
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': UA, 'Accept-Language': 'de-DE,de;q=0.9' },
        cache: 'no-store',
        signal: AbortSignal.timeout(12_000),
      })
      if (!res.ok) continue
      const typ = (res.headers.get('content-type') || '').toLowerCase()
      if (!typ.includes('json')) continue
      data = (await res.json()) as { hits?: KatalogHit[] }
    } catch {
      continue
    }
    const hit = (data.hits ?? []).find(
      (eintrag) => gesucht.has(String(eintrag.productId ?? '')) || gesucht.has(String(eintrag.objectID ?? '')),
    )
    if (!hit || typeof hit.name !== 'string' || typeof hit.price !== 'number' || !Number.isFinite(hit.price)) continue
    const bildPfad = Array.isArray(hit.imageList) ? hit.imageList.find((x) => typeof x === 'string') : ''
    return {
      name: hit.name.replace(/\s+/g, ' ').trim(),
      preisEur: Math.round(hit.price * 100) / 100,
      bildUrl: typeof bildPfad === 'string' ? bike24BildUrl(bildPfad) : '',
    }
  }
  return null
}

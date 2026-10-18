import 'server-only'

import { fetchJson } from '@/lib/angebote/http'
import type { HaendlerId, MarktInfo } from '@/lib/angebote/types'

/**
 * Grobe ALDI-Region nach PLZ-Präfix.
 * Nord: 0–3; Süd: 4–9 (Mischgebiete können abweichen).
 */
export function aldiRegionFuerPlz(plz: string): 'nord' | 'sued' {
  const first = Number(plz[0])
  return first >= 0 && first <= 3 ? 'nord' : 'sued'
}

type NominatimHit = {
  lat?: string
  lon?: string
  display_name?: string
}

/** PLZ → ungefähre Koordinaten (Nominatim, gecacht pro Prozess). */
const geoCache = new Map<string, { lat: number; lon: number } | null>()

export async function geoFuerPlz(plz: string): Promise<{ lat: number; lon: number } | null> {
  if (geoCache.has(plz)) return geoCache.get(plz) ?? null
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(plz)}` +
      `&country=Germany&format=json&limit=1`
    const data = await fetchJson<NominatimHit[]>(url, {
      label: 'nominatim',
      timeoutMs: 10_000,
      retries: 1,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'mein-haushalt-angebote/1.0 (private)',
      },
    })
    const hit = data?.[0]
    const lat = hit?.lat ? Number(hit.lat) : NaN
    const lon = hit?.lon ? Number(hit.lon) : NaN
    const out = Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null
    geoCache.set(plz, out)
    return out
  } catch (e) {
    console.warn('[angebote:plz] Nominatim fehlgeschlagen:', e)
    geoCache.set(plz, null)
    return null
  }
}

type ReweMarket = {
  id?: string | number
  marketId?: string | number
  name?: string
  addressStreet?: string
  addressZipCode?: string
  addressCity?: string
}

/** REWE-Märkte in der PLZ (öffentliche Market-Suche). */
export async function reweMaerkteFuerPlz(plz: string): Promise<MarktInfo[]> {
  try {
    const url =
      `https://shop.rewe.de/mobile/markets/markets-search?searchString=${encodeURIComponent(plz)}` +
      `&page=0&pageSize=8`
    const data = await fetchJson<{ markets?: ReweMarket[] } | ReweMarket[]>(url, {
      label: 'rewe-maerkte',
      timeoutMs: 12_000,
    })
    const list = Array.isArray(data) ? data : data?.markets ?? []
    return list
      .map((m): MarktInfo | null => {
        const id = String(m.marketId ?? m.id ?? '').trim()
        if (!id) return null
        return {
          haendler: 'rewe',
          marktId: id,
          name: m.name?.trim() || `REWE ${id}`,
          plz: m.addressZipCode?.trim() || plz,
          ort: m.addressCity?.trim() || null,
          adresse: m.addressStreet?.trim() || null,
        }
      })
      .filter((x): x is MarktInfo => Boolean(x))
  } catch (e) {
    console.warn('[angebote:rewe-maerkte]', e)
    return []
  }
}

type EdekaMarket = {
  marketId?: string | number
  id?: string | number
  name?: string
  zipCode?: string
  city?: string
  street?: string
}

export async function edekaMaerkteFuerPlz(plz: string): Promise<MarktInfo[]> {
  try {
    const url =
      `https://www.edeka.de/api/marketsearch/markets?searchstring=${encodeURIComponent(plz)}` +
      `&size=8`
    const data = await fetchJson<{ markets?: EdekaMarket[]; content?: EdekaMarket[] }>(url, {
      label: 'edeka-maerkte',
      timeoutMs: 12_000,
    })
    const list = data?.markets ?? data?.content ?? []
    return list
      .map((m): MarktInfo | null => {
        const id = String(m.marketId ?? m.id ?? '').trim()
        if (!id) return null
        return {
          haendler: 'edeka',
          marktId: id,
          name: m.name?.trim() || `EDEKA ${id}`,
          plz: m.zipCode?.trim() || plz,
          ort: m.city?.trim() || null,
          adresse: m.street?.trim() || null,
        }
      })
      .filter((x): x is MarktInfo => Boolean(x))
  } catch (e) {
    console.warn('[angebote:edeka-maerkte]', e)
    return []
  }
}

export async function ladeMaerkteFuerPlz(
  plz: string,
  gespeicherte?: Partial<Record<HaendlerId, string>>,
): Promise<MarktInfo[]> {
  const [rewe, edeka, geo] = await Promise.all([
    reweMaerkteFuerPlz(plz),
    edekaMaerkteFuerPlz(plz),
    geoFuerPlz(plz),
  ])
  const out: MarktInfo[] = [...rewe, ...edeka]
  const region = aldiRegionFuerPlz(plz)
  out.push({
    haendler: region === 'nord' ? 'aldi_nord' : 'aldi_sued',
    marktId: gespeicherte?.[region === 'nord' ? 'aldi_nord' : 'aldi_sued'] || 'default',
    name: region === 'nord' ? 'ALDI Nord (Region)' : 'ALDI Süd (Region)',
    plz,
    ort: null,
    adresse: geo ? `${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)}` : null,
  })
  out.push({
    haendler: 'lidl',
    marktId: gespeicherte?.lidl || plz,
    name: 'Lidl (PLZ-Suche)',
    plz,
    ort: null,
    adresse: null,
  })
  return out
}

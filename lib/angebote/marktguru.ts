import 'server-only'

import { fetchJson, fetchText } from '@/lib/angebote/http'
import { normalisiereAngebot, parsePreisEur } from '@/lib/angebote/normalisierung'
import type { Angebot, HaendlerId } from '@/lib/angebote/types'

type MgKeys = { apiKey: string; clientKey: string }

let keysCache: { keys: MgKeys; at: number } | null = null

const RETAILER_MAP: Record<string, HaendlerId> = {
  rewe: 'rewe',
  'rewe-center': 'rewe',
  'rewe-to-go': 'rewe',
  'aldi-sued': 'aldi_sued',
  'aldi-nord': 'aldi_nord',
  aldi: 'aldi_sued',
  edeka: 'edeka',
  'edeka-center': 'edeka',
  'edeka-xpress': 'edeka',
  nahkauf: 'edeka',
  lidl: 'lidl',
  penny: 'penny',
  'netto-marken-discount': 'netto',
  netto: 'netto',
  kaufland: 'kaufland',
  globus: 'globus',
  marktkauf: 'marktkauf',
}

async function ladeKeys(): Promise<MgKeys> {
  if (keysCache && Date.now() - keysCache.at < 6 * 60 * 60_000) return keysCache.keys
  const html = await fetchText('https://www.marktguru.de/', {
    label: 'marktguru-keys',
    timeoutMs: 15_000,
  })
  const m = html.match(/<script\s+type="application\/json">([\s\S]*?)<\/script>/i)
  if (!m?.[1]) throw new Error('Marktguru: Config-JSON nicht gefunden')
  const cfg = JSON.parse(m[1]) as {
    config?: { apiKey?: string; clientKey?: string }
  }
  const apiKey = cfg?.config?.apiKey?.trim()
  const clientKey = cfg?.config?.clientKey?.trim()
  if (!apiKey || !clientKey) throw new Error('Marktguru: apiKey/clientKey fehlen')
  const keys = { apiKey, clientKey }
  keysCache = { keys, at: Date.now() }
  return keys
}

type MgBrand = { name?: string; uniqueName?: string } | string | null

type MgOffer = {
  id?: number | string
  brand?: MgBrand
  product?: { name?: string; brand?: MgBrand; description?: string | null }
  price?: number | string
  oldPrice?: number | string | null
  description?: string | null
  referencePrice?: number | string | null
  validityDates?: Array<{ from?: string; to?: string }>
  validFrom?: string | null
  validTo?: string | null
  unitPrice?: number | string | null
  unitType?: string | null
  unit?: { shortName?: string; name?: string }
  volume?: number | null
  advertisers?: Array<{ uniqueName?: string; name?: string }>
  images?: {
    count?: number
    urls?: { medium?: string; small?: string; large?: string }
  }
  categories?: Array<{ name?: string }>
}

type MgSearchResponse = {
  results?: MgOffer[]
}

function markeAus(raw: MgBrand | undefined): string | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    const t = raw.trim()
    return t && !/^this is no brand$/i.test(t) ? t : null
  }
  const t = raw.name?.trim() || raw.uniqueName?.trim() || ''
  if (!t || /^this is no brand$/i.test(t)) return null
  return t
}

export function marktguruBildUrl(offerId: string | number, size: 'small' | 'medium' | 'large' = 'medium') {
  return `https://mg2de.b-cdn.net/api/v1/offers/${offerId}/images/default/0/${size}.jpg`
}

function mapOffer(o: MgOffer): Angebot | null {
  const adv = o.advertisers?.[0]?.uniqueName?.toLowerCase() ?? ''
  const haendler = RETAILER_MAP[adv]
  if (!haendler) return null
  const preis = parsePreisEur(o.price)
  if (preis == null) return null

  const name = o.product?.name?.trim() || o.description?.trim() || `Angebot ${o.id}`
  const marke = markeAus(o.brand) || markeAus(o.product?.brand)
  const packungText = o.description?.trim() || null
  const unitShort = (o.unit?.shortName || o.unitType || '').toLowerCase()
  let grundpreisEur: number | null = parsePreisEur(o.referencePrice ?? o.unitPrice)
  let grundpreisEinheit: 'kg' | 'l' | 'st' | null = null
  if (grundpreisEur != null) {
    if (unitShort.includes('kg') || unitShort === 'g') grundpreisEinheit = 'kg'
    else if (unitShort.includes('l') || unitShort.includes('ml')) grundpreisEinheit = 'l'
    else grundpreisEinheit = 'st'
  }

  const offerId = o.id != null ? String(o.id) : null
  const bildUrl =
    o.images?.urls?.medium ||
    o.images?.urls?.large ||
    o.images?.urls?.small ||
    (offerId && (o.images?.count ?? 0) > 0 ? marktguruBildUrl(offerId, 'medium') : null) ||
    (offerId ? marktguruBildUrl(offerId, 'medium') : null)

  const von = o.validityDates?.[0]?.from ?? o.validFrom ?? null
  const bis = o.validityDates?.[0]?.to ?? o.validTo ?? null

  return normalisiereAngebot({
    id: `mg-${haendler}-${offerId ?? name}-${preis}`,
    haendler,
    name,
    marke,
    preisEur: preis,
    vorherigerPreisEur: parsePreisEur(o.oldPrice),
    packungText,
    gueltigVon: von,
    gueltigBis: bis,
    bildUrl,
    kategorie: o.categories?.[0]?.name ?? null,
    quelle: 'marktguru',
    grundpreisEur,
    grundpreisEinheit,
  })
}

export async function marktguruSuche(opts: {
  query?: string
  plz: string
  limit?: number
  offset?: number
  allowed?: HaendlerId[]
}): Promise<Angebot[]> {
  const keys = await ladeKeys()
  const params = new URLSearchParams({
    as: 'web',
    q: opts.query?.trim() || '',
    limit: String(opts.limit ?? 400),
    offset: String(opts.offset ?? 0),
    zipCode: opts.plz,
  })
  const url = `https://api.marktguru.de/api/v1/offers/search?${params}`
  const data = await fetchJson<MgSearchResponse>(url, {
    label: 'marktguru-search',
    timeoutMs: 20_000,
    headers: {
      'x-apikey': keys.apiKey,
      'x-clientkey': keys.clientKey,
      Accept: 'application/json',
    },
  })
  const results = data?.results ?? []
  const allowed = opts.allowed?.length ? new Set(opts.allowed) : null
  const out: Angebot[] = []

  for (const o of results) {
    const mapped = mapOffer(o)
    if (!mapped) continue
    if (allowed && !allowed.has(mapped.haendler)) continue
    out.push(mapped)
  }
  return out
}

/** Leere Query = breite regionale Angebote (Marktguru liefert dann Top-Angebote). */
export async function marktguruRegionaleAngebote(
  plz: string,
  haendler: HaendlerId[],
): Promise<Angebot[]> {
  const queries = ['', 'Fleisch', 'Milch', 'Gemüse', 'Getränke', 'Käse', 'Brot', 'Butter', 'Joghurt']
  const seen = new Set<string>()
  const all: Angebot[] = []
  for (const q of queries) {
    try {
      const batch = await marktguruSuche({
        query: q,
        plz,
        limit: 200,
        allowed: haendler,
      })
      for (const a of batch) {
        if (seen.has(a.id)) continue
        seen.add(a.id)
        all.push(a)
      }
    } catch (e) {
      console.warn(`[angebote:marktguru] Query "${q}":`, e)
    }
  }
  return all
}

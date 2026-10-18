import 'server-only'

import { fetchJson, fetchText } from '@/lib/angebote/http'
import { normalisiereAngebot, parsePreisEur } from '@/lib/angebote/normalisierung'
import { cleanMarke } from '@/lib/angebote/produkt-match'
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
  if (typeof raw === 'string') return cleanMarke(raw)
  return cleanMarke(raw.name?.trim() || raw.uniqueName?.trim() || null)
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

/**
 * Marktguru-Harvest für Ketten.
 * Leere Query liefert seit 2026 oft 0 Treffer → Kettenname + Kategorien.
 */
const MG_KETTEN_QUERIES: Partial<Record<HaendlerId, string[]>> = {
  rewe: ['REWE', 'REWE Center'],
  edeka: ['EDEKA'],
  lidl: ['Lidl'],
  penny: ['Penny'],
  netto: ['Netto'],
  kaufland: ['Kaufland'],
  globus: ['Globus'],
  marktkauf: ['Marktkauf'],
  aldi_sued: ['ALDI', 'ALDI Süd'],
  aldi_nord: ['ALDI', 'ALDI Nord'],
}

const MG_KATEGORIE_QUERIES = [
  'Milch',
  'Käse',
  'Butter',
  'Joghurt',
  'Brot',
  'Fleisch',
  'Obst',
  'Gemüse',
  'Getränke',
  'Kaffee',
]

export async function marktguruRegionaleAngebote(
  plz: string,
  haendler: HaendlerId[],
): Promise<Angebot[]> {
  const kettenQueries = [
    ...new Set(haendler.flatMap((h) => MG_KETTEN_QUERIES[h] ?? [haendlerLabelFallback(h)])),
  ]
  const queries = [...kettenQueries, ...MG_KATEGORIE_QUERIES]
  const seen = new Set<string>()
  const all: Angebot[] = []

  // Parallel in kleinen Batches, damit Serverless nicht serielle Minuten braucht.
  const batchSize = 3
  for (let i = 0; i < queries.length; i += batchSize) {
    const slice = queries.slice(i, i + batchSize)
    const batches = await Promise.all(
      slice.map(async (q) => {
        try {
          return await marktguruSuche({
            query: q,
            plz,
            limit: 200,
            allowed: haendler,
          })
        } catch (e) {
          console.warn(`[angebote:marktguru] Query "${q}":`, e)
          return [] as Angebot[]
        }
      }),
    )
    for (const batch of batches) {
      for (const a of batch) {
        if (seen.has(a.id)) continue
        seen.add(a.id)
        all.push(a)
      }
    }
  }
  return all
}

function haendlerLabelFallback(h: HaendlerId): string {
  return h.replace(/_/g, ' ')
}

/** Gezielter Harvest für eine Kette (z. B. REWE), inkl. Offset-Seiten. */
export async function marktguruFuerHaendler(
  plz: string,
  haendler: HaendlerId,
  extraQueries: string[] = [],
): Promise<Angebot[]> {
  const ketten = MG_KETTEN_QUERIES[haendler] ?? [haendlerLabelFallback(haendler)]
  const seen = new Set<string>()
  const all: Angebot[] = []

  const pushBatch = (batch: Angebot[]) => {
    for (const a of batch) {
      if (seen.has(a.id)) continue
      seen.add(a.id)
      all.push(a)
    }
  }

  // 1) Kettenname — liefert bei REWE/EDEKA die Wochenangebote
  for (const q of ketten) {
    for (const offset of [0, 200, 400]) {
      try {
        const batch = await marktguruSuche({
          query: q,
          plz,
          limit: 200,
          offset,
          allowed: [haendler],
        })
        pushBatch(batch)
        if (batch.length < 80) break
      } catch (e) {
        console.warn(`[angebote:marktguru:${haendler}] "${q}"@${offset}:`, e)
        break
      }
    }
  }

  // 2) Kategorien nur wenn noch dünn
  if (all.length < 40) {
    const rest = [...new Set([...extraQueries, ...MG_KATEGORIE_QUERIES.slice(0, 6)])]
    const batches = await Promise.all(
      rest.map(async (q) => {
        try {
          return await marktguruSuche({
            query: q,
            plz,
            limit: 200,
            allowed: [haendler],
          })
        } catch (e) {
          console.warn(`[angebote:marktguru:${haendler}] "${q}":`, e)
          return [] as Angebot[]
        }
      }),
    )
    for (const batch of batches) pushBatch(batch)
  }

  return all
}

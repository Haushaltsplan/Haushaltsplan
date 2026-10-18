import 'server-only'

import { fetchJson, fetchText } from '@/lib/angebote/http'
import { normalisiereAngebot, parsePreisEur } from '@/lib/angebote/normalisierung'
import type { Angebot, HaendlerId } from '@/lib/angebote/types'

type MgKeys = { apiKey: string; clientKey: string }

let keysCache: { keys: MgKeys; at: number } | null = null

const RETAILER_MAP: Record<string, HaendlerId> = {
  rewe: 'rewe',
  'aldi-sued': 'aldi_sued',
  'aldi-nord': 'aldi_nord',
  aldi: 'aldi_sued',
  edeka: 'edeka',
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

type MgOffer = {
  id?: number | string
  product?: { name?: string; brand?: string | null }
  price?: number | string
  priceOld?: number | string | null
  description?: string | null
  validFrom?: string | null
  validTo?: string | null
  unitPrice?: number | string | null
  unitType?: string | null
  advertisers?: Array<{ uniqueName?: string; name?: string }>
  images?: { urls?: { medium?: string; small?: string } }
}

type MgSearchResponse = {
  results?: MgOffer[]
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
    const adv = o.advertisers?.[0]?.uniqueName?.toLowerCase() ?? ''
    const haendler = RETAILER_MAP[adv]
    if (!haendler) continue
    if (allowed && !allowed.has(haendler)) continue
    const preis = parsePreisEur(o.price)
    if (preis == null) continue
    const name = o.product?.name?.trim() || o.description?.trim() || `Angebot ${o.id}`
    const packungText = o.description?.trim() || null
    let grundpreisEur: number | null = parsePreisEur(o.unitPrice)
    let grundpreisEinheit: 'kg' | 'l' | 'st' | null = null
    const ut = (o.unitType || '').toLowerCase()
    if (grundpreisEur != null) {
      if (ut.includes('kg') || ut.includes('g')) grundpreisEinheit = 'kg'
      else if (ut.includes('l') || ut.includes('ml')) grundpreisEinheit = 'l'
      else grundpreisEinheit = 'st'
    }
    out.push(
      normalisiereAngebot({
        id: `mg-${haendler}-${o.id ?? out.length}`,
        haendler,
        name,
        marke: o.product?.brand ?? null,
        preisEur: preis,
        vorherigerPreisEur: parsePreisEur(o.priceOld),
        packungText,
        gueltigVon: o.validFrom ?? null,
        gueltigBis: o.validTo ?? null,
        bildUrl: o.images?.urls?.medium || o.images?.urls?.small || null,
        kategorie: null,
        quelle: 'marktguru',
        grundpreisEur,
        grundpreisEinheit,
      }),
    )
  }
  return out
}

/** Leere Query = breite regionale Angebote (Marktguru liefert dann Top-Angebote). */
export async function marktguruRegionaleAngebote(
  plz: string,
  haendler: HaendlerId[],
): Promise<Angebot[]> {
  // Mehrere Suchen mit gängigen Kategorien, damit der Bestand nicht nur „Milch“ ist.
  const queries = ['', 'Fleisch', 'Milch', 'Gemüse', 'Getränke', 'Käse', 'Brot']
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

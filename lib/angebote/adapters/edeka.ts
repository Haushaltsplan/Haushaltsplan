import 'server-only'

import { fetchJson } from '@/lib/angebote/http'
import { normalisiereAngebot, parsePreisEur } from '@/lib/angebote/normalisierung'
import type { AngeboteAdapter, AdapterKontext } from '@/lib/angebote/adapters/types'
import type { Angebot } from '@/lib/angebote/types'

type EdekaOffer = {
  id?: string | number
  title?: string
  name?: string
  brand?: string
  price?: number | string
  basePrice?: number | string
  regularPrice?: number | string
  descriptions?: string[]
  imageUrl?: string
  category?: string
  validFrom?: string
  validTo?: string
  offerId?: string | number
}

type EdekaResponse = {
  offers?: EdekaOffer[]
  data?: EdekaOffer[]
}

export const edekaAdapter: AngeboteAdapter = {
  haendler: 'edeka',
  istDirekt: true,
  async fetchAngebote(ctx: AdapterKontext) {
    const markt =
      ctx.marktId ||
      ctx.maerkte.find((m) => m.haendler === 'edeka')?.marktId ||
      '1'
    const url =
      `https://www.edeka.de/eh/service/eh/offers?limit=200&marketId=${encodeURIComponent(markt)}`
    const data = await fetchJson<EdekaResponse | EdekaOffer[]>(url, {
      label: 'edeka',
      timeoutMs: 18_000,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'de-DE,de;q=0.9',
        Referer: 'https://www.edeka.de/angebote.jsp',
        Origin: 'https://www.edeka.de',
      },
    })
    const list = Array.isArray(data) ? data : data.offers ?? data.data ?? []
    if (!list.length) throw new Error('EDEKA: keine Angebote')

    const angebote = list
      .map((o, i): Angebot | null => {
        const name = (o.title || o.name || '').trim()
        const preis = parsePreisEur(o.price)
        if (!name || preis == null) return null
        return normalisiereAngebot({
          id: `edeka-${o.offerId ?? o.id ?? i}`,
          haendler: 'edeka',
          name,
          marke: o.brand ?? null,
          preisEur: preis,
          vorherigerPreisEur: parsePreisEur(o.regularPrice),
          packungText: o.descriptions?.[0] ?? null,
          gueltigVon: o.validFrom ?? null,
          gueltigBis: o.validTo ?? null,
          bildUrl: o.imageUrl ?? null,
          kategorie: o.category ?? null,
          quelle: 'direkt',
          grundpreisEur: parsePreisEur(o.basePrice),
        })
      })
      .filter((x): x is Angebot => Boolean(x))

    if (!angebote.length) throw new Error('EDEKA: Angebote ohne gültigen Preis')
    return { haendler: 'edeka', angebote, quelle: 'direkt' }
  },
}

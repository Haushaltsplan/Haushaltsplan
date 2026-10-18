import 'server-only'

import { fetchJson } from '@/lib/angebote/http'
import { normalisiereAngebot, parsePreisEur } from '@/lib/angebote/normalisierung'
import type { AngeboteAdapter, AdapterKontext } from '@/lib/angebote/adapters/types'
import type { Angebot } from '@/lib/angebote/types'

type KauflandOffer = {
  id?: string | number
  title?: string
  name?: string
  brand?: string
  price?: number | string
  oldPrice?: number | string
  basePrice?: string
  unit?: string
  imageUrl?: string
  category?: string
}

/**
 * Kaufland Wochenangebote — versucht öffentliche JSON-Route;
 * bei Fehler wirft der Adapter, Orchestrierung greift auf Marktguru zurück.
 */
export const kauflandAdapter: AngeboteAdapter = {
  haendler: 'kaufland',
  istDirekt: true,
  async fetchAngebote(_ctx: AdapterKontext) {
    const url =
      'https://www.kaufland.de/.klstorefront/v1/offers?channel=web&locale=de-DE&limit=150'
    const data = await fetchJson<{ offers?: KauflandOffer[]; results?: KauflandOffer[] } | KauflandOffer[]>(
      url,
      {
        label: 'kaufland',
        timeoutMs: 18_000,
        headers: {
          Accept: 'application/json',
          Referer: 'https://www.kaufland.de/angebote/',
        },
      },
    )
    const list = Array.isArray(data) ? data : data.offers ?? data.results ?? []
    if (!list.length) throw new Error('Kaufland: keine Angebote')

    const angebote = list
      .map((o, i): Angebot | null => {
        const name = (o.title || o.name || '').trim()
        const preis = parsePreisEur(o.price)
        if (!name || preis == null) return null
        return normalisiereAngebot({
          id: `kaufland-${o.id ?? i}`,
          haendler: 'kaufland',
          name,
          marke: o.brand ?? null,
          preisEur: preis,
          vorherigerPreisEur: parsePreisEur(o.oldPrice),
          packungText: o.unit || o.basePrice || null,
          gueltigVon: null,
          gueltigBis: null,
          bildUrl: o.imageUrl ?? null,
          kategorie: o.category ?? null,
          quelle: 'direkt',
        })
      })
      .filter((x): x is Angebot => Boolean(x))

    if (!angebote.length) throw new Error('Kaufland: Angebote ohne gültigen Preis')
    return { haendler: 'kaufland', angebote, quelle: 'direkt' }
  },
}

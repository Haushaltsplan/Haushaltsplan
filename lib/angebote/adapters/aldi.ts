import 'server-only'

import { fetchJson, fetchText } from '@/lib/angebote/http'
import { normalisiereAngebot, parsePreisEur } from '@/lib/angebote/normalisierung'
import { aldiRegionFuerPlz } from '@/lib/angebote/plz-maerkte'
import type { AngeboteAdapter, AdapterKontext } from '@/lib/angebote/adapters/types'
import type { Angebot } from '@/lib/angebote/types'

type AldiSuedProduct = {
  id?: string
  name?: string
  brandName?: string
  price?: { amount?: number; formattedValue?: string }
  priceNotDiscounted?: { amount?: number }
  sellingSize?: string
  url?: string
  imageUrl?: string
  categoryName?: string
}

type AldiSuedSearch = {
  products?: AldiSuedProduct[]
  data?: { products?: AldiSuedProduct[] }
}

async function ladeAldiSued(): Promise<Angebot[]> {
  const params = new URLSearchParams({
    serviceType: 'walk-in',
    categoryKey: 'Wochenangebote',
    limit: '100',
    offset: '0',
    sort: 'relevance',
    locale: 'de-DE',
  })
  const url = `https://api.aldi-sued.de/v3/product-search?${params}`
  const data = await fetchJson<AldiSuedSearch>(url, {
    label: 'aldi-sued',
    timeoutMs: 18_000,
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'de-DE,de;q=0.9',
      Origin: 'https://www.aldi-sued.de',
      Referer: 'https://www.aldi-sued.de/angebote.html',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-site',
    },
  })
  const products = data.products ?? data.data?.products ?? []
  if (!products.length) throw new Error('ALDI Süd: leere Produktliste')

  return products
    .map((p, i): Angebot | null => {
      const amount = p.price?.amount
      const preis =
        typeof amount === 'number' ? amount / (amount > 1000 ? 100 : 1) : parsePreisEur(p.price?.formattedValue)
      // ALDI API liefert oft Cent
      const preisEur =
        typeof amount === 'number'
          ? amount >= 100
            ? Math.round(amount) / 100
            : amount
          : preis
      if (preisEur == null || !p.name) return null
      return normalisiereAngebot({
        id: `aldi-sued-${p.id ?? i}`,
        haendler: 'aldi_sued',
        name: p.name.trim(),
        marke: p.brandName ?? null,
        preisEur: preisEur,
        vorherigerPreisEur:
          typeof p.priceNotDiscounted?.amount === 'number'
            ? p.priceNotDiscounted.amount >= 100
              ? p.priceNotDiscounted.amount / 100
              : p.priceNotDiscounted.amount
            : null,
        packungText: p.sellingSize ?? null,
        gueltigVon: null,
        gueltigBis: null,
        bildUrl: p.imageUrl ?? null,
        kategorie: p.categoryName ?? null,
        quelle: 'direkt',
      })
    })
    .filter((x): x is Angebot => Boolean(x))
}

async function ladeAldiNord(): Promise<Angebot[]> {
  const html = await fetchText('https://www.aldi-nord.de/angebote.html', {
    label: 'aldi-nord',
    timeoutMs: 20_000,
  })
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!m?.[1]) throw new Error('ALDI Nord: __NEXT_DATA__ fehlt')
  const next = JSON.parse(m[1]) as {
    props?: { pageProps?: { apiData?: Record<string, unknown> } }
  }
  const apiData = next?.props?.pageProps?.apiData ?? {}
  const out: Angebot[] = []
  const seen = new Set<string>()

  for (const [key, val] of Object.entries(apiData)) {
    if (!/offer/i.test(key) && key !== 'OFFER_GET') continue
    walkOffers(val, out, seen)
  }
  // Fallback: gesamte pageProps durchsuchen
  if (out.length === 0) walkOffers(next?.props?.pageProps, out, seen)
  if (out.length === 0) throw new Error('ALDI Nord: keine Offers in __NEXT_DATA__')
  return out
}

function walkOffers(node: unknown, out: Angebot[], seen: Set<string>, depth = 0) {
  if (depth > 14 || node == null) return
  if (Array.isArray(node)) {
    for (const n of node) walkOffers(n, out, seen, depth + 1)
    return
  }
  if (typeof node !== 'object') return
  const o = node as Record<string, unknown>
  const name =
    (typeof o.title === 'string' && o.title) ||
    (typeof o.name === 'string' && o.name) ||
    (typeof o.productTitle === 'string' && o.productTitle) ||
    null
  const preis = parsePreisEur(
    o.price ?? o.salesPrice ?? o.currentPrice ?? o.priceAmount,
  )
  if (name && preis != null) {
    const id = `aldi-nord-${String(o.id ?? o.sku ?? name)}-${preis}`
    if (!seen.has(id)) {
      seen.add(id)
      out.push(
        normalisiereAngebot({
          id,
          haendler: 'aldi_nord',
          name: String(name).trim(),
          marke: typeof o.brand === 'string' ? o.brand : null,
          preisEur: preis,
          vorherigerPreisEur: parsePreisEur(o.oldPrice ?? o.regularPrice),
          packungText:
            typeof o.packSize === 'string'
              ? o.packSize
              : typeof o.unit === 'string'
                ? o.unit
                : null,
          gueltigVon: typeof o.startDate === 'string' ? o.startDate : null,
          gueltigBis: typeof o.endDate === 'string' ? o.endDate : null,
          bildUrl: typeof o.imageUrl === 'string' ? o.imageUrl : null,
          kategorie: typeof o.category === 'string' ? o.category : null,
          quelle: 'direkt',
        }),
      )
    }
  }
  for (const v of Object.values(o)) {
    if (v && typeof v === 'object') walkOffers(v, out, seen, depth + 1)
  }
}

export const aldiSuedAdapter: AngeboteAdapter = {
  haendler: 'aldi_sued',
  istDirekt: true,
  async fetchAngebote(ctx: AdapterKontext) {
    if (aldiRegionFuerPlz(ctx.plz) === 'nord') {
      throw new Error('ALDI Süd-Adapter in Nord-PLZ übersprungen')
    }
    const angebote = await ladeAldiSued()
    return { haendler: 'aldi_sued', angebote, quelle: 'direkt' }
  },
}

export const aldiNordAdapter: AngeboteAdapter = {
  haendler: 'aldi_nord',
  istDirekt: true,
  async fetchAngebote(ctx: AdapterKontext) {
    if (aldiRegionFuerPlz(ctx.plz) === 'sued') {
      throw new Error('ALDI Nord-Adapter in Süd-PLZ übersprungen')
    }
    const angebote = await ladeAldiNord()
    return { haendler: 'aldi_nord', angebote, quelle: 'direkt' }
  },
}

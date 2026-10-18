import 'server-only'

import { fetchJson } from '@/lib/angebote/http'
import { marktguruSuche } from '@/lib/angebote/marktguru'
import { normalisiereAngebot, parsePreisEur } from '@/lib/angebote/normalisierung'
import type { AngeboteAdapter, AdapterKontext } from '@/lib/angebote/adapters/types'
import type { Angebot } from '@/lib/angebote/types'

type ReweProduct = {
  id?: string | number
  productName?: string
  title?: string
  brand?: { name?: string } | string
  orderLimit?: number
  media?: Array<{ mediaType?: string; link?: string; formats?: Array<{ link?: string }> }>
  pricing?: {
    price?: number | string
    regularPrice?: number | string
    basePriceText?: string
    grammage?: string
  }
  _embedded?: {
    articles?: Array<{
      id?: string | number
      listing?: {
        pricing?: {
          currentRetailPrice?: number
          currentDiscountedPrice?: number
          basePriceText?: string
          grammage?: string
        }
        mediaInformation?: Array<{ mediaUrl?: string }>
      }
      brandName?: string
      productName?: string
    }>
  }
}

type ReweProductsResponse = {
  type?: string
  _embedded?: { products?: ReweProduct[] }
  pagination?: { totalResultCount?: number }
}

/** Shop-API: mehrere Suchbegriffe → Wochenangebote-ähnlicher Bestand. */
async function ladeViaShopApi(marktId: string, plz: string): Promise<Angebot[]> {
  const queries = ['Milch', 'Käse', 'Butter', 'Brot', 'Fleisch', 'Joghurt', 'Obst', 'Gemüse', 'Kaffee', 'Cola']
  const seen = new Set<string>()
  const out: Angebot[] = []

  for (const q of queries) {
    const url =
      `https://shop.rewe.de/api/products?search=${encodeURIComponent(q)}` +
      `&market=${encodeURIComponent(marktId)}&objectsPerPage=30&page=1`
    try {
      const data = await fetchJson<ReweProductsResponse>(url, {
        label: 'rewe-shop',
        timeoutMs: 14_000,
        retries: 1,
        headers: {
          Accept: 'application/json',
          'rd-service-types': 'PICKUP',
          'rd-customer-zip': plz,
          'rd-postcode': plz,
          'rd-market-id': marktId,
          Referer: 'https://shop.rewe.de/',
          Origin: 'https://shop.rewe.de',
        },
      })
      const products = data._embedded?.products ?? []
      for (const p of products) {
        const art = p._embedded?.articles?.[0]
        const pricing = art?.listing?.pricing ?? p.pricing
        const cents =
          typeof (pricing as { currentDiscountedPrice?: number })?.currentDiscountedPrice ===
          'number'
            ? (pricing as { currentDiscountedPrice: number }).currentDiscountedPrice
            : typeof (pricing as { currentRetailPrice?: number })?.currentRetailPrice === 'number'
              ? (pricing as { currentRetailPrice: number }).currentRetailPrice
              : null
        const preisEur =
          cents != null
            ? cents / 100
            : parsePreisEur((pricing as { price?: unknown } | undefined)?.price)
        const name = (
          art?.productName ||
          p.productName ||
          p.title ||
          ''
        ).trim()
        if (!name || preisEur == null) continue
        const id = `rewe-shop-${art?.id ?? p.id ?? name}-${preisEur}`
        if (seen.has(id)) continue
        seen.add(id)
        const markeRaw = art?.brandName || (typeof p.brand === 'string' ? p.brand : p.brand?.name)
        const bild =
          art?.listing?.mediaInformation?.[0]?.mediaUrl ||
          p.media?.[0]?.formats?.[0]?.link ||
          p.media?.[0]?.link ||
          null
        out.push(
          normalisiereAngebot({
            id,
            haendler: 'rewe',
            name,
            marke: markeRaw?.trim() || null,
            preisEur,
            vorherigerPreisEur: parsePreisEur(
              (pricing as { regularPrice?: unknown } | undefined)?.regularPrice,
            ),
            packungText:
              (pricing as { grammage?: string; basePriceText?: string } | undefined)?.grammage ||
              (pricing as { basePriceText?: string } | undefined)?.basePriceText ||
              null,
            gueltigVon: null,
            gueltigBis: null,
            bildUrl: bild,
            kategorie: null,
            quelle: 'direkt',
          }),
        )
      }
    } catch (e) {
      console.warn(`[angebote:rewe] Shop-Suche "${q}":`, e)
    }
  }
  return out
}

/** Zuverlässiger Fallback: Marktguru inkl. rewe-center. */
async function ladeViaMarktguru(plz: string): Promise<Angebot[]> {
  const queries = ['', 'Milch', 'Käse', 'Fleisch', 'Getränke', 'Brot', 'Obst']
  const seen = new Set<string>()
  const out: Angebot[] = []
  for (const q of queries) {
    const batch = await marktguruSuche({
      query: q,
      plz,
      limit: 200,
      allowed: ['rewe'],
    })
    for (const a of batch) {
      if (seen.has(a.id)) continue
      seen.add(a.id)
      out.push({ ...a, quelle: 'marktguru' })
    }
  }
  return out
}

export const reweAdapter: AngeboteAdapter = {
  haendler: 'rewe',
  istDirekt: true,
  async fetchAngebote(ctx: AdapterKontext) {
    const marktId = ctx.marktId || ctx.maerkte.find((m) => m.haendler === 'rewe')?.marktId
    if (marktId && marktId !== 'default') {
      try {
        const shop = await ladeViaShopApi(marktId, ctx.plz)
        if (shop.length >= 8) {
          return { haendler: 'rewe', angebote: shop, quelle: 'direkt' }
        }
      } catch (e) {
        console.warn('[angebote:rewe] Shop-API:', e)
      }
    }

    const mg = await ladeViaMarktguru(ctx.plz)
    if (!mg.length) throw new Error('REWE: keine Angebote (Shop + Marktguru leer)')
    return { haendler: 'rewe', angebote: mg, quelle: 'marktguru' }
  },
}

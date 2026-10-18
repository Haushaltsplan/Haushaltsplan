import 'server-only'

import { fetchJson } from '@/lib/angebote/http'
import { marktguruFuerHaendler } from '@/lib/angebote/marktguru'
import { normalisiereAngebot, parsePreisEur } from '@/lib/angebote/normalisierung'
import type { AngeboteAdapter, AdapterKontext } from '@/lib/angebote/adapters/types'
import type { Angebot } from '@/lib/angebote/types'

type ReweProduct = {
  id?: string | number
  productName?: string
  title?: string
  brand?: { name?: string } | string
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

/**
 * Shop-API liefert Preise nur mit gültiger Markt-ID.
 * Market-Search ist oft 403 — daher nur versuchen, wenn wir eine ID haben.
 */
async function ladeViaShopApi(marktId: string, plz: string): Promise<Angebot[]> {
  const queries = ['Milch', 'Käse', 'Butter', 'Brot', 'Joghurt', 'Fleisch']
  const seen = new Set<string>()
  const out: Angebot[] = []

  const batches = await Promise.all(
    queries.map(async (q) => {
      const url =
        `https://shop.rewe.de/api/products?search=${encodeURIComponent(q)}` +
        `&market=${encodeURIComponent(marktId)}&objectsPerPage=40&page=1`
      try {
        const data = await fetchJson<ReweProductsResponse>(url, {
          label: 'rewe-shop',
          timeoutMs: 12_000,
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
        return data._embedded?.products ?? []
      } catch (e) {
        console.warn(`[angebote:rewe] Shop-Suche "${q}":`, e)
        return [] as ReweProduct[]
      }
    }),
  )

  for (const products of batches) {
    for (const p of products) {
      const art = p._embedded?.articles?.[0]
      const pricing = art?.listing?.pricing ?? p.pricing
      const cents =
        typeof (pricing as { currentDiscountedPrice?: number } | undefined)
          ?.currentDiscountedPrice === 'number'
          ? (pricing as { currentDiscountedPrice: number }).currentDiscountedPrice
          : typeof (pricing as { currentRetailPrice?: number } | undefined)?.currentRetailPrice ===
              'number'
            ? (pricing as { currentRetailPrice: number }).currentRetailPrice
            : null
      const preisEur =
        cents != null
          ? cents / 100
          : parsePreisEur((pricing as { price?: unknown } | undefined)?.price)
      const name = (art?.productName || p.productName || p.title || '').trim()
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
  }
  return out
}

export const reweAdapter: AngeboteAdapter = {
  haendler: 'rewe',
  istDirekt: true,
  async fetchAngebote(ctx: AdapterKontext) {
    // Primär: Marktguru (q=REWE liefert zuverlässig Wochenangebote inkl. rewe-center).
    // Shop-API braucht Markt-ID; Market-Search ist oft 403 → optional.
    const mgPromise = marktguruFuerHaendler(ctx.plz, 'rewe')

    const marktId = ctx.marktId || ctx.maerkte.find((m) => m.haendler === 'rewe')?.marktId
    let shop: Angebot[] = []
    const shopMarktOk = Boolean(marktId && marktId !== 'default' && marktId !== 'marktguru')
    if (shopMarktOk && marktId) {
      try {
        shop = await ladeViaShopApi(marktId, ctx.plz)
      } catch (e) {
        console.warn('[angebote:rewe] Shop-API:', e)
      }
    }

    const mg = await mgPromise
    if (shop.length >= 12) {
      // Shop-Preise mit Marktguru-Bildern/Marken anreichern wo IDs fehlen
      const seen = new Set(shop.map((a) => a.id))
      const merged = [...shop]
      for (const a of mg) {
        if (seen.has(a.id)) continue
        seen.add(a.id)
        merged.push(a)
      }
      return {
        haendler: 'rewe',
        angebote: merged,
        quelle: shop.length >= mg.length ? 'direkt' : 'marktguru',
      }
    }

    if (!mg.length) {
      throw new Error('REWE: keine Angebote über Marktguru (Shop ohne Markt-ID)')
    }
    return { haendler: 'rewe', angebote: mg, quelle: 'marktguru' }
  },
}

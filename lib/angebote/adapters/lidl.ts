import 'server-only'

import { fetchJson } from '@/lib/angebote/http'
import { normalisiereAngebot, parsePreisEur } from '@/lib/angebote/normalisierung'
import { geoFuerPlz } from '@/lib/angebote/plz-maerkte'
import type { AngeboteAdapter, AdapterKontext } from '@/lib/angebote/adapters/types'
import type { Angebot } from '@/lib/angebote/types'

const STORES_BASE = 'https://stores.lidlplus.com/api/'
const OFFERS_BASE = 'https://offers.lidlplus.com/app/api/'
const APP_VERSION = '17.0.5'

const lidlHeaders = {
  Accept: 'application/json',
  'Accept-Language': 'de-DE',
  'User-Agent': `LidlPlus/${APP_VERSION} Android okhttp/4.12.0`,
  'X-Client-Version': APP_VERSION,
  'X-Client-Platform': 'android',
}

type LidlStore = {
  storeKey?: string
  name?: string
  address?: string
  postalCode?: string
  locality?: string
  city?: string
}

type LidlOffer = {
  id?: string
  title?: string
  brand?: string
  price?: string
  oldPrice?: string
  pricePerUnit?: string
  packaging?: string
  imageUrl?: string
  image?: string
  category?: string
  startValidityDate?: string
  endValidityDate?: string
  priceBox?: {
    largePartNumeric?: number | null
    smallPartNumeric?: number | null
    largePartString?: string | null
    smallPartString?: string | null
  }
}

type LidlOffersResponse = {
  offers?: LidlOffer[]
  totalOffers?: number
}

async function findeStoreKey(plz: string): Promise<string> {
  const geo = await geoFuerPlz(plz)
  const lat = geo?.lat ?? 52.52
  const lon = geo?.lon ?? 13.405
  const url =
    `${STORES_BASE}v1/autocomplete/DE?input=${encodeURIComponent(plz)}` +
    `&language=de&latitude=${lat}&longitude=${lon}`
  try {
    const stores = await fetchJson<LidlStore[]>(url, {
      label: 'lidl-stores',
      timeoutMs: 15_000,
      headers: lidlHeaders,
    })
    const key = stores?.[0]?.storeKey?.trim()
    if (key) return key
  } catch (e) {
    console.warn('[angebote:lidl] Autocomplete:', e)
  }

  const catalog = await fetchJson<LidlStore[]>(`${STORES_BASE}v4/DE`, {
    label: 'lidl-catalog',
    timeoutMs: 25_000,
    headers: lidlHeaders,
  })
  const match = (catalog || []).find(
    (s) => (s.postalCode || '').trim() === plz || (s.address || '').includes(plz),
  )
  const key = match?.storeKey?.trim() || catalog?.[0]?.storeKey?.trim()
  if (!key) throw new Error('Lidl: keine Filiale gefunden')
  return key
}

export const lidlAdapter: AngeboteAdapter = {
  haendler: 'lidl',
  istDirekt: true,
  async fetchAngebote(ctx: AdapterKontext) {
    const storeKey =
      ctx.marktId && ctx.marktId !== ctx.plz ? ctx.marktId : await findeStoreKey(ctx.plz)
    const data = await fetchJson<LidlOffersResponse>(
      `${OFFERS_BASE}v4/DE/${encodeURIComponent(storeKey)}/offers`,
      {
        label: 'lidl-offers',
        timeoutMs: 20_000,
        headers: lidlHeaders,
      },
    )
    const list = data.offers ?? []
    if (!list.length) throw new Error('Lidl: keine Angebote für Filiale')

    const angebote = list
      .map((o, i): Angebot | null => {
        const name = (o.title || '').trim()
        const marke = o.brand?.trim() || null
        const preis =
          typeof o.priceBox?.largePartNumeric === 'number'
            ? o.priceBox.largePartNumeric
            : parsePreisEur(o.priceBox?.largePartString ?? o.price)
        if (!name || preis == null) return null
        const vorher =
          typeof o.priceBox?.smallPartNumeric === 'number'
            ? o.priceBox.smallPartNumeric
            : parsePreisEur(o.priceBox?.smallPartString ?? o.oldPrice)
        return normalisiereAngebot({
          id: `lidl-${o.id ?? i}`,
          haendler: 'lidl',
          name,
          marke,
          preisEur: preis,
          vorherigerPreisEur: vorher,
          packungText: o.packaging?.split('\n')[0]?.trim() || o.pricePerUnit || null,
          gueltigVon: o.startValidityDate ?? null,
          gueltigBis: o.endValidityDate ?? null,
          bildUrl: o.imageUrl || o.image || null,
          kategorie: o.category ?? null,
          quelle: 'direkt',
        })
      })
      .filter((x): x is Angebot => Boolean(x))

    if (!angebote.length) throw new Error('Lidl: Angebote ohne gültigen Preis')
    return { haendler: 'lidl', angebote, quelle: 'direkt' }
  },
}

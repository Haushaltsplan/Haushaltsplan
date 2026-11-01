/** Shopify-Produktschnittstelle. Gilt für jeden Shop mit /products/{handle}, z. B. Optimize, B.O.C., Fahrrad.de, Muc-Off. */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

type ShopifyVariante = {
  id?: unknown
  title?: unknown
  price?: unknown
  featured_image?: unknown
}

type ShopifyProdukt = {
  title?: unknown
  vendor?: unknown
  description?: unknown
  price?: unknown
  featured_image?: unknown
  images?: unknown
  variants?: unknown
}

export function shopifyProduktPfad(roh: string): { origin: string; handle: string; variant: string } | null {
  let url: URL
  try {
    url = new URL(roh)
  } catch {
    return null
  }
  const treffer = url.pathname.match(/\/products\/([^/?#]+)/i)
  const handle = (treffer?.[1] ?? '').replace(/\.js$/i, '').trim()
  if (!/^[a-z0-9][a-z0-9-]{1,}$/i.test(handle)) return null
  url.hash = ''
  url.search = ''
  url.pathname = url.pathname.replace(/\/products\/[^/?#]+.*$/i, `/products/${handle}`)
  return { origin: url.origin, handle, variant: new URL(roh).searchParams.get('variant')?.trim() ?? '' }
}

export function betragAusShopifyPreis(price: unknown): number | null {
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > 10000000) return null
  if (!Number.isInteger(price)) return Math.round(price * 100) / 100
  return Math.round(price) / 100
}

function textAusHtml(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function bildAdresse(raw: unknown, basis: string): string {
  const direkt = typeof raw === 'string' ? raw : ''
  const ausObjekt =
    raw && typeof raw === 'object' && !Array.isArray(raw) && typeof (raw as { src?: unknown }).src === 'string'
      ? (raw as { src: string }).src
      : ''
  const t = (direkt || ausObjekt).trim()
  if (!t) return ''
  try {
    const u = new URL(t, basis)
    if (u.protocol === 'http:') u.protocol = 'https:'
    if (u.protocol !== 'https:') return ''
    return u.toString()
  } catch {
    return ''
  }
}

/** Baut eine Produktseite, die der bestehende Auswerter lesen kann. */
export function shopifyHtmlAusProdukt(produkt: ShopifyProdukt, waehrung: string, seitenUrl: string): string {
  const titel = typeof produkt.title === 'string' ? produkt.title.replace(/\s+/g, ' ').trim() : ''
  if (titel.length < 2) return ''
  const varianten = Array.isArray(produkt.variants) ? (produkt.variants as ShopifyVariante[]) : []
  const variantId = shopifyProduktPfad(seitenUrl)?.variant ?? ''
  const gewaehlt = variantId ? varianten.find((v) => String(v.id ?? '') === variantId) : undefined
  const varianteTitel = typeof gewaehlt?.title === 'string' ? gewaehlt.title.replace(/\s+/g, ' ').trim() : ''
  const name =
    gewaehlt && varianteTitel && varianteTitel.toLowerCase() !== 'default title' ? `${titel} – ${varianteTitel}` : titel
  const cents = gewaehlt?.price ?? produkt.price
  const betrag = betragAusShopifyPreis(cents)
  const cur = waehrung.trim().toUpperCase()
  const bild =
    bildAdresse(gewaehlt?.featured_image, seitenUrl) ||
    bildAdresse(produkt.featured_image, seitenUrl) ||
    (Array.isArray(produkt.images) ? bildAdresse(produkt.images.find((x) => typeof x === 'string'), seitenUrl) : '')
  const beschreibung = textAusHtml(typeof produkt.description === 'string' ? produkt.description : '').slice(0, 800)
  const marke = typeof produkt.vendor === 'string' ? produkt.vendor.replace(/\s+/g, ' ').trim() : ''
  const angebot =
    betrag != null && /^[A-Z]{3}$/.test(cur)
      ? { '@type': 'Offer', price: betrag.toFixed(2), priceCurrency: cur }
      : undefined
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description: beschreibung,
    image: bild || undefined,
    brand: marke ? { '@type': 'Brand', name: marke } : undefined,
    offers: angebot,
  }
  const json = JSON.stringify(ld).replace(/</g, '\\u003c')
  return `<!doctype html><html><head><title>${name.replace(/[<>&]/g, '')}</title><script type="application/ld+json">${json}</script></head><body><p>${beschreibung.replace(/[<>&]/g, '')}</p></body></html>`
}

export async function shopifyRohHtml(produktUrl: string): Promise<{ finalUrl: string; html: string } | null> {
  const ziel = shopifyProduktPfad(produktUrl)
  if (!ziel) return null
  try {
    const [produktRes, cartRes] = await Promise.all([
      fetch(`${ziel.origin}/products/${encodeURIComponent(ziel.handle)}.js`, {
        headers: { Accept: 'application/json', 'User-Agent': UA, 'Accept-Language': 'de-DE,de;q=0.9' },
        cache: 'no-store',
        signal: AbortSignal.timeout(12_000),
      }),
      fetch(`${ziel.origin}/cart.js`, {
        headers: { Accept: 'application/json', 'User-Agent': UA, 'Accept-Language': 'de-DE,de;q=0.9' },
        cache: 'no-store',
        signal: AbortSignal.timeout(12_000),
      }),
    ])
    if (!produktRes.ok) return null
    const typ = (produktRes.headers.get('content-type') || '').toLowerCase()
    if (!typ.includes('json')) return null
    const produkt = (await produktRes.json()) as ShopifyProdukt
    let waehrung = ''
    if (cartRes.ok && (cartRes.headers.get('content-type') || '').toLowerCase().includes('json')) {
      const cart = (await cartRes.json()) as { currency?: unknown }
      if (typeof cart.currency === 'string') waehrung = cart.currency
    }
    const html = shopifyHtmlAusProdukt(produkt, waehrung, produktUrl)
    if (!html) return null
    return { finalUrl: produktUrl, html }
  } catch {
    return null
  }
}

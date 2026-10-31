import { absUrl } from '@/lib/radwerkstatt/radwerkstatt-url'

export type ProduktSeitenHinweis = {
  name: string
  beschreibung: string
  bildUrl: string
  preisEur: number | null
  preisText: string
  waehrung: string
  text: string
}

export function decodeHtml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => zeichen(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n: string) => zeichen(Number(n)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#0*39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
}

function zeichen(code: number): string {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return ''
  try {
    return String.fromCodePoint(code)
  } catch {
    return ''
  }
}

function metaTags(html: string): Array<Record<string, string>> {
  const tags: Array<Record<string, string>> = []
  const re = /<meta\b([^>]*)\/?>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const attrs: Record<string, string> = {}
    const ar = /([:\w-]+)\s*=\s*("([^"]*)"|'([^']*)')/g
    let a: RegExpExecArray | null
    while ((a = ar.exec(m[1] ?? ''))) {
      attrs[(a[1] ?? '').toLowerCase()] = decodeHtml(a[3] ?? a[4] ?? '')
    }
    tags.push(attrs)
  }
  return tags
}

function metaWert(tags: Array<Record<string, string>>, schluessel: string): string {
  const k = schluessel.toLowerCase()
  for (const t of tags) {
    const id = (t.property || t.name || t.itemprop || '').toLowerCase()
    if (id === k && t.content) return t.content.trim()
  }
  return ''
}

function titelTag(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m?.[1] ? decodeHtml(m[1]).replace(/\s+/g, ' ').trim() : ''
}

export function sichtbarerText(html: string): string {
  const ohne = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
  return decodeHtml(ohne).replace(/\s+/g, ' ').trim().slice(0, 6000)
}

function jsonLdBloecke(html: string): unknown[] {
  const out: unknown[] = []
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const roh = (m[1] ?? '').trim()
    if (!roh) continue
    try {
      out.push(JSON.parse(roh))
    } catch {
      /* Shop-JSON manchmal ungültig */
    }
  }
  return out
}

function typPasst(o: Record<string, unknown>, name: string): boolean {
  const t = o['@type']
  const liste = Array.isArray(t) ? t : [t]
  return liste.some((x) => String(x ?? '').toLowerCase().split('/').pop() === name.toLowerCase())
}

function gehJson(node: unknown, besuch: (o: Record<string, unknown>) => void) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const x of node) gehJson(x, besuch)
    return
  }
  const o = node as Record<string, unknown>
  besuch(o)
  if (o['@graph']) gehJson(o['@graph'], besuch)
}

function zahlAusPreis(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return Math.round(raw * 100) / 100
  if (typeof raw !== 'string') return null
  const t = raw.trim().replace(/\s/g, '')
  if (!t) return null
  const norm = t.includes(',') && !t.includes('.') ? t.replace(',', '.') : t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  const n = Number(norm.replace(/[^\d.]/g, ''))
  if (!Number.isFinite(n) || n < 0 || n > 100000) return null
  return Math.round(n * 100) / 100
}

function liesPreisFeld(raw: unknown, waehrungFallback: string): { betrag: number | null; waehrung: string } {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>
    const betrag = zahlAusPreis(o.amount ?? o.value ?? o.price)
    const waehrung = String(o.currencyCode || o.priceCurrency || o.currency || waehrungFallback || '')
      .trim()
      .toUpperCase()
    return { betrag, waehrung }
  }
  return { betrag: zahlAusPreis(raw), waehrung: waehrungFallback }
}

function preisAusAngebot(offers: unknown): { betrag: number | null; waehrung: string } {
  if (typeof offers === 'number' || typeof offers === 'string') return liesPreisFeld(offers, '')
  if (offers && typeof offers === 'object' && !Array.isArray(offers)) {
    const direkt = offers as Record<string, unknown>
    if ('amount' in direkt || 'currencyCode' in direkt) return liesPreisFeld(direkt, '')
  }
  const liste = Array.isArray(offers) ? offers : offers ? [offers] : []
  for (const eintrag of liste) {
    if (!eintrag || typeof eintrag !== 'object') continue
    const o = eintrag as Record<string, unknown>
    const spec = o.priceSpecification
    const specPreis =
      spec && typeof spec === 'object' ? (spec as Record<string, unknown>).price : undefined
    const waehrung = String(
      o.priceCurrency || (spec && typeof spec === 'object' ? (spec as Record<string, unknown>).priceCurrency : '') || '',
    )
      .trim()
      .toUpperCase()
    const gelesen = liesPreisFeld(o.price ?? o.lowPrice ?? specPreis, waehrung)
    if (gelesen.betrag != null) return gelesen
  }
  return { betrag: null, waehrung: '' }
}

/** Shopify legt den Preis oft neben das JSON-LD, als amount + currencyCode. */
function preisAusShopify(html: string): { betrag: number | null; waehrung: string } {
  const m = html.match(
    /"price"\s*:\s*\{\s*"amount"\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*,\s*"currencyCode"\s*:\s*"([A-Z]{3})"/,
  )
  if (!m) return { betrag: null, waehrung: '' }
  return { betrag: zahlAusPreis(m[1]), waehrung: m[2] ?? '' }
}

function ersteBildUrl(image: unknown, basis: string): string {
  if (typeof image === 'string') return absUrl(image, basis)
  if (Array.isArray(image)) {
    for (const x of image) {
      const u = ersteBildUrl(x, basis)
      if (u) return u
    }
    return ''
  }
  if (image && typeof image === 'object') {
    const url = (image as Record<string, unknown>).url ?? (image as Record<string, unknown>).contentUrl
    if (typeof url === 'string') return absUrl(url, basis)
  }
  return ''
}

function preisTextAus(betrag: number | null, waehrung: string): string {
  if (betrag == null) return ''
  if (!waehrung || waehrung === 'EUR') {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(betrag)
  }
  return `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(betrag)} ${waehrung}`
}

export function extrahiereProduktHinweise(html: string, seitenUrl: string): ProduktSeitenHinweis {
  const tags = metaTags(html)
  const ld = jsonLdBloecke(html)
  let name = ''
  let beschreibung = ''
  let bildUrl = ''
  let preisEur: number | null = null
  let anzeigeBetrag: number | null = null
  let waehrung = ''

  const merkePreis = (betrag: number | null, cur: string) => {
    if (betrag == null || anzeigeBetrag != null) return
    const c = cur.trim().toUpperCase()
    anzeigeBetrag = betrag
    waehrung = c
    if (!c || c === 'EUR') preisEur = betrag
  }

  for (const block of ld) {
    gehJson(block, (o) => {
      if (!typPasst(o, 'Product') && !typPasst(o, 'ProductGroup')) return
      if (!name && typeof o.name === 'string') name = decodeHtml(o.name).trim()
      if (!beschreibung && typeof o.description === 'string') beschreibung = decodeHtml(o.description).replace(/\s+/g, ' ').trim()
      if (!bildUrl) bildUrl = ersteBildUrl(o.image, seitenUrl)
      if (anzeigeBetrag == null) {
        const p = preisAusAngebot(o.offers ?? o.price)
        merkePreis(p.betrag, p.waehrung)
      }
    })
  }

  if (!name) name = metaWert(tags, 'og:title') || metaWert(tags, 'twitter:title') || titelTag(html)
  if (!beschreibung) beschreibung = metaWert(tags, 'og:description') || metaWert(tags, 'description')
  if (!bildUrl) bildUrl = absUrl(metaWert(tags, 'og:image') || metaWert(tags, 'twitter:image'), seitenUrl)

  if (anzeigeBetrag == null) {
    const amount = metaWert(tags, 'product:price:amount') || metaWert(tags, 'og:price:amount') || metaWert(tags, 'price')
    const cur = (metaWert(tags, 'product:price:currency') || metaWert(tags, 'og:price:currency') || 'EUR').toUpperCase()
    merkePreis(zahlAusPreis(amount), cur)
  }
  if (anzeigeBetrag == null) {
    const shop = preisAusShopify(html)
    merkePreis(shop.betrag, shop.waehrung)
  }

  name = name.replace(/\s+/g, ' ').trim().slice(0, 180)
  beschreibung = beschreibung.replace(/\s+/g, ' ').trim().slice(0, 800)

  return {
    name,
    beschreibung,
    bildUrl,
    preisEur,
    preisText: preisTextAus(anzeigeBetrag, waehrung || 'EUR'),
    waehrung: waehrung || (preisEur != null ? 'EUR' : ''),
    text: sichtbarerText(html),
  }
}

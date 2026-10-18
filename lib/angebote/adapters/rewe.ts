import 'server-only'

import { fetchText } from '@/lib/angebote/http'
import { normalisiereAngebot, parsePreisEur } from '@/lib/angebote/normalisierung'
import type { AngeboteAdapter, AdapterKontext } from '@/lib/angebote/adapters/types'
import type { Angebot } from '@/lib/angebote/types'

/**
 * REWE nationale Angebote (SSR-HTML). Regionale Market-API erfordert oft mTLS;
 * hier zuerst die öffentlich erlaubte Nationale-Angebote-Seite.
 */
async function ladeNationaleAngebote(): Promise<Angebot[]> {
  // Mehrere öffentlich erlaubte Angebots-URLs (Redirects auf den Onlineshop sind möglich).
  const urls = [
    'https://www.rewe.de/angebote/',
    'https://www.rewe.de/angebote/nationale-angebote/',
  ]
  let html = ''
  let lastErr: unknown
  for (const url of urls) {
    try {
      html = await fetchText(url, { label: 'rewe', timeoutMs: 20_000 })
      if (html.length > 2000 && !/REWE Onlineshop/i.test(html.slice(0, 500))) break
      if (/angebot|offer|preis/i.test(html)) break
    } catch (e) {
      lastErr = e
    }
  }
  if (!html) throw lastErr instanceof Error ? lastErr : new Error('REWE: keine Seite geladen')

  const out: Angebot[] = []
  const seen = new Set<string>()

  // Next/embedded JSON blobs mit Preisangaben
  const jsonBlocks = html.matchAll(
    /<script[^>]*type="application\/(?:ld\+json|json)"[^>]*>([\s\S]*?)<\/script>/gi,
  )
  for (const block of jsonBlocks) {
    try {
      const data = JSON.parse(block[1]!) as unknown
      sammelnAusJson(data, out, seen)
    } catch {
      /* ignore */
    }
  }

  // Fallback: HTML-Karten mit data-Attributen / Preis-Mustern nahe Produktnamen
  if (out.length < 5) {
    const cardRe =
      /<[^>]+data-product-name="([^"]+)"[^>]*>[\s\S]{0,800}?(\d+[.,]\d{2})\s*€/gi
    let m: RegExpExecArray | null
    while ((m = cardRe.exec(html)) !== null) {
      const name = decodeHtml(m[1]!).trim()
      const preis = parsePreisEur(m[2]!)
      if (!name || preis == null) continue
      const id = `rewe-html-${name}-${preis}`
      if (seen.has(id)) continue
      seen.add(id)
      out.push(
        normalisiereAngebot({
          id,
          haendler: 'rewe',
          name,
          marke: null,
          preisEur: preis,
          vorherigerPreisEur: null,
          packungText: null,
          gueltigVon: null,
          gueltigBis: null,
          bildUrl: null,
          kategorie: null,
          quelle: 'direkt',
        }),
      )
    }
  }

  if (out.length === 0) {
    throw new Error('REWE: keine Angebote im HTML gefunden')
  }
  return out
}

function sammelnAusJson(node: unknown, out: Angebot[], seen: Set<string>, depth = 0) {
  if (depth > 12 || node == null) return
  if (Array.isArray(node)) {
    for (const n of node) sammelnAusJson(n, out, seen, depth + 1)
    return
  }
  if (typeof node !== 'object') return
  const o = node as Record<string, unknown>
  const name =
    (typeof o.name === 'string' && o.name) ||
    (typeof o.title === 'string' && o.title) ||
    (typeof o.productName === 'string' && o.productName) ||
    null
  const priceRaw =
    o.price ?? o.offerPrice ?? o.nanPrice ?? (o.offers as { price?: unknown } | undefined)?.price
  const preis = parsePreisEur(priceRaw)
  if (name && preis != null && preis > 0 && preis < 500) {
    const id = `rewe-${String(o.id ?? name)}-${preis}`
    if (!seen.has(id)) {
      seen.add(id)
      out.push(
        normalisiereAngebot({
          id,
          haendler: 'rewe',
          name: String(name).trim(),
          marke: typeof o.brand === 'string' ? o.brand : null,
          preisEur: preis,
          vorherigerPreisEur: parsePreisEur(o.regularPrice ?? o.listPrice ?? o.oldPrice),
          packungText:
            typeof o.grammage === 'string'
              ? o.grammage
              : typeof o.packing === 'string'
                ? o.packing
                : null,
          gueltigVon: null,
          gueltigBis: null,
          bildUrl: typeof o.image === 'string' ? o.image : null,
          kategorie: typeof o.category === 'string' ? o.category : null,
          quelle: 'direkt',
        }),
      )
    }
  }
  for (const v of Object.values(o)) {
    if (v && typeof v === 'object') sammelnAusJson(v, out, seen, depth + 1)
  }
}

function decodeHtml(s: string) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

export const reweAdapter: AngeboteAdapter = {
  haendler: 'rewe',
  istDirekt: true,
  async fetchAngebote(_ctx: AdapterKontext) {
    const angebote = await ladeNationaleAngebote()
    return { haendler: 'rewe', angebote, quelle: 'direkt' }
  },
}

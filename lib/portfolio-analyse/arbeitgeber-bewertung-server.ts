/** Kununu / Glassdoor — Arbeitgeberbewertung (schwaches Signal, ergänzend). */

import 'server-only'

import type { ArbeitgeberBewertungPaket } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'

const CACHE_MS = 7 * 24 * 60 * 60 * 1000
const cache = new Map<string, { at: number; data: ArbeitgeberBewertungPaket | null }>()

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Accept: 'text/html',
} as const

function slugAusName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function ladeKununu(slug: string): Promise<ArbeitgeberBewertungPaket | null> {
  const url = `https://www.kununu.com/de/${slug}`
  const res = await fetch(url, { headers: FETCH_HEADERS, cache: 'no-store', redirect: 'follow' })
  if (!res.ok) return null
  const html = await res.text()
  const scoreM =
    html.match(/"overallScore":\s*([\d.]+)/) ??
    html.match(/data-score="([\d.]+)"/) ??
    html.match(/(\d[,.]\d)\s*\/\s*5/)
  const countM = html.match(/"reviewCount":\s*(\d+)/) ?? html.match(/(\d[\d.]*)\s*Bewertungen/i)
  if (!scoreM) return null
  const score = Number(scoreM[1].replace(',', '.'))
  if (!Number.isFinite(score)) return null
  return {
    score: score <= 5 ? Math.round(score * 20) / 10 : score,
    anzahlBewertungen: countM ? parseInt(countM[1].replace(/\./g, ''), 10) : null,
    plattform: 'kununu',
    url,
    hinweis: 'Kultur-Signal — subjektiv, nur ergänzend nutzen.',
  }
}

async function ladeGlassdoor(slug: string): Promise<ArbeitgeberBewertungPaket | null> {
  const url = `https://www.glassdoor.com/Overview/Working-at-${slug}-EI_IE.htm`
  const res = await fetch(url, { headers: FETCH_HEADERS, cache: 'no-store', redirect: 'follow' })
  if (!res.ok) return null
  const html = await res.text()
  const ratingM = html.match(/"rating":\s*([\d.]+)/) ?? html.match(/(\d[,.]\d)\s*out of 5/i)
  const countM = html.match(/"reviewCount":\s*(\d+)/)
  if (!ratingM) return null
  const score = Number(ratingM[1].replace(',', '.'))
  if (!Number.isFinite(score)) return null
  return {
    score: Math.round(score * 10) / 10,
    anzahlBewertungen: countM ? parseInt(countM[1], 10) : null,
    plattform: 'glassdoor',
    url,
    hinweis: 'Kultur-Signal — subjektiv, nur ergänzend nutzen.',
  }
}

export async function ladeArbeitgeberBewertung(
  firmenname: string,
  isEu: boolean,
): Promise<ArbeitgeberBewertungPaket | null> {
  const key = `${firmenname}|${isEu ? 'eu' : 'us'}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  const slug = slugAusName(firmenname)
  if (slug.length < 3) {
    cache.set(key, { at: Date.now(), data: null })
    return null
  }

  try {
    const data = isEu ? await ladeKununu(slug) : (await ladeGlassdoor(slug)) ?? (isEu ? null : await ladeKununu(slug))
    cache.set(key, { at: Date.now(), data: data ?? null })
    return data
  } catch {
    cache.set(key, { at: Date.now(), data: null })
    return null
  }
}

/** Kununu / Glassdoor — Arbeitgeberbewertung (schwaches Signal, ergänzend). */

import 'server-only'

import type {
  ArbeitgeberBewertungPaket,
  CeoZustimmung,
  PlattformBewertung,
} from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'

const CACHE_MS = 7 * 24 * 60 * 60 * 1000
const cache = new Map<string, { at: number; data: ArbeitgeberBewertungPaket | null }>()

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
} as const

const JINA_READER = 'https://r.jina.ai/'

function jinaHeaders(): Record<string, string> {
  const key = (process.env.JINA_API_KEY || '').trim()
  const headers: Record<string, string> = {
    Accept: 'text/plain',
    'X-Engine': 'browser',
    'X-No-Cache': 'true',
    'X-Timeout': '45',
  }
  if (key) {
    headers.Authorization = `Bearer ${key}`
    headers['X-Proxy'] = 'auto'
  }
  return headers
}

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

function normalisiereScore1bis5(raw: number): number | null {
  if (!Number.isFinite(raw)) return null
  if (raw > 5 && raw <= 10) return Math.round((raw / 2) * 10) / 10
  if (raw > 10) return null
  return Math.round(raw * 10) / 10
}

function parseZahlDe(s: string): number | null {
  const n = Number(s.replace(',', '.').trim())
  return Number.isFinite(n) ? n : null
}

function jinaMarkdownGueltig(text: string): boolean {
  if (/Humans only|Just a moment|Security \| Glassdoor/i.test(text)) return false
  if (/cf-browser-verification|access denied/i.test(text)) return false
  if (text.length < 3500) return false
  if (
    /based on [\d,]+ ratings|basierend auf [\d.]+ Bewertungen|approve of CEO|befürworten CEO/i.test(
      text,
    )
  ) {
    return true
  }
  return text.length >= 8000
}

async function fetchJinaMarkdown(zielUrl: string, versuche = 4): Promise<string | null> {
  for (let i = 0; i < versuche; i++) {
    try {
      const res = await fetch(`${JINA_READER}${zielUrl}`, {
        headers: jinaHeaders(),
        cache: 'no-store',
        redirect: 'follow',
      })
      if (!res.ok) {
        if (i < versuche - 1) await sleep(2500)
        continue
      }
      const text = await res.text()
      if (!jinaMarkdownGueltig(text)) {
        if (i < versuche - 1) await sleep(2500)
        continue
      }
      return text
    } catch {
      if (i < versuche - 1) await sleep(2500)
    }
  }
  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function ladeKununu(slugKandidaten: string[]): Promise<PlattformBewertung | null> {
  for (const slug of slugKandidaten) {
    const url = `https://www.kununu.com/de/${slug}`
    const res = await fetch(url, { headers: FETCH_HEADERS, cache: 'no-store', redirect: 'follow' })
    if (!res.ok) continue
    const html = await res.text()

    const nextM = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    if (nextM) {
      try {
        const blob = nextM[1]!
        const roundedM = blob.match(/"roundedScore":([\d.]+)/)
        const reviewsM =
          blob.match(/"numberOfReviews":(\d+)/) ??
          blob.match(/"totalReviewsEmployees":(\d+)/) ??
          blob.match(/"totalReviews":(\d+)/)
        if (roundedM) {
          const score = normalisiereScore1bis5(Number(roundedM[1]))
          if (score != null) {
            return {
              score,
              anzahlBewertungen: reviewsM ? parseInt(reviewsM[1]!, 10) : null,
              url: res.url || url,
            }
          }
        }
      } catch {
        /* JSON kaputt — Fallback unten */
      }
    }

    const scoreM =
      html.match(/"roundedScore":\s*([\d.]+)/) ??
      html.match(/"overallScore":\s*([\d.]+)/) ??
      html.match(/(\d[,.]\d)\s*\/\s*5/)
    if (!scoreM) continue
    const score = normalisiereScore1bis5(parseZahlDe(scoreM[1]) ?? NaN)
    if (score == null) continue
    const countM = html.match(/"numberOfReviews":\s*(\d+)/) ?? html.match(/(\d[\d.]*)\s*Bewertungen/i)
    return {
      score,
      anzahlBewertungen: countM ? parseInt(countM[1].replace(/\./g, ''), 10) : null,
      url: res.url || url,
    }
  }
  return null
}

function extrahiereGlassdoorOverviewPfade(text: string): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(/glassdoor\.com\/Overview\/(Working-at-[^\s")\]]+\.htm)/gi)) {
    out.add(m[1]!)
  }
  return [...out]
}

function waehleBestesGlassdoorProfil(pfade: string[], firmenname: string): string | null {
  if (pfade.length === 0) return null
  const slugZiel = slugAusName(firmenname)

  const scored = pfade.map((pfad) => {
    const slug = pfad.match(/Working-at-(.+?)-EI_IE/i)?.[1]?.toLowerCase() ?? ''
    let score = 0
    if (slug === slugZiel) score += 100
    else if (slug.startsWith(slugZiel)) score += 60
    else if (slugZiel.startsWith(slug) && slug.length >= 3) score += 40
    else if (slug.includes(slugZiel) || slugZiel.includes(slug)) score += 20
    if (/foundation|internship|contractor|subsidiary|holding-co/i.test(slug)) score -= 40
    return { pfad, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]
  if (!best) return null
  if (best.score > 0 || pfade.length === 1) return best.pfad
  return null
}

async function sucheGlassdoorViaDdg(firmenname: string): Promise<{
  profilUrl: string | null
  suchMarkdown: string | null
}> {
  const name = firmenname.trim()
  const q = encodeURIComponent(`site:glassdoor.com ${name} Overview EI_IE`)
  const ddgUrl = `https://html.duckduckgo.com/html/?q=${q}`
  const suchMarkdown = await fetchJinaMarkdown(ddgUrl, 2)
  if (!suchMarkdown) return { profilUrl: null, suchMarkdown: null }

  const pfad = waehleBestesGlassdoorProfil(extrahiereGlassdoorOverviewPfade(suchMarkdown), name)
  return {
    profilUrl: pfad ? `https://www.glassdoor.com/Overview/${pfad}` : null,
    suchMarkdown,
  }
}

function parseGlassdoorAusDdgSnippet(md: string, firmenname: string, url: string): PlattformBewertung | null {
  const nameEsc = firmenname.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const ratingM =
    md.match(
      new RegExp(
        `${nameEsc}[^\\n]{0,80}overall rating of (\\d[,.]\\d) out of 5, based on (?:over )?([\\d,]+) reviews`,
        'i',
      ),
    ) ??
    md.match(/overall rating of (\d[,.]\d) out of 5, based on (?:over )?([\d,]+) reviews/i) ??
    md.match(/rated [^0-9]{0,40}with (\d[,.]\d) out of 5 stars based on ([\d,]+) company reviews/i)

  if (!ratingM) return null
  const score = normalisiereScore1bis5(parseZahlDe(ratingM[1]) ?? NaN)
  if (score == null) return null

  return {
    score,
    anzahlBewertungen: parseInt(ratingM[2]!.replace(/[.,]/g, ''), 10) || null,
    url,
  }
}

function parseGlassdoorMarkdown(md: string, url: string): {
  unternehmen: PlattformBewertung | null
  ceo: CeoZustimmung | null
} {
  const ratingM =
    md.match(/(\d[,.]\d)\s*\n+based on ([\d,]+) ratings/i) ??
    md.match(/employee rating of (\d[,.]\d) out of 5 stars, based on ([\d,]+)/i) ??
    md.match(/(\d[,.]\d)\s*\n+basierend auf ([\d.]+) Bewertungen/i) ??
    md.match(/Mitarbeiterbewertung von (\d[,.]\d) von 5 Sternen/i)

  const ceoM =
    md.match(/!\[[^\]]*\]\([^)]+\)\s*\n+([^\n]+)\n+(\d{1,3})%\s*(?:approve of CEO|befürworten CEO)/i) ??
    md.match(
      /([A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ.'-]+(?:\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ.'-]+){0,3})\s+(\d{1,3})%\s*(?:approve of CEO|befürworten CEO)/i,
    )

  let unternehmen: PlattformBewertung | null = null
  if (ratingM) {
    const score = normalisiereScore1bis5(parseZahlDe(ratingM[1]) ?? NaN)
    if (score != null) {
      unternehmen = {
        score,
        anzahlBewertungen: parseInt(ratingM[2]!.replace(/[.,]/g, ''), 10) || null,
        url,
      }
    }
  }

  let ceo: CeoZustimmung | null = null
  if (ceoM) {
    const pct = parseInt(ceoM[2]!, 10)
    if (Number.isFinite(pct) && pct >= 0 && pct <= 100) {
      ceo = {
        name: ceoM[1]!.trim(),
        zustimmungPct: pct,
        url,
      }
    }
  }

  return { unternehmen, ceo }
}

async function ladeGlassdoor(firmenname: string): Promise<{
  unternehmen: PlattformBewertung | null
  ceo: CeoZustimmung | null
}> {
  const { profilUrl, suchMarkdown } = await sucheGlassdoorViaDdg(firmenname)
  if (!profilUrl) return { unternehmen: null, ceo: null }

  const md = await fetchJinaMarkdown(profilUrl)
  if (md) return parseGlassdoorMarkdown(md, profilUrl)

  const unternehmen =
    suchMarkdown != null ? parseGlassdoorAusDdgSnippet(suchMarkdown, firmenname, profilUrl) : null
  return { unternehmen, ceo: null }
}

function kununuSlugKandidaten(firmenname: string, isEu: boolean): string[] {
  const base = slugAusName(firmenname)
  const out = new Set<string>()
  if (base.length >= 3) out.add(base)
  if (!isEu && base.length >= 3) out.add(`${base}-europe`)
  const first = base.split('-')[0]
  if (first && first.length >= 3) out.add(first)
  return [...out]
}

export async function ladeArbeitgeberBewertung(
  firmenname: string,
  isEu: boolean,
): Promise<ArbeitgeberBewertungPaket | null> {
  const key = `${firmenname.trim().toLowerCase()}|${isEu ? 'eu' : 'us'}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  const name = firmenname.trim()
  if (name.length < 2) {
    cache.set(key, { at: Date.now(), data: null })
    return null
  }

  try {
    const slugs = kununuSlugKandidaten(name, isEu)
    const [kununu, glassdoorRes] = await Promise.all([
      ladeKununu(slugs),
      ladeGlassdoor(name),
    ])

    const data: ArbeitgeberBewertungPaket = {
      kununu,
      glassdoor: glassdoorRes.unternehmen,
      glassdoorCeo: glassdoorRes.ceo,
      hinweis: 'Kultur-Signal — subjektiv, nur ergänzend nutzen.',
    }

    if (!kununu && !glassdoorRes.unternehmen && !glassdoorRes.ceo) {
      cache.set(key, { at: Date.now(), data: null })
      return null
    }

    cache.set(key, { at: Date.now(), data })
    return data
  } catch {
    cache.set(key, { at: Date.now(), data: null })
    return null
  }
}

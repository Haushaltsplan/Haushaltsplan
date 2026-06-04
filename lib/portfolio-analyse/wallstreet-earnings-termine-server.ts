import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import type { FinnhubEarningsKalenderTermin } from '@/lib/portfolio-analyse/finnhub-earnings-kalender-server'
import { wallstreetSlugKandidaten } from '@/lib/portfolio-analyse/wallstreet-earnings-schaetzungen-server'

const BASE = 'https://www.wallstreet-online.de/aktien'
const CACHE_MS = 6 * 60 * 60 * 1000
const MIN_ABSTAND_MS = 280
const JITTER_MS_MAX = 100

let letzterAbruf = 0
const pageCache = new Map<string, { at: number; html: string | null }>()

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function scrapePauseMs(): number {
  return MIN_ABSTAND_MS + Math.floor(Math.random() * JITTER_MS_MAX)
}

function isoAusDeDatum(tag: number, monat: number, jahr: number): string {
  return `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`
}

/** Quartals-/Bilanztermine aus Wallstreet-Online (deutsche Seite, sanftes Scraping). */
export function parseWallstreetEarningsTermine(
  html: string,
  vonIso: string,
  bisIso: string,
): FinnhubEarningsKalenderTermin[] {
  const seen = new Set<string>()
  const out: FinnhubEarningsKalenderTermin[] = []

  const push = (iso: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return
    if (iso < vonIso || iso > bisIso || seen.has(iso)) return
    seen.add(iso)
    out.push({ terminDatumIso: iso, berichtszeit: null, quartal: null, jahr: null })
  }

  const kontext =
    /(?:quartalszahlen|geschäftsbericht|bilanzpresse|earnings|ergebnis|hauptversammlung)[\s\S]{0,220}?(\d{1,2})\.(\d{1,2})\.(\d{4})/gi
  let m: RegExpExecArray | null
  while ((m = kontext.exec(html)) !== null) {
    push(isoAusDeDatum(Number(m[1]), Number(m[2]), Number(m[3])))
  }

  for (const block of html.matchAll(
    /"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})[^"]*"/gi,
  )) {
    push(block[1].slice(0, 10))
  }

  return out.sort((a, b) => a.terminDatumIso.localeCompare(b.terminDatumIso))
}

async function fetchWallstreetHtml(slug: string): Promise<string | null> {
  const cached = pageCache.get(slug)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.html

  const now = Date.now()
  const warten = Math.max(0, scrapePauseMs() - (now - letzterAbruf))
  if (warten > 0) await pause(warten)
  letzterAbruf = Date.now()

  const urls = [`${BASE}/${slug}`, `${BASE}/${slug}/uebersicht`]

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
          Referer: 'https://www.wallstreet-online.de/',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          DNT: '1',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(18_000),
      })
      if (!res.ok) continue
      const html = await res.text()
      if (html.length > 25_000) {
        pageCache.set(slug, { at: Date.now(), html })
        return html
      }
    } catch {
      continue
    }
  }
  pageCache.set(slug, { at: Date.now(), html: null })
  return null
}

export async function ladeWallstreetEarningsTermine(
  isin: string,
  name: string,
  vonIso: string,
  bisIso: string,
): Promise<FinnhubEarningsKalenderTermin[]> {
  const isinNorm = isin.trim().toUpperCase()
  if (isinNorm.length < 10) return []

  for (const slug of wallstreetSlugKandidaten(isinNorm, isinKenntnis(isinNorm)?.name ?? name)) {
    const html = await fetchWallstreetHtml(slug)
    if (!html) continue
    const parsed = parseWallstreetEarningsTermine(html, vonIso, bisIso)
    if (parsed.length > 0) return parsed
  }
  return []
}

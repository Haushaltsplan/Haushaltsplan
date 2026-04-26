import { parseGoogleNewsRssItems, type RohGoogleNewsEintrag } from '@/lib/google-news-rss'
import type { NewsEintrag } from '@/lib/region-haarbach'
import { SPORT_RENNRAD_SCHLUESSELWOERTER } from '@/lib/sport-rennrad-keywords'
import { SPORT_WINTER_SCHLUESSELWOERTER } from '@/lib/sport-winter-keywords'
import { passtRadsportEintrag, passtWintersportEintrag } from '@/lib/sport-profi-news-filter'

/**
 * Lokal: in `.env.local` **eine** Zeile, die die jeweilige Listing-Suche ersetzt.
 * Radsport: `sport-rennrad-keywords.ts` Batches. Wintersport: `sport-winter-keywords.ts` Batches.
 * @see .env.example — HAUSHALT_SPORT_RENNRAD_QUERY, HAUSHALT_SPORT_WINTER_QUERY
 */

/**
 * Google-News-Operator `when:` — siehe frühere Diskussion; ohne `when:` oft alte Top-Treffer.
 */
const WHEN_STANDARD = '14d'

function qMitZeitfenster(kern: string): string {
  const t = kern.trim()
  if (!t) return encodeURIComponent(`Radsport when:${WHEN_STANDARD}`)
  if (/\bwhen:\d+[hdm]\b/i.test(t)) {
    return encodeURIComponent(t)
  }
  return encodeURIComponent(`${t} when:${WHEN_STANDARD}`)
}

const NEWS_MAX_ALTER_MS = 14 * 24 * 60 * 60 * 1000

function artikelIstAktuell(veroeffentlichtAm: string | null): boolean {
  if (!veroeffentlichtAm) return false
  const t = Date.parse(veroeffentlichtAm)
  if (!Number.isFinite(t)) return false
  return t >= Date.now() - NEWS_MAX_ALTER_MS
}

const FETCH: RequestInit = {
  next: { revalidate: 300 },
  headers: { 'User-Agent': 'mein-haushalt/1.0 (private; pro sport news)' },
}

function rohZuEintrag(roh: RohGoogleNewsEintrag): NewsEintrag {
  return {
    titel: roh.titel,
    href: roh.href,
    quelle: roh.quelle,
    veroeffentlichtAm: roh.veroeffentlichtAm,
  }
}

function alsSuchbegriff(name: string): string {
  const t = name.trim()
  if (!t) return ''
  if (
    /[\s&]/.test(t) ||
    /['"\.]/.test(t) ||
    /[–—]/.test(t) ||
    /[A-Za-z]-[A-Za-z]/.test(t)
  ) {
    return `"${t.replace(/"/g, '')}"`
  }
  return t
}

function chunken<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

/** Obergrenze, damit `q` pro Request nicht die URL sprengt (Google ~2k) */
const SPORT_BEGRIFFE_PRO_BATCH = 6

function verarbeiteRohNews(
  alle: RohGoogleNewsEintrag[],
  passt: (roh: RohGoogleNewsEintrag) => boolean,
): { artikel: NewsEintrag[] } {
  const gesehen = new Set<string>()
  const artikel: NewsEintrag[] = []
  for (const roh of alle) {
    if (gesehen.has(roh.href)) continue
    gesehen.add(roh.href)
    if (!artikelIstAktuell(roh.veroeffentlichtAm)) continue
    if (!passt(roh)) continue
    artikel.push(rohZuEintrag(roh))
  }
  artikel.sort((a, b) => {
    const ta = a.veroeffentlichtAm ? new Date(a.veroeffentlichtAm).getTime() : 0
    const tb = b.veroeffentlichtAm ? new Date(b.veroeffentlichtAm).getTime() : 0
    return tb - ta
  })
  return { artikel: artikel.slice(0, 12) }
}

async function fetchGoogleNewsRoh(
  qParamEncoded: string,
): Promise<{ roh: RohGoogleNewsEintrag[]; httpFehler: string | null }> {
  const url = `https://news.google.com/rss/search?q=${qParamEncoded}&hl=de&gl=DE&ceid=DE:de`
  try {
    const res = await fetch(url, FETCH)
    if (!res.ok) {
      if (res.status === 404 || res.status === 410) {
        return { roh: [], httpFehler: null }
      }
      return { roh: [], httpFehler: `Google News: ${res.status}` }
    }
    const xml = await res.text()
    return {
      roh: parseGoogleNewsRssItems(xml, 'Google News', 100),
      httpFehler: null,
    }
  } catch (e) {
    return {
      roh: [],
      httpFehler: e instanceof Error ? e.message : 'Fehler',
    }
  }
}

async function ladeEinenSportFeed(
  qParam: string,
  label: string,
  passt: (roh: RohGoogleNewsEintrag) => boolean,
): Promise<{ artikel: NewsEintrag[]; fehler: string | null }> {
  const { roh, httpFehler } = await fetchGoogleNewsRoh(qParam)
  if (httpFehler) {
    return { artikel: [], fehler: `Google News (${label}): ${httpFehler}` }
  }
  const { artikel } = verarbeiteRohNews(roh, passt)
  return { artikel, fehler: null }
}

async function ladeRennradAusKeywordBatches(): Promise<{
  artikel: NewsEintrag[]
  fehler: string | null
}> {
  const begriffe = SPORT_RENNRAD_SCHLUESSELWOERTER.map(alsSuchbegriff).filter((s) => s.length > 0)
  const kacheln = chunken(begriffe, SPORT_BEGRIFFE_PRO_BATCH)
  const fehler: string[] = []
  const alle: RohGoogleNewsEintrag[] = []

  await Promise.all(
    kacheln.map(async (g) => {
      const orKette = g.join(' OR ')
      if (!orKette) return
      const q = qMitZeitfenster(orKette)
      const { roh, httpFehler } = await fetchGoogleNewsRoh(q)
      if (httpFehler) fehler.push(httpFehler)
      alle.push(...roh)
    }),
  )

  const { artikel } = verarbeiteRohNews(alle, (r) =>
    passtRadsportEintrag(r, SPORT_RENNRAD_SCHLUESSELWOERTER),
  )
  return {
    artikel,
    fehler: fehler.length ? fehler.join(' · ') : null,
  }
}

/**
 * Radsport: entweder `HAUSHALT_SPORT_RENNRAD_QUERY` (eine Suche) oder
 * viele parallele Batches mit `SPORT_RENNRAD_SCHLUESSELWOERTER` + `when:14d`.
 */
export function ladeProfirennradsportNews(): Promise<{
  artikel: NewsEintrag[]
  fehler: string | null
}> {
  const fromEnv = (process.env.HAUSHALT_SPORT_RENNRAD_QUERY ?? '').trim()
  if (fromEnv) {
    return ladeEinenSportFeed(qMitZeitfenster(fromEnv), 'Radsport', (r) =>
      passtRadsportEintrag(r, SPORT_RENNRAD_SCHLUESSELWOERTER),
    )
  }
  return ladeRennradAusKeywordBatches()
}

async function ladeWinterAusKeywordBatches(): Promise<{
  artikel: NewsEintrag[]
  fehler: string | null
}> {
  const begriffe = SPORT_WINTER_SCHLUESSELWOERTER.map(alsSuchbegriff).filter((s) => s.length > 0)
  const kacheln = chunken(begriffe, SPORT_BEGRIFFE_PRO_BATCH)
  const fehler: string[] = []
  const alle: RohGoogleNewsEintrag[] = []

  await Promise.all(
    kacheln.map(async (g) => {
      const orKette = g.join(' OR ')
      if (!orKette) return
      const q = qMitZeitfenster(orKette)
      const { roh, httpFehler } = await fetchGoogleNewsRoh(q)
      if (httpFehler) fehler.push(httpFehler)
      alle.push(...roh)
    }),
  )

  const { artikel } = verarbeiteRohNews(alle, (r) =>
    passtWintersportEintrag(r, SPORT_WINTER_SCHLUESSELWOERTER),
  )
  return {
    artikel,
    fehler: fehler.length ? fehler.join(' · ') : null,
  }
}

/**
 * Wintersport: `HAUSHALT_SPORT_WINTER_QUERY` ersetzt die eingebettete Liste;
 * sonst Batches mit `SPORT_WINTER_SCHLUESSELWOERTER` + `when:14d`.
 */
export function ladeProfiWintersportNews() {
  const fromEnv = (process.env.HAUSHALT_SPORT_WINTER_QUERY ?? '').trim()
  if (fromEnv) {
    return ladeEinenSportFeed(qMitZeitfenster(fromEnv), 'Wintersport', (r) =>
      passtWintersportEintrag(r, SPORT_WINTER_SCHLUESSELWOERTER),
    )
  }
  return ladeWinterAusKeywordBatches()
}

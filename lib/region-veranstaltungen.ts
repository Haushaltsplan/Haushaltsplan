import { parseGoogleNewsRssItems, type RohGoogleNewsEintrag } from '@/lib/google-news-rss'
import type { NewsEintrag } from '@/lib/region-haarbach'
import { passtNewsLautRegionSchlagwortliste } from '@/lib/region-haarbach-news-filter'

const UMKREIS_30KM_ORTSQUERY = encodeURIComponent(
  [
    'Haarbach',
    'Aidenbach',
    'Aldersbach',
    '"Bad Birnbach"',
    '"Bad Griesbach"',
    'Beutelsbach',
    'Egglham',
    'Fürstenzell',
    'Kößlarn',
    'Ortenburg',
    'Tettenweis',
    'Ruhstorf',
    'Vilshofen',
    '"Landkreis Passau"',
  ].join(' OR '),
)

const EVENT_KEYWORDS = encodeURIComponent(
  [
    'Veranstaltung',
    'Event',
    'Fest',
    'Kirta',
    'Kirtag',
    'Dorffest',
    'Volksfest',
    'Konzert',
    'Theater',
    'Kabarett',
    'Markt',
    'Flohmarkt',
    'Feuerwehrfest',
    'Vereinsfest',
  ].join(' OR '),
)

const FEEDS: Array<{ url: string; quelle: string }> = [
  {
    url: `https://news.google.com/rss/search?q=(${UMKREIS_30KM_ORTSQUERY})+(${EVENT_KEYWORDS})&hl=de&gl=DE&ceid=DE:de`,
    quelle: 'Google News',
  },
  {
    url: `https://news.google.com/rss/search?q=site:pnp.de+(${UMKREIS_30KM_ORTSQUERY})+(${EVENT_KEYWORDS})&hl=de&gl=DE&ceid=DE:de`,
    quelle: 'Google News',
  },
]

const EVENT_RE = /\b(veranstaltung|event|fest|kirta|kirtag|konzert|theater|kabarett|markt|flohmarkt|fireabend|vereinsfest)\b/i
const NEWS_MAX_ALTER_MS = 45 * 24 * 60 * 60 * 1000

function istFrisch(veroeffentlichtAm: string | null): boolean {
  if (!veroeffentlichtAm) return false
  const t = Date.parse(veroeffentlichtAm)
  if (!Number.isFinite(t)) return false
  return t >= Date.now() - NEWS_MAX_ALTER_MS
}

function istVeranstaltungsArtikel(volltext: string): boolean {
  return EVENT_RE.test(volltext)
}

export async function ladeRegionVeranstaltungen(): Promise<{ artikel: NewsEintrag[]; fehler: string | null }> {
  const alle: RohGoogleNewsEintrag[] = []
  const fehler: string[] = []

  await Promise.all(
    FEEDS.map(async ({ url, quelle }) => {
      try {
        const res = await fetch(url, {
          next: { revalidate: 900 },
          headers: { 'User-Agent': 'omnia/1.0 (private; region events)' },
        })
        if (!res.ok) {
          if (res.status !== 404 && res.status !== 410) {
            fehler.push(`${quelle}: ${res.status}`)
          }
          return
        }
        const xml = await res.text()
        const items = parseGoogleNewsRssItems(xml, quelle, 80)
        alle.push(...items)
      } catch (e) {
        fehler.push(`${quelle}: ${e instanceof Error ? e.message : 'Fehler'}`)
      }
    }),
  )

  const seen = new Set<string>()
  const dedup: RohGoogleNewsEintrag[] = []
  for (const a of alle) {
    if (seen.has(a.href)) continue
    if (!passtNewsLautRegionSchlagwortliste(a.sucheFuerLokal)) continue
    if (!istVeranstaltungsArtikel(a.sucheFuerLokal)) continue
    seen.add(a.href)
    dedup.push(a)
  }

  const artikel: NewsEintrag[] = dedup
    .map(({ sucheFuerLokal: _ignore, ...rest }) => rest)
    .filter((a) => istFrisch(a.veroeffentlichtAm))
    .sort((a, b) => {
      const ta = a.veroeffentlichtAm ? Date.parse(a.veroeffentlichtAm) : 0
      const tb = b.veroeffentlichtAm ? Date.parse(b.veroeffentlichtAm) : 0
      return tb - ta
    })

  return { artikel: artikel.slice(0, 20), fehler: fehler.length ? fehler.join(' · ') : null }
}

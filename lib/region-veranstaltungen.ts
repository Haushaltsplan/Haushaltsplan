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
    quelle: 'Google News · PNP',
  },
  {
    url: `https://news.google.com/rss/search?q=site:facebook.com/events+(${UMKREIS_30KM_ORTSQUERY})+(${EVENT_KEYWORDS})&hl=de&gl=DE&ceid=DE:de`,
    quelle: 'Google News · Facebook',
  },
  {
    url: `https://news.google.com/rss/search?q=site:eventfrog.de+(${UMKREIS_30KM_ORTSQUERY})+(${EVENT_KEYWORDS})&hl=de&gl=DE&ceid=DE:de`,
    quelle: 'Google News · Eventfrog',
  },
  {
    url: `https://news.google.com/rss/search?q=site:eventbrite.de+(${UMKREIS_30KM_ORTSQUERY})+(${EVENT_KEYWORDS})&hl=de&gl=DE&ceid=DE:de`,
    quelle: 'Google News · Eventbrite',
  },
]

const EVENT_RE = /\b(veranstaltung|event|fest|kirta|kirtag|konzert|theater|kabarett|markt|flohmarkt|fireabend|vereinsfest)\b/i
const MAX_VORSCHAU_TAGE = 400

function istVeranstaltungsArtikel(volltext: string): boolean {
  return EVENT_RE.test(volltext)
}

const MONAT_DE: Record<string, number> = {
  januar: 1,
  jan: 1,
  februar: 2,
  feb: 2,
  maerz: 3,
  märz: 3,
  mrz: 3,
  april: 4,
  apr: 4,
  mai: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  dezember: 12,
  dez: 12,
}

function normalisiereText(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
}

function ausYmd(y: number, m: number, d: number): Date | null {
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
  dt.setHours(0, 0, 0, 0)
  return dt
}

function parseVeranstaltungsDatum(volltext: string, pubIso: string | null): string | null {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const max = new Date(now)
  max.setDate(max.getDate() + MAX_VORSCHAU_TAGE)
  const pub = pubIso ? new Date(pubIso) : null
  if (pub && Number.isFinite(pub.getTime())) pub.setHours(0, 0, 0, 0)
  const txt = normalisiereText(volltext)

  // 1) dd.mm.yyyy oder dd-mm-yyyy
  {
    const m = /\b(\d{1,2})[.\-/](\d{1,2})[.\-/](20\d{2})\b/.exec(txt)
    if (m) {
      const dt = ausYmd(Number(m[3]), Number(m[2]), Number(m[1]))
      if (dt && dt >= now && dt <= max) return dt.toISOString()
    }
  }

  // 2) dd.mm. (ohne Jahr) -> heuristisch dieses oder nächstes Jahr
  {
    const m = /\b(\d{1,2})\.(\d{1,2})\.(?!\d)/.exec(txt)
    if (m) {
      const d = Number(m[1])
      const mo = Number(m[2])
      const y0 = now.getFullYear()
      const k1 = ausYmd(y0, mo, d)
      const k2 = ausYmd(y0 + 1, mo, d)
      const kandidat = [k1, k2].find((x) => x != null && x >= now && x <= max) ?? null
      if (kandidat) return kandidat.toISOString()
    }
  }

  // 3) 7. mai / 7 mai (deutscher Monatsname)
  {
    const m = /\b(\d{1,2})\.?\s*(januar|jan|februar|feb|maerz|märz|mrz|april|apr|mai|juni|jun|juli|jul|august|aug|september|sept|sep|oktober|okt|november|nov|dezember|dez)\b/.exec(
      txt,
    )
    if (m) {
      const d = Number(m[1])
      const mo = MONAT_DE[m[2]] ?? 0
      const y0 = now.getFullYear()
      const k1 = ausYmd(y0, mo, d)
      const k2 = ausYmd(y0 + 1, mo, d)
      const kandidat = [k1, k2].find((x) => x != null && x >= now && x <= max) ?? null
      if (kandidat) return kandidat.toISOString()
    }
  }

  // Fallback: Veröffentlichungsdatum nur, wenn es in der Zukunft liegt.
  if (pub && pub >= now && pub <= max) return pub.toISOString()
  return null
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
    .flatMap((a) => {
      const terminIso = parseVeranstaltungsDatum(a.sucheFuerLokal, a.veroeffentlichtAm)
      if (!terminIso) return []
      return [
        {
            titel: a.titel,
            href: a.href,
            quelle: a.quelle,
            veroeffentlichtAm: terminIso,
          },
      ]
    })
    .sort((a, b) => {
      const ta = a.veroeffentlichtAm ? Date.parse(a.veroeffentlichtAm) : Number.POSITIVE_INFINITY
      const tb = b.veroeffentlichtAm ? Date.parse(b.veroeffentlichtAm) : Number.POSITIVE_INFINITY
      return ta - tb
    })

  return { artikel: artikel.slice(0, 20), fehler: fehler.length ? fehler.join(' · ') : null }
}

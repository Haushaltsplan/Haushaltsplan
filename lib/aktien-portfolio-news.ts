import { parseGoogleNewsRssItems, type RohGoogleNewsEintrag } from '@/lib/google-news-rss'
import type { NewsEintrag } from '@/lib/region-haarbach'

/**
 * Unternehmen im Portfolio (Suchbegriffe für Google News)
 */
const UNTERNEHMEN: string[] = [
  'Alphabet',
  'Mastercard',
  'Microsoft',
  'Hermès',
  'S&P Global',
  'Visa',
  'ResMed',
  'ASML Holding',
  'Zoetis',
  'MSCI',
  'UnitedHealth',
  'Thermo Fisher Scientific',
  'Waste Management',
  'Old Dominion Freight Line',
  'LVMH',
  'ServiceNow',
  'Linde',
  'Balchem Corporation',
  'Kinsale Capital',
  'Home Depot',
  'Halma',
  'Arista Networks',
  "McDonald's",
  'Rollins',
  'Veeva Systems',
  'Sherwin-Williams',
  'Straumann Holding',
  'Graco',
  'Alimentation Couche-Tard',
  'Sika',
  'Danaher',
  'Datadog',
  'Edwards Lifesciences',
  'IMCD',
  'Mensch und Maschine',
  'Union Pacific',
  'Upstart',
  'Wolters Kluwer',
  'Netflix',
  'BlackRock',
]

/** Google `q=`: muss in Verbindung mit Unternehmen vorkommen (rohe Vorfilterung) */
const SIGNAL_SUCHFELDER = [
  'Quartal',
  'Quartalsergebnis',
  'Jahreszahlen',
  'Dividende',
  'Dividend',
  'Insider',
  'insiderkauf',
  'insiderverkauf',
  'Übernahme',
  'Akquisition',
  'acquisition',
  'merger',
  'earnings',
  'EBIT',
  'Q1',
  'Q2',
  'Q3',
  'Q4',
  'Anleihe',
  'Schuldenaufnahme',
  'Aktienrückkauf',
  'buyback',
  'Hauptversammlung',
  'Zulassung',
  'FDA',
  'launch',
  'Produktlaunch',
  'guidance',
  'Ausblick',
  'Form 4',
  '8-K',
  'Kredit',
  'Emission',
  'Jahresbericht',
].map((s) => (s.includes(' ') || /[^a-zA-Z0-9äöüÄÖÜß-]/.test(s) ? `"${s.replace(/"/g, '')}"` : s))

const SIGNAL_MUSTER = `(${SIGNAL_SUCHFELDER.join(' OR ')})`

function alsSuchbegriff(name: string): string {
  const t = name.trim()
  if (!t) return ''
  if (/[\s&]/.test(t) || /['"\.]/.test(t)) {
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

const NEWS_MAX_ALTER_MS = 14 * 24 * 60 * 60 * 1000

function artikelIstAktuell(veroeffentlichtAm: string | null): boolean {
  if (!veroeffentlichtAm) return false
  const t = Date.parse(veroeffentlichtAm)
  if (!Number.isFinite(t)) return false
  return t >= Date.now() - NEWS_MAX_ALTER_MS
}

/**
 * Strenge inhaltliche Prüfung: Titel + Snippet. Mind. ein Treffer der Kategorien
 * (Zahlen, Ausschüttung, Insiders, M&A, Finanzierung, wichtige Produkt/Reg.-News, …).
 */
function istWichtigerPortfolioEintrag(titel: string, roh: string): boolean {
  const s = `${titel} ${roh}`.replace(/\s+/g, ' ').trim()
  if (s.length < 10) return false

  if (
    /kreuzwort|horoskop|wetter(?!-)|promi(?!c)|5 gründe|tipps?:?\s*$/i.test(s) ||
    /\b(fußball|f1|nba|nfl|tennis(?!-))\b.*\b(heute|gestern|sieg)\b/i.test(s)
  ) {
    return false
  }

  const m: RegExp[] = [
    /\bq[1-4](\s*[-–]\s*|\s+)(20[2-3]\d|fy)/i,
    /\b(20[2-3]\d)\b.*\b(q[1-4]|quarter(ly|sergebnis|ser?))\b/i,
    /\b(quartal|quarter(ly|serzahlen|sbericht|ser(ergebnis|zahlen))|jahres(ergebnis|zahlen|bilanz)|quartalszahl|jahres(bericht|abschlus))\b/i,
    /\b(earnings|umsatz(ergebnis|rückgang|wachs)|revenue(?!s?\s+share| per)|netto(ergebnis|verlust|gewinn)|ebit|ebitda|eps)\b/i,
    /\b(ergebnis|zahlen|bericht|report|filings?)\b.*\b(überraschend|verfehl|trifft|schläg|fällt|meld(et|e)|veröffent|stellt? vor)\b/i,
    /\b(dividend|dividendenausschütt|ausschütt(ung|squote)|sonderdivid|rendite pro aktie|yield)\b/i,
    /\binsider(verkäufe|käufe|handel|kauf|verkauf|trade|selling|buying|deal)?\b/i,
    /\b(form\s*4|form\s*8-?k|8-k|sec-?filing|14a|stimmrechts(anteil|mitteilung))\b/i,
    /\b(cfo|ceo|coo|board|director|executive|vorstands?|mitglied).*?\b(verkauf|verkaufe|kauf|kaufe|stock|stimmrechts|beteil)\b/i,
    /\b(übernahme|akquisition|acquisition|merger|fusion|takeover|zusammenschlus|börs(engang|angebot|übernahmegerüch)|due\s*diligence|bid|hostile)\b/i,
    /\b(kredit(aufnahme|fazilität|lini)|anleihe|emission|schulden|debt(?!-to-)|bond\s+issue|notes?\s+offering|refinanz|aufnahme\s+(frischer|neuer|zusätzlicher)?\s*(anleihe|kredit|schulden)|kapitalmärkt)\b/i,
    /\b(aktienrückkauf|aktien-?rückkauf|buy-?back|repurchas|eigen(aktien)?-?kauf|treasury\s*stock)\b/i,
    /\b(fda|zulassung(?!sverfahren-)|approval|lancierung|eingeführt|einführ(ung|en)|(produkt|dienst|service|chips?et|plattform|gerät)-?(neu|launch|start|einf)|product\s+launch|welt(weit)?start|go-?to-?market)\b/i,
    /\b(hauptversammlung|agm|hauptvers|annual general meeting|shareholders? meeting)\b/i,
    /\b(guidance|ausblick|prognose(?!-)|ziel(s)?korridor|zahlen( für)?\s*20[2-3]\d)\b/i,
    /\b(stock|aktien?)-?split|aktiensplit|reverse\s*split|kapitalerhöh(ung|en)|dilut|ausbuchung|gewinn(ser)?warn|profit\s*warn(ing)?\b/i,
    /\b(moody|fitch|s&p|standard\s*(&|and|und)\s*poor|downgrad|upgrad|watchlist|rating(änder(ung|en)|-?eins| review))\b/i,
  ]

  return m.some((re) => re.test(s))
}

/**
 * Parallele Google-News-Abfragen: (Unternehmen) AND (finanzrelevante Signale).
 * Danach strikter Textfilter auf Titel+Snippet.
 */
export async function ladeAktienPortfolioNews(): Promise<{
  artikel: NewsEintrag[]
  fehler: string | null
}> {
  const firmenRoh = UNTERNEHMEN.map(alsSuchbegriff).filter((s) => s.length > 0)
  const firmenKacheln = chunken(firmenRoh, 4)
  const fehler: string[] = []
  const alle: RohGoogleNewsEintrag[] = []

  await Promise.all(
    firmenKacheln.map(async (g) => {
      const orFirmen = g.join(' OR ')
      if (!orFirmen) return
      const q = `(${orFirmen}) AND ${SIGNAL_MUSTER}`
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
        q,
      )}&hl=de&gl=DE&ceid=DE:de`
      try {
        const res = await fetch(url, {
          next: { revalidate: 300 },
          headers: { 'User-Agent': 'mein-haushalt/1.0 (private; portfolio news)' },
        })
        if (!res.ok) {
          fehler.push(`Google News: ${res.status}`)
          return
        }
        const xml = await res.text()
        const items = parseGoogleNewsRssItems(xml, 'Google News', 100)
        alle.push(...items)
      } catch (e) {
        fehler.push(e instanceof Error ? e.message : 'Fehler')
      }
    }),
  )

  const seen = new Set<string>()
  const dedup: NewsEintrag[] = []
  for (const a of alle) {
    if (seen.has(a.href)) continue
    seen.add(a.href)
    if (!artikelIstAktuell(a.veroeffentlichtAm)) continue
    if (!istWichtigerPortfolioEintrag(a.titel, a.sucheFuerLokal)) continue
    dedup.push({
      titel: a.titel,
      href: a.href,
      quelle: a.quelle,
      veroeffentlichtAm: a.veroeffentlichtAm,
    })
  }

  dedup.sort((a, b) => {
    const ta = a.veroeffentlichtAm ? new Date(a.veroeffentlichtAm).getTime() : 0
    const tb = b.veroeffentlichtAm ? new Date(b.veroeffentlichtAm).getTime() : 0
    return tb - ta
  })

  return {
    artikel: dedup.slice(0, 12),
    fehler: fehler.length ? fehler.join(' · ') : null,
  }
}

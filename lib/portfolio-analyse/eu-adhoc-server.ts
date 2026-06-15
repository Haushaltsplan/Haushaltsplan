/** EU — Ad-hoc / Pflichtmitteilungen über Investor Relations. */

import 'server-only'

import { linksAusHtml } from '@/lib/html/text-aus-html'
import { ladeInvestorRelationsUrl } from '@/lib/portfolio-analyse/investor-relations-url'
import { ladeDokumentText } from '@/lib/portfolio-analyse/ir-earnings-scraper'
import type { MaterialEventEintrag, MaterialEventKategorie } from '@/lib/portfolio-analyse/material-events-types'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const MAX_EVENTS = 12
const AUSZUG = 2_000

const ADHOC_MUSTER =
  /\b(ad[- ]?hoc|inside information|insider information|regulatory news|mar notification|pflichtmitteilung|material event|disclosure|press release.*(guidance|ceo|acquisition|results))\b/i

const SKIP_MUSTER = /\b(cookie|privacy|career|sustainability report|annual report 20\d{2})\b/i

const IR_ADHOC_PFADE = [
  '/regulatory-news',
  '/ad-hoc',
  '/news',
  '/press-releases',
  '/investors/news',
  '/investors/press-releases',
  '/investor-relations/news',
  '/en/investors/news',
]

function kategorieAusText(text: string): MaterialEventKategorie {
  const t = text.toLowerCase()
  if (/guidance|outlook|forecast|prognose|ausblick/i.test(t)) return 'guidance'
  if (/ceo|cfo|chief executive|vorstand|director|management change/i.test(t)) return 'management'
  if (/acquisition|übernahme|merger|acquire|kauf/i.test(t)) return 'm_a'
  if (/restructur|reorganisation|layoff|stellenabbau/i.test(t)) return 'restrukturierung'
  if (/quarter|quartal|results|ergebnis|umsatz|profit/i.test(t)) return 'finanzergebnis'
  if (/regulatory|investigation|litigation|behörde/i.test(t)) return 'regulatorisch'
  return 'sonstiges'
}

function parseDatum(text: string): string | null {
  const m =
    text.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/) ??
    text.match(/\b(0?[1-9]|[12]\d|3[01])\.\s*(0?[1-9]|1[0-2])\.\s*(20\d{2})\b/)
  if (!m) return null
  if (m[0].includes('-') && m[0].length >= 8) return m[0]
  if (m[3]) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
  return null
}

function scoreLink(text: string, href: string): number {
  const kombi = `${text} ${href}`
  if (SKIP_MUSTER.test(kombi)) return -1
  if (!ADHOC_MUSTER.test(kombi)) return 0
  let s = 5
  if (/ad[- ]?hoc|inside information|pflichtmitteilung/i.test(kombi)) s += 4
  if (/guidance|ceo|acquisition|results|quarter/i.test(kombi)) s += 2
  if (/\b20\d{2}\b/.test(kombi)) s += 1
  return s
}

export async function ladeEuAdhocEvents(opts: {
  ticker: string
  isin?: string | null
  firmenname?: string | null
}): Promise<MaterialEventEintrag[]> {
  const isin = opts.isin?.trim().toUpperCase() ?? ''
  const irUrl = isin
    ? await ladeInvestorRelationsUrl(isin, opts.firmenname?.trim() || opts.ticker, opts.ticker)
    : null
  if (!irUrl) return []

  const kandidaten: { href: string; text: string; score: number }[] = []
  const seen = new Set<string>()
  const urls = [irUrl, ...IR_ADHOC_PFADE.map((p) => new URL(p, irUrl).toString())]

  for (const listenUrl of urls) {
    try {
      const res = await fetch(listenUrl, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
        cache: 'no-store',
      })
      if (!res.ok) continue
      for (const l of linksAusHtml(await res.text(), listenUrl)) {
        const score = scoreLink(l.text, l.href)
        if (score <= 0 || !l.href || seen.has(l.href)) continue
        seen.add(l.href)
        kandidaten.push({ href: l.href, text: l.text, score })
      }
    } catch {
      continue
    }
  }

  kandidaten.sort((a, b) => b.score - a.score)
  const out: MaterialEventEintrag[] = []

  for (const k of kandidaten) {
    if (out.length >= MAX_EVENTS) break
    const text = await ladeDokumentText(k.href)
    if (text.length < 120) continue
    const meta = `${k.text} ${k.href}`
    const kat = kategorieAusText(`${meta} ${text.slice(0, 800)}`)
    out.push({
      id: `eu-${Buffer.from(k.href).toString('base64url').slice(0, 16)}`,
      titel: k.text.trim().slice(0, 100) || 'Ad-hoc Mitteilung',
      kategorie: kat,
      quelle: 'eu_adhoc',
      datum: parseDatum(meta),
      url: k.href,
      textAuszug: text.slice(0, AUSZUG),
    })
  }

  return out
}

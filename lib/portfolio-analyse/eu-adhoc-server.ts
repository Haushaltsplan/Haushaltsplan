/** EU — Ad-hoc / Pflichtmitteilungen über Investor Relations + börsenspezifische Listen. */

import 'server-only'

import { linksAusHtml } from '@/lib/html/text-aus-html'
import {
  adhocPfadeFuerIsin,
  euAdhocQuelleFuerIsin,
} from '@/lib/portfolio-analyse/eu-adhoc-sources'
import { ladeInvestorRelationsUrl } from '@/lib/portfolio-analyse/investor-relations-url'
import {
  HERMES_ISIN,
  ladeHermesRegulatedAdhocEvents,
} from '@/lib/portfolio-analyse/hermes-finance-ir-server'
import { loesePortfolioIsin } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { ladeDokumentText } from '@/lib/portfolio-analyse/ir-earnings-scraper'
import type { MaterialEventEintrag, MaterialEventKategorie } from '@/lib/portfolio-analyse/material-events-types'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const MAX_EVENTS = 12
const AUSZUG = 2_000

const ADHOC_MUSTER =
  /\b(ad[- ]?hoc|inside information|insider information|regulatory news|mar notification|pflichtmitteilung|material event|disclosure|directors.?deal|directors.?dealings|stimmrechtsmitteilung|delisting|takeover|profit warning|gewinnwarnung|information[s]? r[eé]glement|communiqu[eé]|press release.*(guidance|ceo|acquisition|results|chief executive))\b/i

const SKIP_MUSTER =
  /\b(cookie|privacy|career|job|sustainability report|annual report 20\d{2}|geschäftsbericht 20\d{2}|corporate governance report|remuneration report)\b/i

const IR_ADHOC_PFADE = [
  '/regulatory-news',
  '/regulatory-announcements',
  '/regulated-information',
  '/ad-hoc',
  '/ad-hoc-mitteilungen',
  '/news',
  '/press-releases',
  '/investors/news',
  '/investors/press-releases',
  '/investor-relations/news',
  '/en/investors/news',
  '/en/investors/regulatory-news',
  '/de/unternehmen/investor-relations/ad-hoc-mitteilungen',
]

const URL_ADHOC_MUSTER =
  /ad[-_]?hoc|regulated[-_]information|regulatory[-_]?(news|announcements)|inside[-_]information|dgap|eqs|mar[-_]notification|informations[-_]reglement/i

function kategorieAusText(text: string): MaterialEventKategorie {
  const t = text.toLowerCase()
  if (/guidance|outlook|forecast|prognose|ausblick|profit warning|gewinnwarnung/i.test(t)) return 'guidance'
  if (/ceo|cfo|chief executive|vorstand|director|management change|geschäftsleiter/i.test(t)) return 'management'
  if (/acquisition|übernahme|merger|acquire|kauf|takeover|delisting/i.test(t)) return 'm_a'
  if (/restructur|reorganisation|layoff|stellenabbau/i.test(t)) return 'restrukturierung'
  if (/quarter|quartal|results|ergebnis|umsatz|profit|half[- ]year|halbjahr/i.test(t)) return 'finanzergebnis'
  if (/regulatory|investigation|litigation|behörde|sanction/i.test(t)) return 'regulatorisch'
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

function scoreLink(text: string, href: string, extraKeywords: string[] = []): number {
  const kombi = `${text} ${href}`
  if (SKIP_MUSTER.test(kombi)) return -1

  let s = 0
  if (ADHOC_MUSTER.test(kombi)) s += 5
  if (URL_ADHOC_MUSTER.test(href)) s += 4
  if (/ad[- ]?hoc|inside information|pflichtmitteilung|dgap|eqs/i.test(kombi)) s += 4
  if (/guidance|ceo|acquisition|results|quarter|chief executive|gewinnwarnung/i.test(kombi)) s += 2
  if (extraKeywords.some((k) => kombi.toLowerCase().includes(k.toLowerCase()))) s += 2
  if (/\b20\d{2}\b/.test(kombi)) s += 1
  if (/\.pdf(\?|$)/i.test(href) && s > 0) s += 1

  return s
}

async function sammleLinksVonUrl(
  listenUrl: string,
  extraKeywords: string[],
  seen: Set<string>,
  kandidaten: { href: string; text: string; score: number }[],
): Promise<void> {
  try {
    const res = await fetch(listenUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      cache: 'no-store',
    })
    if (!res.ok) return
    for (const l of linksAusHtml(await res.text(), listenUrl)) {
      const score = scoreLink(l.text, l.href, extraKeywords)
      if (score <= 0 || !l.href || seen.has(l.href)) continue
      seen.add(l.href)
      kandidaten.push({ href: l.href, text: l.text, score })
    }
  } catch {
    /* skip */
  }
}

function baueListenUrls(irUrl: string, isin: string): string[] {
  const isinNorm = isin.trim().toUpperCase()
  const hard = euAdhocQuelleFuerIsin(isinNorm)
  const urls = new Set<string>()

  if (hard) {
    for (const u of hard.listenUrls) urls.add(u)
    for (const p of hard.pfadSuffixe ?? []) {
      try {
        urls.add(new URL(p, irUrl).toString())
      } catch {
        /* skip */
      }
    }
  }

  urls.add(irUrl)
  for (const p of [...IR_ADHOC_PFADE, ...adhocPfadeFuerIsin(isinNorm)]) {
    try {
      urls.add(new URL(p, irUrl).toString())
    } catch {
      continue
    }
  }

  return [...urls]
}

export async function ladeEuAdhocEvents(opts: {
  ticker: string
  isin?: string | null
  firmenname?: string | null
}): Promise<MaterialEventEintrag[]> {
  const isin =
    loesePortfolioIsin({
      isin: opts.isin,
      ticker: opts.ticker,
      firmenname: opts.firmenname,
    }) ?? opts.isin?.trim().toUpperCase() ?? ''
  const irUrl = isin
    ? await ladeInvestorRelationsUrl(isin, opts.firmenname?.trim() || opts.ticker, opts.ticker)
    : null
  if (!irUrl) return []

  const out: MaterialEventEintrag[] = []
  const seenUrls = new Set<string>()

  if (isin === HERMES_ISIN) {
    for (const h of await ladeHermesRegulatedAdhocEvents(MAX_EVENTS)) {
      seenUrls.add(h.url)
      const kat = kategorieAusText(`${h.titel} ${h.text.slice(0, 800)}`)
      out.push({
        id: `eu-hermes-${Buffer.from(h.url).toString('base64url').slice(0, 16)}`,
        titel: h.titel,
        kategorie: kat,
        quelle: 'eu_adhoc',
        datum: h.datum,
        url: h.url,
        textAuszug: h.text.slice(0, AUSZUG),
      })
    }
    if (out.length >= MAX_EVENTS) return out
  }

  const hard = euAdhocQuelleFuerIsin(isin)
  const extraKeywords = hard?.keywords ?? []
  const kandidaten: { href: string; text: string; score: number }[] = []
  const seen = new Set<string>()
  const listenUrls = baueListenUrls(irUrl, isin)

  await Promise.all(listenUrls.map((u) => sammleLinksVonUrl(u, extraKeywords, seen, kandidaten)))

  kandidaten.sort((a, b) => b.score - a.score)

  for (const k of kandidaten) {
    if (out.length >= MAX_EVENTS) break
    if (seenUrls.has(k.href)) continue
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

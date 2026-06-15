/** EU — Directors' Dealings / PDMR (IR-Scrape, begrenzt). */

import 'server-only'

import { linksAusHtml } from '@/lib/html/text-aus-html'
import { adhocPfadeFuerIsin, euAdhocQuelleFuerIsin } from '@/lib/portfolio-analyse/eu-adhoc-sources'
import { ladeInvestorRelationsUrl } from '@/lib/portfolio-analyse/investor-relations-url'
import { ladeDokumentText } from '@/lib/portfolio-analyse/ir-earnings-scraper'
import type { InsiderTransaktion } from '@/lib/portfolio-analyse/insider-transaktionen-types'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const MAX_TX = 8

const DEALING_MUSTER =
  /\b(directors?['']?\s*dealings?|directors?['']?\s*transaction|pdmr|managerial transaction|geschäftsleiter|geschaeftsleiter|stimmrechtsmitteilung|stimmrechtsanteil|insider|mandatory notification)\b/i

const KAUF_MUSTER = /\b(purchase|bought|acquired|kauf|erwerb|zukauf)\b/i
const VERKAUF_MUSTER = /\b(sale|sold|disposal|verkauf|veräußerung|veraeusserung)\b/i

const IR_PFADE = [
  '/investors/regulatory-news',
  '/investors/directors-dealings',
  '/en/investors/directors-dealings',
  '/de/unternehmen/investor-relations/stimmrechtsmitteilungen',
  '/investor-relations/stimmrechtsmitteilungen',
]

function parseDatum(text: string): string | null {
  const m =
    text.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/) ??
    text.match(/\b(0?[1-9]|[12]\d|3[01])\.\s*(0?[1-9]|1[0-2])\.\s*(20\d{2})\b/)
  if (!m) return null
  if (m[0].includes('-') && m[0].length >= 8) return m[0]
  if (m[3]) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
  return null
}

function typAusText(text: string): InsiderTransaktion['typ'] {
  const k = text.toLowerCase()
  if (KAUF_MUSTER.test(k) && !VERKAUF_MUSTER.test(k)) return 'kauf'
  if (VERKAUF_MUSTER.test(k) && !KAUF_MUSTER.test(k)) return 'verkauf'
  if (KAUF_MUSTER.test(k) && VERKAUF_MUSTER.test(k)) return 'sonstiges'
  return 'sonstiges'
}

export async function ladeEuInsiderDealings(opts: {
  ticker: string
  isin?: string | null
  firmenname?: string | null
}): Promise<InsiderTransaktion[]> {
  const isin = opts.isin?.trim().toUpperCase() ?? ''
  if (!isin) return []

  const irUrl = await ladeInvestorRelationsUrl(isin, opts.firmenname?.trim() || opts.ticker, opts.ticker)
  if (!irUrl) return []

  const hard = euAdhocQuelleFuerIsin(isin)
  const urls = new Set<string>(hard?.listenUrls ?? [])
  urls.add(irUrl)
  for (const p of [...IR_PFADE, ...adhocPfadeFuerIsin(isin)]) {
    try {
      urls.add(new URL(p, irUrl).toString())
    } catch {
      continue
    }
  }

  const kandidaten: { href: string; text: string }[] = []
  const seen = new Set<string>()

  for (const listenUrl of urls) {
    try {
      const res = await fetch(listenUrl, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
        cache: 'no-store',
      })
      if (!res.ok) continue
      for (const l of linksAusHtml(await res.text(), listenUrl)) {
        const kombi = `${l.text} ${l.href}`
        if (!DEALING_MUSTER.test(kombi) || seen.has(l.href)) continue
        seen.add(l.href)
        kandidaten.push({ href: l.href, text: l.text.trim() || 'Directors Dealing' })
      }
    } catch {
      continue
    }
  }

  const out: InsiderTransaktion[] = []
  for (const k of kandidaten) {
    if (out.length >= MAX_TX) break
    const text = await ladeDokumentText(k.href)
    const meta = `${k.text} ${text.slice(0, 600)}`
    const typ = typAusText(meta)
    if (typ === 'sonstiges') continue
    out.push({
      id: `eu-dd-${Buffer.from(k.href).toString('base64url').slice(0, 14)}`,
      datum: parseDatum(meta),
      person: 'Director / Geschäftsleiter',
      titel: null,
      typ,
      aktien: null,
      preisUsd: null,
      wertUsd: null,
      quelle: 'eu_directors_dealing',
      url: k.href,
      hinweis: k.text.slice(0, 120),
    })
  }

  return out.sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? ''))
}

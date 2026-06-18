/** EU / Nicht-US — Quartals- & Jahresberichte über Investor Relations (PDF/HTML). */

import 'server-only'

import { createHash } from 'crypto'
import { linksAusHtml } from '@/lib/html/text-aus-html'
import { HERMES_ISIN, ladeHermesFinanzberichteHistorie } from '@/lib/portfolio-analyse/hermes-finance-ir-server'
import { ladeEuPortfolioFinanzberichteHistorie } from '@/lib/portfolio-analyse/eu-portfolio-ir-server'
import { euPortfolioIrConfig } from '@/lib/portfolio-analyse/eu-portfolio-ir-config'
import { ladeInvestorRelationsUrl } from '@/lib/portfolio-analyse/investor-relations-url'
import { loesePortfolioIsin } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { ladeDokumentText } from '@/lib/portfolio-analyse/ir-earnings-scraper'
import type { SecBerichtEintrag, SecBerichtFormular } from '@/lib/portfolio-analyse/sec-berichte-types'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const MAX_BERICHTE = 12
const AUSZUG_ZEICHEN = 4_000
const MIN_TEXT = 2_000

const IR_LISTEN_PFADE = [
  '/financial-reports',
  '/reports-and-presentations',
  '/reports-presentations',
  '/reports',
  '/publications',
  '/results-and-reports',
  '/financial-information',
  '/financials',
  '/en/investors/financial-reports',
  '/de/investor-relations/finanzberichte',
  '/investors/financial-reports',
  '/investors/reports',
]

const BERICHT_MUSTER =
  /\b(annual report|geschäftsbericht|geschaeftsbericht|half[- ]year|halbjahr|interim report|quarterly report|quarterly results|financial report|financial statements|universal registration|registration document|rapport annuel|rapport financier|results presentation|investor presentation|q[1-4]\s*20\d{2}|fy20\d{2}|20\d{2}\s*(results|report|annual|publishing|urd|revenue))\b/i

const SKIP_MUSTER =
  /\b(transcript|conference call|earnings call|webcast|press release|pressemitteilung|corporate governance|sustainability|esg|proxy|agm notice|share buyback notice)\b/i

type LinkKandidat = { href: string; text: string; score: number; formular: SecBerichtFormular }

function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 16)
}

function formularAusText(text: string): SecBerichtFormular {
  const c = text.toLowerCase()
  if (/\b(10-k|annual report|geschäftsbericht|geschaeftsbericht|fy20|full year|jahresbericht|rapport annuel)\b/i.test(c)) {
    return 'IR-FY'
  }
  if (/\b(half[- ]year|halbjahr|semi-annual|interim report|h1|h2)\b/i.test(c)) return 'IR-HY'
  if (/\b(quarter|quartal|q[1-4]|trimest)\b/i.test(c)) return 'IR-Q'
  return 'IR-AR'
}

function scoreBerichtLink(text: string, href: string): number {
  const kombi = `${text} ${href}`
  if (SKIP_MUSTER.test(kombi)) return -10
  if (/assets-finance\.hermes\.com/i.test(href) && /urd|publishing|annual|half|semest|revenue_q|financial/i.test(kombi)) {
    let score = 8
    if (/\.pdf(\?|$)/i.test(href)) score += 4
    if (/\b(urd|publishing|annual)\b/i.test(kombi)) score += 3
    return score
  }
  if (/access in pdf|access the pdf|télécharger|download pdf/i.test(text) && /publications|urd|publishing/i.test(kombi)) {
    return 6
  }
  if (!BERICHT_MUSTER.test(kombi)) return 0
  let score = 5
  if (/\.pdf(\?|$)/i.test(href)) score += 4
  if (/\b(annual|geschäfts|jahres|10-k|fy)\b/i.test(kombi)) score += 3
  if (/\b(half|halbjahr|interim|h1|h2)\b/i.test(kombi)) score += 2
  if (/\b(quarter|quartal|q[1-4])\b/i.test(kombi)) score += 2
  if (/\b20\d{2}\b/.test(kombi)) score += 1
  return score
}

function parseDatumAusText(text: string): string | null {
  const m =
    text.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/) ??
    text.match(/\b(0?[1-9]|[12]\d|3[01])\.\s*(0?[1-9]|1[0-2])\.\s*(20\d{2})\b/) ??
    text.match(/\b(q[1-4]|h1|h2)\s*20\d{2}\b/i) ??
    text.match(/\bfy\s*20\d{2}\b/i)
  if (!m) return null
  if (m[0].includes('-') && m[0].length >= 8) return m[0]
  if (m[3]) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
  return null
}

function berichtszeitraumAusText(text: string): string | null {
  const jahr = text.match(/\b(20\d{2})\b/)?.[1]
  if (!jahr) return null
  const q = text.match(/\bq([1-4])\b/i)?.[1]
  if (q) return `${jahr}-Q${q}`
  if (/\bh1\b/i.test(text)) return `${jahr}-H1`
  if (/\bh2\b/i.test(text)) return `${jahr}-H2`
  return jahr
}

function labelAusFormular(formular: SecBerichtFormular, text: string): string {
  const periode = berichtszeitraumAusText(text)
  const basis =
    formular === 'IR-FY'
      ? 'Jahresbericht'
      : formular === 'IR-HY'
        ? 'Halbjahresbericht'
        : formular === 'IR-Q'
          ? 'Quartalsbericht'
          : 'Finanzbericht'
  return periode ? `${basis} ${periode}` : text.trim().slice(0, 80) || basis
}

async function sammleBerichtLinks(irUrl: string): Promise<LinkKandidat[]> {
  const kandidaten: LinkKandidat[] = []
  const seen = new Set<string>()
  const urls = [irUrl, ...IR_LISTEN_PFADE.map((p) => new URL(p, irUrl).toString())]

  for (const listenUrl of urls) {
    try {
      const res = await fetch(listenUrl, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
        cache: 'no-store',
      })
      if (!res.ok) continue
      const html = await res.text()
      for (const l of linksAusHtml(html, listenUrl)) {
        const score = scoreBerichtLink(l.text, l.href)
        if (score <= 0 || !l.href || seen.has(l.href)) continue
        seen.add(l.href)
        kandidaten.push({
          href: l.href,
          text: l.text,
          score,
          formular: formularAusText(`${l.text} ${l.href}`),
        })
      }
      if (/finance\.hermes\.com/i.test(listenUrl)) {
        for (const m of html.matchAll(/value="(https:\/\/assets-finance\.hermes\.com\/s3fs-public\/[^"]+\.pdf[^"]*)"/gi)) {
          const href = m[1]!.replace(/&amp;/g, '&')
          const score = scoreBerichtLink('', href)
          if (score <= 0 || seen.has(href)) continue
          seen.add(href)
          kandidaten.push({
            href,
            text: href.split('/').pop() ?? href,
            score,
            formular: formularAusText(href),
          })
        }
      }
    } catch {
      continue
    }
  }

  return kandidaten.sort((a, b) => b.score - a.score).slice(0, MAX_BERICHTE * 2)
}

function baueEintrag(k: LinkKandidat, text: string): SecBerichtEintrag {
  const accession = hashUrl(k.href)
  const id = `ir-${accession}-${k.formular}`
  const metaText = `${k.text} ${k.href}`
  return {
    id,
    formular: k.formular,
    label: labelAusFormular(k.formular, metaText),
    filingDatum: parseDatumAusText(metaText),
    berichtszeitraum: berichtszeitraumAusText(metaText),
    url: k.href,
    quelle: 'ir_pdf',
    accession,
    textAuszug: text.slice(0, AUSZUG_ZEICHEN),
    textZeichen: text.length,
    textVollstaendig: true,
    zusammenfassung: null,
  }
}

export async function ladeIrFinanzberichteHistorie(opts: {
  ticker: string
  isin?: string | null
  firmenname?: string | null
  symbolYahoo?: string | null
}): Promise<{ berichte: SecBerichtEintrag[]; texte: Map<string, string> }> {
  const isin =
    loesePortfolioIsin({
      isin: opts.isin,
      ticker: opts.ticker,
      symbolYahoo: opts.symbolYahoo,
      firmenname: opts.firmenname,
    }) ?? opts.isin?.trim().toUpperCase() ?? ''

  if (isin === HERMES_ISIN) {
    const hermes = await ladeHermesFinanzberichteHistorie(MAX_BERICHTE)
    const berichte: SecBerichtEintrag[] = []
    const texte = new Map<string, string>()
    for (const h of hermes) {
      const eintrag = baueEintrag(
        {
          href: h.url,
          text: h.titel,
          score: 10,
          formular: formularAusText(`${h.titel} ${h.url}`),
        },
        h.text,
      )
      berichte.push(eintrag)
      texte.set(eintrag.accession, h.text)
    }
    if (berichte.length > 0) return { berichte, texte }
  }

  if (isin && euPortfolioIrConfig(isin)) {
    const eu = await ladeEuPortfolioFinanzberichteHistorie(isin, MAX_BERICHTE)
    const berichte: SecBerichtEintrag[] = []
    const texte = new Map<string, string>()
    for (const h of eu) {
      const eintrag = baueEintrag(
        {
          href: h.url,
          text: h.titel,
          score: 10,
          formular: formularAusText(`${h.titel} ${h.url}`),
        },
        h.text,
      )
      berichte.push(eintrag)
      texte.set(eintrag.accession, h.text)
    }
    if (berichte.length > 0) return { berichte, texte }
  }

  const irUrl = isin
    ? await ladeInvestorRelationsUrl(isin, opts.firmenname?.trim() || opts.ticker, opts.ticker)
    : null
  if (!irUrl) {
    return { berichte: [], texte: new Map() }
  }

  const links = await sammleBerichtLinks(irUrl)
  const berichte: SecBerichtEintrag[] = []
  const texte = new Map<string, string>()

  for (const k of links) {
    if (berichte.length >= MAX_BERICHTE) break
    const text = await ladeDokumentText(k.href)
    if (text.length < MIN_TEXT) continue
    const eintrag = baueEintrag(k, text)
    berichte.push(eintrag)
    texte.set(eintrag.accession, text)
  }

  return { berichte, texte }
}

export async function ladeIrFinanzberichtVolltext(
  accession: string,
  url: string,
): Promise<{ text: string; eintrag: SecBerichtEintrag } | null> {
  const text = await ladeDokumentText(url)
  if (text.length < MIN_TEXT) return null
  const formular = formularAusText(url)
  const eintrag = baueEintrag(
    { href: url, text: url, score: 1, formular },
    text,
  )
  return { text, eintrag: { ...eintrag, accession, id: `ir-${accession}-${formular}` } }
}

/** IR — Earnings-Call-Transkripte (Q4-API, Website-Crawl, Playwright). */

import 'server-only'

import { htmlZuFliesstext, linksAusHtml } from '@/lib/html/text-aus-html'
import {
  istEarningsCallTranskript,
  istPresseMitteilung,
} from '@/lib/portfolio-analyse/earnings-call-transcript-heuristik'
import { crawlIrTranskripte } from '@/lib/portfolio-analyse/ir-earnings-crawler'
import { ladeQ4TranskriptHistorie } from '@/lib/portfolio-analyse/ir-q4-transcript-server'
import {
  irEarningsQuelleFuerIsin,
  istTranskriptLink,
  scoreTranskriptLink,
  type IrEarningsQuelle,
} from '@/lib/portfolio-analyse/ir-earnings-sources'

export type { IrRohesTranskript } from '@/lib/portfolio-analyse/ir-earnings-types'
import type { IrRohesTranskript } from '@/lib/portfolio-analyse/ir-earnings-types'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const MAX_LINKS = 12
const MAX_FETCH = 8

type LinkKandidat = { href: string; text: string; score: number }

async function pdfZuText(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
    const data = await pdfParse(buffer)
    return (data.text || '').replace(/\s+/g, ' ').trim()
  } catch {
    return ''
  }
}

export async function ladeDokumentText(url: string): Promise<string> {
  if (/\.pdf(\?|$)/i.test(url)) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, cache: 'no-store' })
    if (!res.ok) return ''
    return pdfZuText(Buffer.from(await res.arrayBuffer()))
  }

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, cache: 'no-store' })
  if (!res.ok) return ''
  return htmlZuFliesstext(await res.text())
}

function parseDatumAusText(text: string): string | null {
  const m =
    text.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/) ??
    text.match(/\b(0?[1-9]|[12]\d|3[01])\.\s*(0?[1-9]|1[0-2])\.\s*(20\d{2})\b/)
  if (!m) return null
  if (m[0].includes('-')) return m[0]
  return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
}

function kandidatenAusHtml(html: string, listenUrl: string): LinkKandidat[] {
  return linksAusHtml(html, listenUrl)
    .filter((l) => istTranskriptLink(l.text, l.href))
    .map((l) => ({ href: l.href, text: l.text, score: scoreTranskriptLink(l.text, l.href) }))
}

async function transkripteAusLinks(kandidaten: LinkKandidat[], max: number): Promise<IrRohesTranskript[]> {
  const out: IrRohesTranskript[] = []
  for (const k of kandidaten.slice(0, MAX_LINKS)) {
    if (out.length >= max) break
    const text = await ladeDokumentText(k.href)
    if (text.length < 800) continue
    if (!istEarningsCallTranskript(text) || istPresseMitteilung(text)) continue
    out.push({
      titel: k.text,
      url: k.href,
      callDatum: parseDatumAusText(`${k.text} ${k.href}`),
      text,
    })
  }
  return out
}

async function sammleDirekteLinks(quelle: IrEarningsQuelle): Promise<LinkKandidat[]> {
  const kandidaten: LinkKandidat[] = []
  const seen = new Set<string>()

  for (const listenUrl of quelle.listenUrls) {
    try {
      const res = await fetch(listenUrl, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
        cache: 'no-store',
      })
      if (!res.ok) continue
      for (const l of kandidatenAusHtml(await res.text(), listenUrl)) {
        if (!l.href || seen.has(l.href)) continue
        seen.add(l.href)
        kandidaten.push(l)
      }
    } catch {
      continue
    }
  }

  kandidaten.sort((a, b) => b.score - a.score)
  return kandidaten
}

function baueQuelle(isin: string, fallbackIrUrl: string | null): IrEarningsQuelle {
  const hard = irEarningsQuelleFuerIsin(isin)
  if (hard) return hard
  if (fallbackIrUrl) return { listenUrls: [fallbackIrUrl] }
  return { listenUrls: [] }
}

export async function ladeIrTranskriptHistorie(
  isin: string,
  fallbackIrUrl: string | null,
  max = MAX_FETCH,
): Promise<IrRohesTranskript[]> {
  const quelle = baueQuelle(isin, fallbackIrUrl)
  if (!quelle.listenUrls.length) {
    return []
  }

  const q4 = await ladeQ4TranskriptHistorie(quelle.listenUrls, quelle.q4BasisUrls ?? [], max)
  if (q4.length > 0) return q4

  try {
    const direkt = await transkripteAusLinks(await sammleDirekteLinks(quelle), max)
    if (direkt.length > 0) return direkt
  } catch {
    /* weiter */
  }

  try {
    const crawled = await crawlIrTranskripte(quelle.listenUrls, max)
    if (crawled.length > 0) return crawled
  } catch {
    /* weiter */
  }

  if (!process.env.VERCEL) {
    try {
      const { ladeIrViaPlaywrightBrowser } = await import('@/lib/portfolio-analyse/ir-earnings-browser')
      const pwOut = await ladeIrViaPlaywrightBrowser(quelle, max, ladeDokumentText, parseDatumAusText)
      const valid = pwOut.filter(
        (t) => t.text.length >= 800 && istEarningsCallTranskript(t.text) && !istPresseMitteilung(t.text),
      )
      if (valid.length > 0) return valid
    } catch {
      /* unten */
    }
  }

  return []
}

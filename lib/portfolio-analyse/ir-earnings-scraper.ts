/** EU/Global — Earnings-Transkripte von Investor-Relations-Seiten (Fetch, ohne jsdom/playwright). */

import 'server-only'

import { htmlZuFliesstext, linksAusHtml } from '@/lib/html/text-aus-html'
import {
  irEarningsQuelleFuerIsin,
  istTranskriptLink,
  scoreTranskriptLink,
  type IrEarningsQuelle,
} from '@/lib/portfolio-analyse/ir-earnings-sources'

export type IrRohesTranskript = {
  titel: string
  url: string
  callDatum: string | null
  text: string
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const MAX_LINKS = 10
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

async function ladeDokumentText(url: string): Promise<string> {
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

async function sammleKandidaten(quelle: IrEarningsQuelle): Promise<LinkKandidat[]> {
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

async function transkripteAusLinks(kandidaten: LinkKandidat[], max: number): Promise<IrRohesTranskript[]> {
  const out: IrRohesTranskript[] = []
  for (const k of kandidaten.slice(0, MAX_LINKS)) {
    if (out.length >= max) break
    const text = await ladeDokumentText(k.href)
    if (text.length < 350) continue
    out.push({
      titel: k.text,
      url: k.href,
      callDatum: parseDatumAusText(`${k.text} ${k.href}`),
      text,
    })
  }
  return out
}

function normalisiereIrFehler(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/playwright|browser|executable/i.test(msg)) {
    return 'Browser-Scraper nicht verfügbar. Fetch-Fallback hat keine Transkripte gefunden.'
  }
  return msg
}

export async function ladeIrTranskriptHistorie(
  isin: string,
  fallbackIrUrl: string | null,
  max = MAX_FETCH,
): Promise<IrRohesTranskript[]> {
  const quelle: IrEarningsQuelle | null =
    irEarningsQuelleFuerIsin(isin) ?? (fallbackIrUrl ? { listenUrls: [fallbackIrUrl] } : null)

  if (!quelle?.listenUrls.length) {
    throw new Error('Keine IR-Earnings-Seite für dieses Unternehmen konfiguriert.')
  }

  let fetchOut: IrRohesTranskript[] = []
  try {
    const kandidaten = await sammleKandidaten(quelle)
    fetchOut = await transkripteAusLinks(kandidaten, max)
  } catch {
    /* Playwright-Fallback unten (nur lokal) */
  }
  if (fetchOut.length > 0) return fetchOut

  if (!process.env.VERCEL) {
    try {
      const { ladeIrViaPlaywrightBrowser } = await import('@/lib/portfolio-analyse/ir-earnings-browser')
      const pwOut = await ladeIrViaPlaywrightBrowser(quelle, max, ladeDokumentText, parseDatumAusText)
      if (pwOut.length > 0) return pwOut
    } catch (e) {
      throw new Error(normalisiereIrFehler(e))
    }
  }

  throw new Error(
    process.env.VERCEL
      ? 'Keine IR-Transkripte per Fetch gefunden. Viele EU-Seiten laden Links per JavaScript — lokal testen.'
      : 'Auf der IR-Seite wurden keine Transkript-Links gefunden.',
  )
}

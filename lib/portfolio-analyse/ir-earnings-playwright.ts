/** EU/Global — Earnings-Transkripte von Investor-Relations-Seiten. */

import 'server-only'

import { JSDOM } from 'jsdom'
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

function htmlZuText(html: string): string {
  const dom = new JSDOM(html)
  const body = dom.window.document.body
  if (!body) return ''
  const parts: string[] = []
  for (const el of body.querySelectorAll('p, li, td, div')) {
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
    if (t.length > 30) parts.push(t)
  }
  const joined = [...new Set(parts)].join('\n\n')
  return joined.length > 500 ? joined : (body.textContent || '').replace(/\s+/g, ' ').trim()
}

async function pdfZuText(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
    const data = await pdfParse(buffer)
    return (data.text || '').replace(/\s+/g, ' ').trim()
  } catch {
    return ''
  }
}

async function ladeDokumentText(url: string, page?: import('playwright').Page): Promise<string> {
  if (/\.pdf(\?|$)/i.test(url)) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, cache: 'no-store' })
    if (!res.ok) return ''
    const buf = Buffer.from(await res.arrayBuffer())
    return pdfZuText(buf)
  }

  if (page) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await page.waitForTimeout(800)
      return htmlZuText(await page.content())
    } catch {
      return ''
    }
  }

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, cache: 'no-store' })
  if (!res.ok) return ''
  return htmlZuText(await res.text())
}

function parseDatumAusText(text: string): string | null {
  const m =
    text.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/) ??
    text.match(/\b(0?[1-9]|[12]\d|3[01])\.\s*(0?[1-9]|1[0-2])\.\s*(20\d{2})\b/)
  if (!m) return null
  if (m[0].includes('-')) return m[0]
  return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
}

function linksAusHtml(html: string, listenUrl: string): LinkKandidat[] {
  const dom = new JSDOM(html, { url: listenUrl })
  const out: LinkKandidat[] = []
  for (const a of dom.window.document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const href = a.href?.split('#')[0]
    const text = (a.textContent || '').replace(/\s+/g, ' ').trim()
    if (!href || !istTranskriptLink(text, href)) continue
    out.push({ href, text: text || href, score: scoreTranskriptLink(text, href) })
  }
  return out
}

async function sammleKandidaten(
  quelle: IrEarningsQuelle,
  page?: import('playwright').Page,
): Promise<LinkKandidat[]> {
  const kandidaten: LinkKandidat[] = []
  const seen = new Set<string>()

  for (const listenUrl of quelle.listenUrls) {
    try {
      let links: LinkKandidat[] = []

      if (page) {
        await page.goto(listenUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 })
        await page.waitForTimeout(1500)
        const raw = await page.evaluate(() =>
          Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).map((a) => ({
            href: a.href,
            text: (a.textContent || '').replace(/\s+/g, ' ').trim(),
          })),
        )
        links = raw
          .filter((l) => istTranskriptLink(l.text, l.href))
          .map((l) => ({
            href: l.href.split('#')[0],
            text: l.text || l.href,
            score: scoreTranskriptLink(l.text, l.href),
          }))
      } else {
        const res = await fetch(listenUrl, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
          cache: 'no-store',
        })
        if (!res.ok) continue
        links = linksAusHtml(await res.text(), listenUrl)
      }

      for (const l of links) {
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

async function transkripteAusLinks(
  kandidaten: LinkKandidat[],
  max: number,
  page?: import('playwright').Page,
): Promise<IrRohesTranskript[]> {
  const out: IrRohesTranskript[] = []
  for (const k of kandidaten.slice(0, MAX_LINKS)) {
    if (out.length >= max) break
    const text = await ladeDokumentText(k.href, page)
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

async function ladeIrViaFetch(quelle: IrEarningsQuelle, max: number): Promise<IrRohesTranskript[]> {
  const kandidaten = await sammleKandidaten(quelle)
  return transkripteAusLinks(kandidaten, max)
}

async function ladeIrViaPlaywright(quelle: IrEarningsQuelle, max: number): Promise<IrRohesTranskript[]> {
  const chromium = (await import('playwright')).chromium
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const context = await browser.newContext({ userAgent: USER_AGENT, locale: 'en-US' })
    const page = await context.newPage()
    const kandidaten = await sammleKandidaten(quelle, page)
    return transkripteAusLinks(kandidaten, max, page)
  } finally {
    await browser.close()
  }
}

function normalisiereIrFehler(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/doctype|not valid json|unexpected token/i.test(msg)) {
    return 'IR-Seite lieferte HTML statt Transkript — bitte erneut versuchen oder IR-Link manuell öffnen.'
  }
  if (/playwright|browser|executable/i.test(msg)) {
    return 'Browser-Scraper nicht verfügbar (typisch auf Vercel). Fetch-Fallback hat keine Transkripte gefunden.'
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
    fetchOut = await ladeIrViaFetch(quelle, max)
  } catch {
    /* Playwright-Fallback unten */
  }
  if (fetchOut.length > 0) return fetchOut

  if (process.env.VERCEL) {
    throw new Error(
      'Keine IR-Transkripte per Fetch gefunden. Viele EU-Seiten laden Links per JavaScript — lokal mit Playwright testen.',
    )
  }

  try {
    const pwOut = await ladeIrViaPlaywright(quelle, max)
    if (pwOut.length > 0) return pwOut
  } catch (e) {
    throw new Error(normalisiereIrFehler(e))
  }

  throw new Error(
    'Auf der IR-Seite wurden keine Transkript-Links gefunden. Layout geändert oder Seite blockiert den Zugriff.',
  )
}

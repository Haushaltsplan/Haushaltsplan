/** EU/Global — Earnings-Transkripte von Investor-Relations-Seiten (Playwright). */

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

async function ladePlaywright() {
  const pw = await import('playwright')
  return pw.chromium
}

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
      const html = await page.content()
      return htmlZuText(html)
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

type LinkKandidat = { href: string; text: string; score: number }

export async function ladeIrTranskriptHistorie(
  isin: string,
  fallbackIrUrl: string | null,
  max = MAX_FETCH,
): Promise<IrRohesTranskript[]> {
  const quelle: IrEarningsQuelle | null =
    irEarningsQuelleFuerIsin(isin) ??
    (fallbackIrUrl ? { listenUrls: [fallbackIrUrl] } : null)

  if (!quelle?.listenUrls.length) {
    throw new Error('Keine IR-Earnings-Seite für dieses Unternehmen konfiguriert.')
  }

  const chromium = await ladePlaywright()
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const context = await browser.newContext({ userAgent: USER_AGENT, locale: 'en-US' })
    const page = await context.newPage()

    const kandidaten: LinkKandidat[] = []
    const seen = new Set<string>()

    for (const listenUrl of quelle.listenUrls) {
      try {
        await page.goto(listenUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 })
        await page.waitForTimeout(1500)

        const links = await page.evaluate(() => {
          return Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).map((a) => ({
            href: a.href,
            text: (a.textContent || '').replace(/\s+/g, ' ').trim(),
          }))
        })

        for (const l of links) {
          const href = l.href?.split('#')[0]
          if (!href || seen.has(href)) continue
          if (!istTranskriptLink(l.text, href)) continue
          seen.add(href)
          kandidaten.push({ href, text: l.text || href, score: scoreTranskriptLink(l.text, href) })
        }
      } catch {
        continue
      }
    }

    kandidaten.sort((a, b) => b.score - a.score)
    const top = kandidaten.slice(0, MAX_LINKS)

    const out: IrRohesTranskript[] = []
    for (const k of top) {
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

    if (out.length === 0) {
      throw new Error(
        'Auf der IR-Seite wurden keine Transkript-Links gefunden. Seite ggf. per Playwright blockiert oder Layout geändert.',
      )
    }

    return out
  } finally {
    await browser.close()
  }
}

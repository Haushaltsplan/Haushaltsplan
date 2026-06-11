/** Playwright-IR-Scraper — nur lokal, separat gebündelt (nicht auf Vercel). */

import 'server-only'

import { htmlZuFliesstext, linksAusHtml as parseLinks } from '@/lib/html/text-aus-html'
import {
  istEarningsCallTranskript,
  istPresseMitteilung,
} from '@/lib/portfolio-analyse/earnings-call-transcript-heuristik'
import {
  istTranskriptLink,
  scoreTranskriptLink,
  type IrEarningsQuelle,
} from '@/lib/portfolio-analyse/ir-earnings-sources'
import type { IrRohesTranskript } from '@/lib/portfolio-analyse/ir-earnings-types'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const MAX_LINKS = 10

type LinkKandidat = { href: string; text: string; score: number }

export async function ladeIrViaPlaywrightBrowser(
  quelle: IrEarningsQuelle,
  max: number,
  ladeDokument: (url: string, html?: string) => Promise<string>,
  parseDatum: (text: string) => string | null,
): Promise<IrRohesTranskript[]> {
  const chromium = (await import('playwright')).chromium
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
        const raw = await page.evaluate(() =>
          Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).map((a) => ({
            href: a.href,
            text: (a.textContent || '').replace(/\s+/g, ' ').trim(),
          })),
        )
        for (const l of raw) {
          const href = l.href?.split('#')[0]
          if (!href || seen.has(href) || !istTranskriptLink(l.text, href)) continue
          seen.add(href)
          kandidaten.push({
            href,
            text: l.text || href,
            score: scoreTranskriptLink(l.text, href),
          })
        }
      } catch {
        continue
      }
    }

    kandidaten.sort((a, b) => b.score - a.score)
    const out: IrRohesTranskript[] = []

    for (const k of kandidaten.slice(0, MAX_LINKS)) {
      if (out.length >= max) break
      let text = ''
      try {
        await page.goto(k.href, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await page.waitForTimeout(800)
        text = htmlZuFliesstext(await page.content())
      } catch {
        text = await ladeDokument(k.href)
      }
      if (text.length < 800) continue
      if (!istEarningsCallTranskript(text) || istPresseMitteilung(text)) continue
      out.push({
        titel: k.text,
        url: k.href,
        callDatum: parseDatum(`${k.text} ${k.href}`),
        text,
      })
    }

    return out
  } finally {
    await browser.close()
  }
}

/** Nur für Tests — Fetch-Links ohne Playwright */
export function parseIrLinksAusHtml(html: string, listenUrl: string): LinkKandidat[] {
  return parseLinks(html, listenUrl)
    .filter((l) => istTranskriptLink(l.text, l.href))
    .map((l) => ({ ...l, score: scoreTranskriptLink(l.text, l.href) }))
}

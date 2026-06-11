/** Seeking Alpha — Earnings-Call-Transkripte via Playwright (Bot-Schutz umgehen). */

import 'server-only'

export type SeekingAlphaTranscript = {
  titel: string
  url: string
  callDatum: string | null
  text: string
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function normalisiereTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '')
}

async function ladePlaywright() {
  try {
    const pw = await import('playwright')
    return pw.chromium
  } catch {
    throw new Error(
      'Playwright ist nicht installiert. Lokal: npm install playwright && npx playwright install chromium',
    )
  }
}

async function versucheCookieBanner(page: import('playwright').Page): Promise<void> {
  const selectors = [
    'button:has-text("Accept")',
    'button:has-text("I Accept")',
    'button:has-text("Agree")',
    '[data-test-id="accept-button"]',
    '#onetrust-accept-btn-handler',
  ]
  for (const sel of selectors) {
    try {
      const btn = page.locator(sel).first()
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click({ timeout: 3000 })
        await page.waitForTimeout(800)
        return
      }
    } catch {
      /* nächster Selector */
    }
  }
}

function parseCallDatum(titel: string, url: string): string | null {
  const ausTitel =
    titel.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/) ??
    titel.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})\b/i)
  if (ausTitel) return ausTitel[0]

  const slug = url.match(/-(20\d{2})-(\d{2})-(\d{2})-/) ?? url.match(/q[1-4]-(20\d{2})/i)
  if (slug) return slug.slice(1).join('-')
  return null
}

/** Extrahiert Transkript-Text aus der Artikel-Seite (mehrere SA-Layouts). */
function extrahiereTranskriptHtml(page: import('playwright').Page): Promise<string> {
  return page.evaluate(() => {
    const skip = /^(seeking alpha|subscribe|sign in|comments|about this article)/i
    const containers = [
      '[data-test-id="content-container"]',
      'article[data-test-id="post-content"]',
      'div[data-test-id="article-content"]',
      'article.sa-art',
      'div.sa-art-content',
      'article',
    ]
    for (const sel of containers) {
      const root = document.querySelector(sel)
      if (!root) continue
      const parts: string[] = []
      root.querySelectorAll('p, li, h2, h3, blockquote').forEach((el) => {
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
        if (t.length < 8 || skip.test(t)) return
        if (/^(operator|unidentified|question|answer)$/i.test(t)) return
        parts.push(t)
      })
      const joined = parts.join('\n\n')
      if (joined.length > 1500) return joined
    }
    const body = document.body.innerText || ''
    const idx = body.search(/earnings call|conference call|prepared remarks|question-and-answer/i)
    if (idx >= 0) return body.slice(idx, idx + 120_000).trim()
    return body.slice(0, 80_000).trim()
  })
}

export async function scrapeSeekingAlphaLetztesTranskript(tickerRaw: string): Promise<SeekingAlphaTranscript> {
  const ticker = normalisiereTicker(tickerRaw)
  if (!ticker) throw new Error('Kein gültiger Ticker.')

  const chromium = await ladePlaywright()
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  try {
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      locale: 'en-US',
      viewport: { width: 1280, height: 900 },
    })
    const page = await context.newPage()
    await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2}', (route) => route.abort())

    const listUrl = `https://seekingalpha.com/symbol/${encodeURIComponent(ticker)}/earnings/transcripts`
    await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await versucheCookieBanner(page)
    await page.waitForTimeout(1200)

    const latest = await page.evaluate(() => {
      const links = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[href*="/article/"][href*="earnings-call-transcript"]'),
      )
      const seen = new Set<string>()
      for (const a of links) {
        const href = a.href?.split('?')[0]
        if (!href || seen.has(href)) continue
        seen.add(href)
        const title = (a.textContent || '').replace(/\s+/g, ' ').trim()
        if (title.length > 10) return { href, title }
      }
      return null
    })

    if (!latest?.href) {
      throw new Error(
        `Kein Earnings-Call-Transkript für ${ticker} auf Seeking Alpha gefunden (Symbol prüfen oder Seite blockiert).`,
      )
    }

    await page.goto(latest.href, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await versucheCookieBanner(page)
    await page.waitForTimeout(1500)

    let text = await extrahiereTranskriptHtml(page)

    if (text.length < 800) {
      await page.waitForTimeout(2500)
      text = await extrahiereTranskriptHtml(page)
    }

    if (text.length < 400) {
      throw new Error(
        'Transkript zu kurz — Seeking Alpha liefert vermutlich nur eine Paywall-Vorschau. Playwright läuft, Inhalt fehlt.',
      )
    }

    return {
      titel: latest.title,
      url: latest.href,
      callDatum: parseCallDatum(latest.title, latest.href),
      text,
    }
  } finally {
    await browser.close()
  }
}

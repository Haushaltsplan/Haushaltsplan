import 'server-only'

import { seiteWirktGesperrt } from '@/lib/radwerkstatt/radwerkstatt-html'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/**
 * Manche Shops (Bike24/Akamai) antworten normalem fetch mit „Access Denied“.
 * Ein lokales Chrome liest dieselbe öffentliche Produktseite.
 */
export async function holeHtmlMitBrowser(url: string): Promise<{ finalUrl: string; html: string } | null> {
  let chromium: (typeof import('playwright'))['chromium']
  try {
    chromium = (await import('playwright')).chromium
  } catch {
    return null
  }

  const starts: Array<Parameters<typeof chromium.launch>[0]> = [
    { channel: 'chrome', headless: true, args: ['--disable-blink-features=AutomationControlled'] },
    { headless: true, args: ['--disable-blink-features=AutomationControlled'] },
  ]

  for (const start of starts) {
    let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null
    try {
      browser = await chromium.launch(start)
      const page = await browser.newPage({ locale: 'de-DE', userAgent: UA })
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25_000 })
      const html = await page.content()
      const finalUrl = page.url()
      await browser.close()
      browser = null
      if (res && res.status() >= 400) continue
      if (!html || seiteWirktGesperrt(html)) continue
      return { finalUrl, html }
    } catch {
      await browser?.close().catch(() => undefined)
    }
  }
  return null
}

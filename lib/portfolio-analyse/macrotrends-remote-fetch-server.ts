/**
 * HTML-Abruf für Macrotrends — produktionsfähig (Vercel):
 * 1) MACROTRENDS_RELAY_URL → dein Heim-Chrome (Cloudflare-Tunnel)
 * 2) ZENROWS_API_KEY → ZenRows (js_render + premium_proxy)
 * 3) SCRAPINGBEE_API_KEY → ScrapingBee (stealth)
 * 4) lokales Chrome-CDP (nur Dev)
 */

import 'server-only'

import {
  fetchMacrotrendsHtmlViaBrowser,
  markMacrotrendsBrowserRequired,
  macrotrendsCdpVerfuegbar,
} from '@/lib/portfolio-analyse/macrotrends-browser-auth-server'

function hatDaten(html: string): boolean {
  return (
    html.includes('var originalData') ||
    html.includes('var chartData') ||
    html.includes('var dataDaily') ||
    (html.length > 40_000 && !/just a moment/i.test(html.slice(0, 2_000)))
  )
}

function istChallenge(html: string): boolean {
  const k = html.slice(0, 8_000)
  return /just a moment|cf-mitigated|challenge-platform|turnstile/i.test(k)
}

async function fetchViaRelay(url: string): Promise<string | null> {
  let base = (process.env.MACROTRENDS_RELAY_URL ?? '').trim().replace(/\/$/, '')
  let secret = (process.env.MACROTRENDS_RELAY_SECRET ?? '').trim()

  if (!base || !secret) {
    try {
      const { ladeMacrotrendsRelay } = await import(
        '@/lib/portfolio-analyse/macrotrends-relay-db-server'
      )
      const fromDb = await ladeMacrotrendsRelay()
      if (fromDb) {
        base = fromDb.baseUrl
        secret = fromDb.secret
      }
    } catch {
      /* Tabelle fehlt ggf. noch */
    }
  }
  if (!base) return null

  const res = await fetch(`${base}/fetch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(120_000),
    cache: 'no-store',
  })
  if (!res.ok) {
    console.warn(`[macrotrends-fetch] Relay HTTP ${res.status}`)
    return null
  }
  const j = (await res.json()) as { html?: string; ok?: boolean; error?: string }
  if (!j.html || istChallenge(j.html) || !hatDaten(j.html)) {
    console.warn(`[macrotrends-fetch] Relay ohne Daten: ${j.error ?? 'leer'}`)
    return null
  }
  return j.html
}

async function fetchViaZenrows(url: string): Promise<string | null> {
  const key = (process.env.ZENROWS_API_KEY ?? '').trim()
  if (!key) return null

  const api = new URL('https://api.zenrows.com/v1/')
  api.searchParams.set('apikey', key)
  api.searchParams.set('url', url)
  api.searchParams.set('js_render', 'true')
  api.searchParams.set('premium_proxy', 'true')
  api.searchParams.set('wait', '5000')

  const res = await fetch(api, {
    signal: AbortSignal.timeout(120_000),
    cache: 'no-store',
  })
  const html = await res.text()
  if (!res.ok || istChallenge(html) || !hatDaten(html)) {
    console.warn(`[macrotrends-fetch] ZenRows fail status=${res.status} len=${html.length}`)
    return null
  }
  return html
}

async function fetchViaScrapingBee(url: string): Promise<string | null> {
  const key = (process.env.SCRAPINGBEE_API_KEY ?? '').trim()
  if (!key) return null

  const api = new URL('https://app.scrapingbee.com/api/v1/')
  api.searchParams.set('api_key', key)
  api.searchParams.set('url', url)
  api.searchParams.set('render_js', 'true')
  api.searchParams.set('stealth_proxy', 'true')
  api.searchParams.set('wait', '5000')

  const res = await fetch(api, {
    signal: AbortSignal.timeout(120_000),
    cache: 'no-store',
  })
  const html = await res.text()
  if (!res.ok || istChallenge(html) || !hatDaten(html)) {
    console.warn(`[macrotrends-fetch] ScrapingBee fail status=${res.status} len=${html.length}`)
    return null
  }
  return html
}

/**
 * Eine Macrotrends-URL als HTML — Reihenfolge für öffentliche App.
 * Wirft nicht; null = alle Provider fehlgeschlagen.
 */
export async function fetchMacrotrendsHtml(url: string): Promise<string | null> {
  const viaRelay = await fetchViaRelay(url)
  if (viaRelay) return viaRelay

  const viaZen = await fetchViaZenrows(url)
  if (viaZen) return viaZen

  const viaBee = await fetchViaScrapingBee(url)
  if (viaBee) return viaBee

  // Lokal / Dev: Chrome-CDP
  if (await macrotrendsCdpVerfuegbar()) {
    markMacrotrendsBrowserRequired()
    const viaCdp = await fetchMacrotrendsHtmlViaBrowser(url)
    if (viaCdp && !istChallenge(viaCdp) && hatDaten(viaCdp)) return viaCdp
  }

  return null
}

export function macrotrendsRemoteFetchKonfiguriert(): boolean {
  return Boolean(
    process.env.MACROTRENDS_RELAY_URL?.trim() ||
      process.env.ZENROWS_API_KEY?.trim() ||
      process.env.SCRAPINGBEE_API_KEY?.trim(),
  )
}

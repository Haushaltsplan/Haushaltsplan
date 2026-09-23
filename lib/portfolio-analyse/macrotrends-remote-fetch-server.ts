/**
 * HTML-Abruf für Macrotrends — produktionsfähig (Vercel):
 * 1) MACROTRENDS_RELAY_URL → dein Heim-Chrome (Cloudflare-Tunnel)
 * 2) ZENROWS_API_KEY → ZenRows (js_render + premium_proxy)
 * 3) SCRAPINGBEE_API_KEY → ScrapingBee (stealth)
 * 4) lokales Chrome-CDP (nur Dev)
 *
 * Wichtig: Batch-Abruf (/fetch-batch) — ein Tunnel-Request für viele Seiten,
 * sonst bricht Vercel bei 9× Einzel-Roundtrips ab.
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

async function relayCredentials(): Promise<{ base: string; secret: string } | null> {
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
  return { base, secret }
}

async function fetchViaRelay(url: string): Promise<string | null> {
  const cred = await relayCredentials()
  if (!cred) return null

  const res = await fetch(`${cred.base}/fetch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cred.secret ? { Authorization: `Bearer ${cred.secret}` } : {}),
    },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(45_000),
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

/** Viele URLs in einem Relay-Request (vermeidet Vercel-Timeouts). */
export async function fetchMacrotrendsHtmlBatch(urls: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(urls.filter((u) => u.startsWith('https://www.macrotrends.net/')))]
  const out = new Map<string, string>()
  if (unique.length === 0) return out

  const cred = await relayCredentials()
  if (cred) {
    // Quick-Tunnel bricht ~100s ab — daher Chunks à 3 Seiten.
    const CHUNK = 3
    try {
      for (let i = 0; i < unique.length; i += CHUNK) {
        const chunk = unique.slice(i, i + CHUNK)
        const res = await fetch(`${cred.base}/fetch-batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(cred.secret ? { Authorization: `Bearer ${cred.secret}` } : {}),
          },
          body: JSON.stringify({ urls: chunk }),
          signal: AbortSignal.timeout(90_000),
          cache: 'no-store',
        })
        if (!res.ok) {
          console.warn(`[macrotrends-fetch] Relay-Batch HTTP ${res.status} (chunk ${i / CHUNK + 1})`)
          continue
        }
        const j = (await res.json()) as {
          pages?: Record<string, string>
          ok?: boolean
        }
        for (const [u, html] of Object.entries(j.pages ?? {})) {
          if (html && !istChallenge(html) && hatDaten(html)) out.set(u, html)
        }
      }
      if (out.size > 0) {
        console.info(`[macrotrends-fetch] Batch ${out.size}/${unique.length} via Relay`)
        // Fehlende URLs einzeln nachladen — aber nur Relay, kein CDP-Parallelkampf
        if (out.size < unique.length) {
          for (const u of unique) {
            if (out.has(u)) continue
            const html = await fetchViaRelay(u)
            if (html) out.set(u, html)
          }
        }
        return out
      }
    } catch (e) {
      console.warn(
        '[macrotrends-fetch] Relay-Batch fehlgeschlagen:',
        e instanceof Error ? e.message : e,
      )
    }
  }

  // Ohne Relay: einzeln (lokal CDP / ZenRows)
  if (await relayCredentials()) return out
  for (const u of unique) {
    const html = await fetchMacrotrendsHtml(u)
    if (html) out.set(u, html)
  }
  return out
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
 *
 * Wichtig: Wenn ein Heim-Relay konfiguriert ist, kein lokales CDP parallel —
 * beide teilen sich denselben Chrome (:9222) und erzeugen sonst 502/Deadlocks.
 */
export async function fetchMacrotrendsHtml(url: string): Promise<string | null> {
  const cred = await relayCredentials()
  if (cred) {
    const viaRelay = await fetchViaRelay(url)
    return viaRelay
  }

  const viaZen = await fetchViaZenrows(url)
  if (viaZen) return viaZen

  const viaBee = await fetchViaScrapingBee(url)
  if (viaBee) return viaBee

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

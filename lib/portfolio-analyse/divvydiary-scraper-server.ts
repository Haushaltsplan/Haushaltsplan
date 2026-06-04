import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

const BASE = 'https://divvydiary.com/de'
const MIN_ABSTAND_MS = 320
const MAX_VERSUCHE = 4
const RETRY_PAUSE_MS = 700
const CACHE_MS = 6 * 60 * 60 * 1000
const FEHLER_CACHE_MS = 3 * 60 * 1000

let letzterAbruf = 0
let warteschlange: Promise<void> = Promise.resolve()

type ScrapeCacheEintrag = {
  at: number
  path: string
  rows: DivvydiaryRohZeile[]
  fehler?: boolean
}

const scrapeCache = new Map<string, ScrapeCacheEintrag>()

function slugAusName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function divvydiaryPfade(isin: string, name: string): string[] {
  const isinNorm = isin.trim().toUpperCase()
  const k = isinKenntnis(isinNorm)
  const out: string[] = []
  const add = (path: string) => {
    if (!out.includes(path)) out.push(path)
  }

  if (k?.divvydiarySlug) {
    add(`${k.divvydiarySlug}-${isinNorm}`)
  }

  const s = slugAusName(k?.name ?? name)
  if (s) {
    add(`${s}-aktie-${isinNorm}`)
    add(`${s}-software-aktie-${isinNorm}`)
    add(`${s}-${isinNorm}`)
  }
  return out
}

export type DivvydiaryRohZeile = {
  exDate: string
  payDate: string
  amount: number
  forecast: boolean
}

/** Eingebettetes JSON (RSC) + Klartext-Fallback aus dateTime. */
export function parseDivvydiaryHtml(html: string): DivvydiaryRohZeile[] {
  const seen = new Set<string>()
  const rows: DivvydiaryRohZeile[] = []

  const push = (ex: string, pay: string, amount: number, forecast: boolean) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ex) || !/^\d{4}-\d{2}-\d{2}$/.test(pay)) return
    if (!Number.isFinite(amount) || amount <= 0) return
    const key = `${ex}|${pay}|${amount}|${forecast}`
    if (seen.has(key)) return
    seen.add(key)
    rows.push({ exDate: ex, payDate: pay, amount, forecast })
  }

  const jsonPatterns = [
    /\\"exDate\\":\\"(\d{4}-\d{2}-\d{2})\\",\\"payDate\\":\\"(\d{4}-\d{2}-\d{2})\\",\\"amount\\":([\d.]+),\\"currency\\":\\"([^"]+)\\",\\"forecast\\":(true|false)/g,
    /"exDate":"(\d{4}-\d{2}-\d{2})","payDate":"(\d{4}-\d{2}-\d{2})","amount":([\d.]+),"currency":"([^"]+)","forecast":(true|false)/g,
    /"exDate":"(\d{4}-\d{2}-\d{2})","payDate":"(\d{4}-\d{2}-\d{2})","amount":([\d.]+),"forecast":(true|false)/g,
  ]

  for (const re of jsonPatterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      push(m[1], m[2], Number(m[3]), m[5] === 'true')
    }
  }

  const blockStart = html.indexOf('"dividends":')
  if (blockStart >= 0 && rows.length === 0) {
    const block = html.slice(blockStart, blockStart + 120_000)
    const dates: string[] = []
    const dtRe = /dateTime="(\d{4}-\d{2}-\d{2})"/g
    let dm: RegExpExecArray | null
    while ((dm = dtRe.exec(block)) !== null) dates.push(dm[1])
    for (let i = 0; i + 1 < dates.length; i += 2) {
      const ex = dates[i]
      const pay = dates[i + 1]
      if (pay <= ex) continue
      const amtMatch = block
        .slice(block.indexOf(pay), block.indexOf(pay) + 160)
        .match(/"amount":([\d.]+)/)
      const amount = amtMatch ? Number(amtMatch[1]) : 0
      if (amount > 0) push(ex, pay, amount, true)
    }
  }

  return rows.sort((a, b) => a.payDate.localeCompare(b.payDate))
}

function seitePasstZuIsin(html: string, isinNorm: string, rows: DivvydiaryRohZeile[]): boolean {
  if (html.includes(isinNorm)) return true
  if (rows.length >= 4) return true
  return rows.length >= 2 && html.toLowerCase().includes(isinNorm.slice(0, 8).toLowerCase())
}

function scoreSeite(isinNorm: string, rows: DivvydiaryRohZeile[], html: string, heute: string): number {
  const isinBonus = html.includes(isinNorm) ? 5000 : 0
  const zukunft = rows.filter((r) => !r.forecast && r.payDate >= heute).length
  const bestaetigtZukunft = rows.filter((r) => !r.forecast && r.payDate >= heute).length
  return isinBonus + rows.length * 10 + zukunft * 200 + bestaetigtZukunft * 100
}

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchSeite(path: string, versuch: number): Promise<string | null> {
  const now = Date.now()
  const warten = Math.max(0, MIN_ABSTAND_MS - (now - letzterAbruf))
  if (warten > 0) await pause(warten)
  letzterAbruf = Date.now()

  const url = `${BASE}/${path}`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
        Referer: `${BASE}/`,
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(22_000),
    })

    if (res.status === 429 || res.status === 503) {
      if (versuch < MAX_VERSUCHE) {
        await pause(RETRY_PAUSE_MS * versuch)
        return fetchSeite(path, versuch + 1)
      }
      return null
    }
    if (!res.ok) return null
    const html = await res.text()
    return html.length > 8_000 ? html : null
  } catch {
    if (versuch < MAX_VERSUCHE) {
      await pause(RETRY_PAUSE_MS * versuch)
      return fetchSeite(path, versuch + 1)
    }
    return null
  }
}

/** Seriell mit Abstand — ein Request nach dem anderen. */
export function divvydiaryFetchInWarteschlange<T>(fn: () => Promise<T>): Promise<T> {
  const run = warteschlange.then(fn)
  warteschlange = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export function leereDivvydiaryScrapeCache(isin?: string): void {
  if (isin) scrapeCache.delete(isin.trim().toUpperCase())
  else scrapeCache.clear()
}

/** Gecachte Rohdaten — ein Scrape pro ISIN pro Cache-Fenster. */
export async function ladeDivvydiaryRohdaten(
  isin: string,
  name: string,
  heute: string,
): Promise<{ rows: DivvydiaryRohZeile[]; path: string } | null> {
  const isinNorm = isin.trim().toUpperCase()
  if (!isinNorm || isinNorm.length < 10) return null

  const cached = scrapeCache.get(isinNorm)
  if (cached) {
    const ttl = cached.fehler ? FEHLER_CACHE_MS : CACHE_MS
    if (Date.now() - cached.at < ttl) {
      return cached.fehler ? null : { rows: cached.rows, path: cached.path }
    }
  }

  const hit = await ladeDivvydiaryHtml(isinNorm, name, heute)
  if (!hit) {
    scrapeCache.set(isinNorm, { at: Date.now(), path: '', rows: [], fehler: true })
    return null
  }

  scrapeCache.set(isinNorm, { at: Date.now(), path: hit.path, rows: hit.rows })
  return { rows: hit.rows, path: hit.path }
}

async function ladeDivvydiaryHtml(
  isinNorm: string,
  name: string,
  heute: string,
): Promise<{ html: string; path: string; rows: DivvydiaryRohZeile[] } | null> {
  const pfade = divvydiaryPfade(isinNorm, name)

  return divvydiaryFetchInWarteschlange(async () => {
    let best: { html: string; path: string; rows: DivvydiaryRohZeile[]; score: number } | null = null

    for (const path of pfade) {
      const html = await fetchSeite(path, 1)
      if (!html) continue
      const rows = parseDivvydiaryHtml(html)
      if (rows.length === 0) continue
      if (!seitePasstZuIsin(html, isinNorm, rows)) continue

      const score = scoreSeite(isinNorm, rows, html, heute)
      if (!best || score > best.score) {
        best = { html, path, rows, score }
      }
    }

    if (!best) return null
    return { html: best.html, path: best.path, rows: best.rows }
  })
}

/** @deprecated Direkt-HTML — bevorzugt ladeDivvydiaryRohdaten. */
export async function ladeDivvydiaryHtmlLegacy(
  isin: string,
  name: string,
): Promise<{ html: string; path: string } | null> {
  const heute = new Date().toISOString().slice(0, 10)
  const hit = await ladeDivvydiaryRohdaten(isin, name, heute)
  if (!hit) return null
  return { html: '', path: hit.path }
}

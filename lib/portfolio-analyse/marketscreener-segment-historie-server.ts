/** Marketscreener — Umsatzmix nach Segment & Region (finances-segments). */

import 'server-only'

import type {
  SecSegmentEintrag,
  SecSegmentHistorie,
  SecSegmentHistoriePaket,
  SecZusatzRisikoFelder,
} from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { marketscreenerSlugKandidaten } from '@/lib/portfolio-analyse/marketscreener-slug'

const BASE = 'https://www.marketscreener.com/quote/stock'
const CACHE_MS = 12 * 60 * 60 * 1000
const CACHE_VERSION = 3
const MIN_ABSTAND_MS = 350
/** Max. Geschäftsjahre aus dem Marketscreener-Scraper. */
const MAX_JAHRE = 10

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const cache = new Map<string, { at: number; v: number; data: SecSegmentHistoriePaket | null }>()
let letzterAbruf = 0

const LEER_ZUSATZ: SecZusatzRisikoFelder = {
  mitarbeiterAnzahl: null,
  auslandsumsatzAnteilPct: null,
  hauptkunden: [],
  mitarbeiterHistorie: [],
  kundenKonzentrationHistorie: [],
}

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function throttle(): Promise<void> {
  const warten = Math.max(0, MIN_ABSTAND_MS - (Date.now() - letzterAbruf))
  if (warten > 0) await pause(warten)
  letzterAbruf = Date.now()
}

function decodeAttr(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

function bereinigeSegmentname(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .trim()
}

function istIgnoriertSegment(name: string): boolean {
  const n = name.toLowerCase()
  return (
    !n ||
    n === 'total' ||
    n.includes('unallocated') ||
    n.includes('elimination') ||
    n.includes('intersegment') ||
    n.includes('corporate unallocated') ||
    n === 'corporate'
  )
}

type ChartRoh = {
  start: number
  currency: string
  segmente: { name: string; werte: number[] }[]
}

function parseChart(html: string, chartId: string): ChartRoh | null {
  const m = html.match(new RegExp(`id="${chartId}"[\\s\\S]*?data-fct-attr="(\\{[^"]+\\})"`))
  if (!m?.[1]) return null
  try {
    const parsed = JSON.parse(decodeAttr(m[1])) as {
      start?: number
      currency?: string
      data?: Record<string, { data?: number[] }>
    }
    const start = parsed.start
    if (start == null || !parsed.data) return null
    const segmente = Object.entries(parsed.data)
      .map(([name, row]) => ({
        name: bereinigeSegmentname(name),
        werte: row.data ?? [],
      }))
      .filter((s) => !istIgnoriertSegment(s.name) && s.werte.some((v) => Math.abs(v) > 0))
    if (segmente.length === 0) return null
    const len = Math.max(...segmente.map((s) => s.werte.length))
    return {
      start,
      currency: parsed.currency ?? 'USD',
      segmente: segmente.map((s) => ({ ...s, werte: s.werte.slice(0, len) })),
    }
  } catch {
    return null
  }
}

function normalisiereName(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

function begrenzeChartRoh(chart: ChartRoh): ChartRoh {
  const len = Math.max(...chart.segmente.map((s) => s.werte.length))
  if (len <= MAX_JAHRE) return chart
  const offset = len - MAX_JAHRE
  return {
    ...chart,
    start: chart.start + offset,
    segmente: chart.segmente.map((s) => ({
      ...s,
      werte: s.werte.slice(offset),
    })),
  }
}

function chartZuHistorie(art: SecSegmentHistorie['art'], chartRoh: ChartRoh): SecSegmentHistorie | null {
  const chart = begrenzeChartRoh(chartRoh)
  const jahre: SecSegmentHistorie['jahre'] = []
  const jahrAnzahl = Math.max(...chart.segmente.map((s) => s.werte.length))
  if (jahrAnzahl < 2) return null
  const minSegProJahr = chart.segmente.length === 1 ? 1 : 2

  for (let i = 0; i < jahrAnzahl; i++) {
    const jahr = chart.start + i
    const segmente: SecSegmentEintrag[] = []
    for (const s of chart.segmente) {
      const roh = s.werte[i]
      if (roh == null || !Number.isFinite(roh) || roh <= 0) continue
      const umsatzMio = Math.round((roh / 1_000_000) * 10) / 10
      if (umsatzMio <= 0) continue
      segmente.push({ name: s.name, umsatzMio, anteilPct: null })
    }
    if (segmente.length < minSegProJahr) continue
    const summe = segmente.reduce((acc, x) => acc + (x.umsatzMio ?? 0), 0)
    if (summe <= 0) continue
    for (const seg of segmente) {
      seg.anteilPct = Math.round(((seg.umsatzMio ?? 0) / summe) * 1000) / 10
    }
    jahre.push({ jahr, segmente })
  }

  if (jahre.length < 2) return null
  const segmentNamen = [...new Set(jahre.flatMap((j) => j.segmente.map((s) => s.name)))].sort()
  const begrenzt = jahre.length > MAX_JAHRE ? jahre.slice(-MAX_JAHRE) : jahre
  return {
    art,
    jahre: begrenzt,
    segmentNamen,
    anzahlJahre: begrenzt.length,
    aeltestesJahr: begrenzt[0]!.jahr,
    juengstesJahr: begrenzt[begrenzt.length - 1]!.jahr,
  }
}

function parseWertAusZelle(cellHtml: string): number | null {
  const title = cellHtml.match(/title="([^"]+)"/)?.[1]
  if (title) {
    const n = Number(title.replace(/,/g, ''))
    if (Number.isFinite(n)) return n
  }
  const txt = cellHtml.replace(/<[^>]+>/g, '').trim()
  if (!txt || txt === '-' || txt === '—') return null
  const m = txt.match(/^([\d,.]+)\s*([BMK])?$/i)
  if (!m) return null
  let n = Number(m[1]!.replace(/,/g, ''))
  if (!Number.isFinite(n)) return null
  const unit = (m[2] ?? '').toUpperCase()
  if (unit === 'B') n *= 1_000_000_000
  else if (unit === 'M') n *= 1_000_000
  else if (unit === 'K') n *= 1_000
  return n
}

function parseSegmentTabelle(html: string, marker: RegExp): ChartRoh | null {
  const pos = html.search(marker)
  if (pos < 0) return null
  const block = html.slice(pos, pos + 120_000)
  const table = block.match(/<table[\s\S]*?<\/table>/i)?.[0]
  if (!table) return null

  const jahre: number[] = []
  const thead = table.match(/<thead[\s\S]*?<\/thead>/i)?.[0] ?? ''
  for (const m of thead.matchAll(/>\s*(\d{4})\s*</g)) {
    const j = Number(m[1])
    if (Number.isFinite(j) && !jahre.includes(j)) jahre.push(j)
  }
  if (jahre.length < 2) return null
  const offset = Math.max(0, jahre.length - MAX_JAHRE)
  const jahreBegrenzt = jahre.slice(offset)

  const segmente: ChartRoh['segmente'] = []
  for (const tr of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
    if (cells.length < jahre.length + 1) continue
    const label = bereinigeSegmentname(cells[0]![1].replace(/<[^>]+>/g, ' '))
    if (!label || istIgnoriertSegment(label) || /fiscal period/i.test(label)) continue
    const werte: number[] = []
    for (let i = 0; i < jahreBegrenzt.length; i++) {
      const v = parseWertAusZelle(cells[offset + i + 1]![1])
      werte.push(v ?? 0)
    }
    if (werte.some((v) => v > 0)) segmente.push({ name: label, werte })
  }
  if (segmente.length < 2) return null
  return { start: jahreBegrenzt[0]!, currency: 'USD', segmente }
}

function extrahiereHistorien(html: string): { produkt: SecSegmentHistorie | null; geo: SecSegmentHistorie | null } {
  const produktChart =
    parseChart(html, 'financialSegmentCA1') ??
    parseSegmentTabelle(html, /Breakdown by Business Segment/i)
  const geoChart =
    parseChart(html, 'financialSegmentCA2') ??
    parseSegmentTabelle(html, /Geographical breakdown of sales/i)

  return {
    produkt: produktChart ? chartZuHistorie('produkt', produktChart) : null,
    geo: geoChart ? chartZuHistorie('geo', geoChart) : null,
  }
}

function hatSegmentDaten(html: string): boolean {
  const { produkt, geo } = extrahiereHistorien(html)
  return (produkt?.anzahlJahre ?? 0) >= 2 || (geo?.anzahlJahre ?? 0) >= 2
}

async function fetchSegmentsHtml(slug: string): Promise<string | null> {
  await throttle()
  try {
    const res = await fetch(`${BASE}/${slug}/finances-segments/`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' },
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) return null
    const html = await res.text()
    return html.length > 50_000 ? html : null
  } catch {
    return null
  }
}

async function slugPasstZuIsin(slug: string, isin: string): Promise<boolean> {
  await throttle()
  for (const path of ['/', '/company/', '/finances/', '/finances-segments/']) {
    try {
      const res = await fetch(`${BASE}/${slug}${path}`, {
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' },
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) continue
      const html = await res.text()
      if (html.includes(isin)) return true
    } catch {
      continue
    }
  }
  return false
}

function slugsAusIsinSucheHtml(html: string, name: string): string[] {
  const kern = normalisiereName(name)
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['INC', 'PLC', 'AG', 'THE', 'AND', 'HOLDING'].includes(w))
  const haupt = kern.slice(0, 2).join(' ')
  const out: string[] = []
  for (const m of html.matchAll(/href="\/quote\/stock\/([A-Z0-9-]+-\d+)\/"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = normalisiereName(m[2].replace(/<[^>]+>/g, ' '))
    if (haupt && haupt.split(' ').every((w) => text.includes(w))) {
      out.push(m[1]!)
    }
  }
  return [...new Set(out)]
}

async function slugsAusIsinSuche(isin: string, name: string): Promise<string[]> {
  await throttle()
  try {
    const res = await fetch(`https://www.marketscreener.com/search/?q=${encodeURIComponent(isin)}`, {
      headers: { 'User-Agent': USER_AGENT },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return []
    const html = await res.text()
    return slugsAusIsinSucheHtml(html, name)
  } catch {
    return []
  }
}

async function findeGueltigenSlug(
  isin: string,
  name: string,
  symbolYahoo?: string | null,
): Promise<{ slug: string; html: string } | null> {
  const basis = [
    ...marketscreenerSlugKandidaten(isin, name, symbolYahoo),
    ...(await slugsAusIsinSuche(isin, name)),
  ].flatMap((s) => [s, s.replace(/-CORP-/, '-CORPORATION-'), s.replace(/-INC-/, '-INCORPORATION-')])
  const kandidaten = [...new Set(basis)]

  for (const slug of kandidaten) {
    if (!(await slugPasstZuIsin(slug, isin))) continue
    const html = await fetchSegmentsHtml(slug)
    if (html && hatSegmentDaten(html)) return { slug, html }
  }
  return null
}

export async function ladeMarketscreenerSegmentHistorie(opts: {
  isin: string
  name: string
  symbolYahoo?: string | null
  ticker?: string | null
}): Promise<SecSegmentHistoriePaket | null> {
  const isin = opts.isin.trim().toUpperCase()
  if (isin.length < 10) return null

  const cacheKey = isin
  const hit = cache.get(cacheKey)
  if (hit && hit.v === CACHE_VERSION && Date.now() - hit.at < CACHE_MS) return hit.data

  try {
    const symbol = opts.symbolYahoo?.trim() || opts.ticker?.trim() || isinKenntnis(isin)?.symbolYahoo
    const treffer = await findeGueltigenSlug(isin, opts.name, symbol)
    if (!treffer) {
      cache.set(cacheKey, { at: Date.now(), v: CACHE_VERSION, data: null })
      return null
    }

    const { html } = treffer
    const { produkt, geo } = extrahiereHistorien(html)

    const berichtJahr = Math.max(produkt?.juengstesJahr ?? 0, geo?.juengstesJahr ?? 0)

    const auslandAnteil =
      geo?.jahre.length && geo.jahre[geo.jahre.length - 1]
        ? (() => {
            const seg = geo.jahre[geo.jahre.length - 1]!.segmente
            const intl = seg.find((s) =>
              /non.?us|other countr|international|rest of|europe|asia|emea|abroad|foreign/i.test(s.name),
            )
            return intl?.anteilPct ?? null
          })()
        : null

    const paket: SecSegmentHistoriePaket = {
      produkt,
      geo,
      kategorien: [],
      zusatz: { ...LEER_ZUSATZ, auslandsumsatzAnteilPct: auslandAnteil },
      backlog: null,
      kennzahlen: null,
      berichtJahr: berichtJahr > 0 ? berichtJahr : null,
      anzahl10k: Math.max(produkt?.anzahlJahre ?? 0, geo?.anzahlJahre ?? 0),
      geladenAm: new Date().toISOString(),
      quelle: 'marketscreener',
    }

    if (!produkt && !geo) {
      cache.set(cacheKey, { at: Date.now(), v: CACHE_VERSION, data: null })
      return null
    }

    cache.set(cacheKey, { at: Date.now(), v: CACHE_VERSION, data: paket })
    return paket
  } catch {
    cache.set(cacheKey, { at: Date.now(), v: CACHE_VERSION, data: null })
    return null
  }
}

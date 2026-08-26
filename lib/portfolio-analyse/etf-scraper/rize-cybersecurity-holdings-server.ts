import 'server-only'

import type { EtfBreakdown } from '@/lib/portfolio-analyse/parqet-core/types'
import { reichereHoldingsMitSektor } from '@/lib/portfolio-analyse/etf-scraper/yahoo-sector-enrichment-server'

const HOLDINGS_URL = 'https://stockanalysis.com/quote/etr/RCRS/holdings/'
const CACHE_MS = 24 * 60 * 60 * 1000
const MIN_HOLDINGS = 20
const VOLLSTAENDIG_MIN = 28
const MAX_PDF_BYTES = 8_000_000

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
}

/** Offizieller UCITS-Bericht (vollständige Schedule of Investments). */
const ICAV_REPORT_URLS = [
  'https://dokumenty.analizy.pl/pobierz/etf/E_ARKIC003_A_USD/RP/2026-06-30',
  'https://dokumenty.analizy.pl/pobierz/etf/E_ARKIC003_A_USD/RP/2025-12-31',
  'https://api.fundinfo.com/document/32a1e5348044c496064b71d74ff6a87c_1226148/SAR_CH_en_IE000AON7ET1_YES_2025-12-31.pdf',
]

const EXCHANGE_YAHOO: Record<string, string> = {
  tyo: '.T',
  tse: '.T',
  tsx: '.TO',
  to: '.TO',
  lon: '.L',
  lse: '.L',
  sto: '.ST',
  st: '.ST',
}

const EXCHANGE_COUNTRY: Record<string, string> = {
  tyo: 'JP',
  tse: 'JP',
  tsx: 'CA',
  to: 'CA',
  lon: 'GB',
  lse: 'GB',
  sto: 'SE',
  st: 'SE',
}

const LAND_NACH_TICKER: Record<string, string> = {
  BB: 'CA',
  OTEX: 'CA',
  CHKP: 'IL',
  CYBR: 'IL',
  CGNT: 'IL',
  RDWR: 'IL',
  '4704': 'JP',
  '2326': 'JP',
  'TRUE-B': 'SE',
  TRUEB: 'SE',
  GBG: 'GB',
  NCC: 'GB',
}

type IcavName = { prefix: string; symbol: string; name: string; countryCode: string }

/** Kompakte ICAV-Namen (ohne Leerzeichen) → Yahoo-Symbol. Längere Prefixes zuerst. */
const ICAV_NAMEN: IcavName[] = [
  { prefix: 'checkpointsoftware', symbol: 'CHKP', name: 'Check Point Software Technologies Ltd.', countryCode: 'IL' },
  { prefix: 'nortonlifelock', symbol: 'GEN', name: 'Gen Digital Inc.', countryCode: 'US' },
  { prefix: 'paloaltonetworks', symbol: 'PANW', name: 'Palo Alto Networks, Inc.', countryCode: 'US' },
  { prefix: 'clearsecure', symbol: 'YOU', name: 'Clear Secure, Inc.', countryCode: 'US' },
  { prefix: 'cloudflare', symbol: 'NET', name: 'Cloudflare, Inc.', countryCode: 'US' },
  { prefix: 'crowdstrike', symbol: 'CRWD', name: 'CrowdStrike Holdings, Inc.', countryCode: 'US' },
  { prefix: 'digitalarts', symbol: '2326.T', name: 'Digital Arts', countryCode: 'JP' },
  { prefix: 'sentinelone', symbol: 'S', name: 'SentinelOne, Inc.', countryCode: 'US' },
  { prefix: 'trendmicro', symbol: '4704.T', name: 'Trend Micro Incorporated', countryCode: 'JP' },
  { prefix: 'truecaller', symbol: 'TRUE-B.ST', name: 'Truecaller', countryCode: 'SE' },
  { prefix: 'blackberry', symbol: 'BB.TO', name: 'BlackBerry Limited', countryCode: 'CA' },
  { prefix: 'checkpoint', symbol: 'CHKP', name: 'Check Point Software Technologies Ltd.', countryCode: 'IL' },
  { prefix: 'gendigital', symbol: 'GEN', name: 'Gen Digital Inc.', countryCode: 'US' },
  { prefix: 'ziffdavis', symbol: 'ZD', name: 'Ziff Davis, Inc.', countryCode: 'US' },
  { prefix: 'cyberark', symbol: 'CYBR', name: 'CyberArk Software', countryCode: 'IL' },
  { prefix: 'fortinet', symbol: 'FTNT', name: 'Fortinet, Inc.', countryCode: 'US' },
  { prefix: 'netscout', symbol: 'NTCT', name: 'NetScout Systems, Inc.', countryCode: 'US' },
  { prefix: 'opentext', symbol: 'OTEX', name: 'OpenText', countryCode: 'CA' },
  { prefix: 'varonis', symbol: 'VRNS', name: 'Varonis Systems, Inc.', countryCode: 'US' },
  { prefix: 'verisign', symbol: 'VRSN', name: 'VeriSign, Inc.', countryCode: 'US' },
  { prefix: 'cognyte', symbol: 'CGNT', name: 'Cognyte Software', countryCode: 'IL' },
  { prefix: 'gbgroup', symbol: 'GBG.L', name: 'GB Group', countryCode: 'GB' },
  { prefix: 'nccgroup', symbol: 'NCC.L', name: 'NCC Group', countryCode: 'GB' },
  { prefix: 'onespan', symbol: 'OSPN', name: 'OneSpan Inc.', countryCode: 'US' },
  { prefix: 'radware', symbol: 'RDWR', name: 'Radware', countryCode: 'IL' },
  { prefix: 'rapid7', symbol: 'RPD', name: 'Rapid7, Inc.', countryCode: 'US' },
  { prefix: 'tenable', symbol: 'TENB', name: 'Tenable Holdings, Inc.', countryCode: 'US' },
  { prefix: 'zscaler', symbol: 'ZS', name: 'Zscaler, Inc.', countryCode: 'US' },
  { prefix: 'akamai', symbol: 'AKAM', name: 'Akamai Technologies, Inc.', countryCode: 'US' },
  { prefix: 'qualys', symbol: 'QLYS', name: 'Qualys, Inc.', countryCode: 'US' },
  { prefix: 'rubrik', symbol: 'RBRK', name: 'Rubrik, Inc.', countryCode: 'US' },
  { prefix: 'mitek', symbol: 'MITK', name: 'Mitek Systems, Inc.', countryCode: 'US' },
  { prefix: 'okta', symbol: 'OKTA', name: 'Okta, Inc.', countryCode: 'US' },
  { prefix: 'a10', symbol: 'ATEN', name: 'A10 Networks, Inc.', countryCode: 'US' },
  { prefix: 'f5', symbol: 'FFIV', name: 'F5, Inc.', countryCode: 'US' },
].sort((a, b) => b.prefix.length - a.prefix.length)

type RizeHolding = {
  name: string
  symbol: string
  percentage: number
  countryCode: string
}

/**
 * Titel hinter der StockAnalysis-Paywall (UCITS SAR 31.12.2025).
 * Gewichte werden auf den Restanteil nach den aktuellen Top-25 skaliert.
 */
const SAR_PAYWALL_FALLBACK: RizeHolding[] = [
  { name: 'CyberArk Software', symbol: 'CYBR', percentage: 3.24, countryCode: 'IL' },
  { name: 'GB Group', symbol: 'GBG.L', percentage: 2.11, countryCode: 'GB' },
  { name: 'OpenText', symbol: 'OTEX', percentage: 1.8, countryCode: 'CA' },
  { name: 'Truecaller', symbol: 'TRUE-B.ST', percentage: 1.41, countryCode: 'SE' },
  { name: 'Digital Arts', symbol: '2326.T', percentage: 1.14, countryCode: 'JP' },
  { name: 'Radware', symbol: 'RDWR', percentage: 1.09, countryCode: 'IL' },
  { name: 'Cognyte Software', symbol: 'CGNT', percentage: 0.67, countryCode: 'IL' },
  { name: 'NCC Group', symbol: 'NCC.L', percentage: 0.38, countryCode: 'GB' },
]

let cache: { at: number; rows: RizeHolding[] } | null = null

function yahooSymbolAusHref(href: string, label: string): { symbol: string; countryCode: string } {
  const stocks = href.match(/^\/stocks\/([^/]+)\/?$/i)
  if (stocks) {
    const symbol = stocks[1]!.toUpperCase()
    return { symbol, countryCode: LAND_NACH_TICKER[symbol] ?? 'US' }
  }
  const quote = href.match(/^\/quote\/([a-z]+)\/([^/]+)\/?$/i)
  if (quote) {
    const exch = quote[1]!.toLowerCase()
    const ticker = quote[2]!.toUpperCase()
    const suffix = EXCHANGE_YAHOO[exch] ?? ''
    const symbol = `${ticker}${suffix}`
    return { symbol, countryCode: EXCHANGE_COUNTRY[exch] ?? LAND_NACH_TICKER[ticker] ?? 'US' }
  }
  const fallback = label.replace(/^[A-Z]{2,4}:\s*/i, '').trim().toUpperCase()
  return { symbol: fallback, countryCode: LAND_NACH_TICKER[fallback] ?? 'US' }
}

function yahooSymbolAusSaCode(code: string): { symbol: string; countryCode: string } {
  const bang = code.match(/^!([a-z]+)\/(.+)$/i)
  if (bang) {
    const exch = bang[1]!.toLowerCase()
    const ticker = bang[2]!.toUpperCase()
    const suffix = EXCHANGE_YAHOO[exch] ?? ''
    return {
      symbol: `${ticker}${suffix}`,
      countryCode: EXCHANGE_COUNTRY[exch] ?? LAND_NACH_TICKER[ticker] ?? 'US',
    }
  }
  const symbol = code.replace(/^\$/, '').trim().toUpperCase()
  return { symbol, countryCode: LAND_NACH_TICKER[symbol] ?? 'US' }
}

function symbolBasis(symbol: string): string {
  return symbol.trim().toUpperCase().split('.')[0] ?? ''
}

function landFuerSymbol(symbol: string): string {
  const full = symbol.trim().toUpperCase()
  const basis = symbolBasis(full)
  if (full.endsWith('.T')) return 'JP'
  if (full.endsWith('.TO')) return 'CA'
  if (full.endsWith('.L')) return 'GB'
  if (full.endsWith('.ST')) return 'SE'
  return LAND_NACH_TICKER[full] ?? LAND_NACH_TICKER[basis] ?? 'US'
}

function mappeIcavAusMid(mid: string): Omit<RizeHolding, 'percentage'> | null {
  const compact = mid.replace(/\s+/g, '')
  if (!compact || /^total/i.test(compact)) return null
  for (const row of ICAV_NAMEN) {
    const m = compact.match(new RegExp(`^${row.prefix}[a-z]*`, 'i'))
    if (!m) continue
    const rest = compact.slice(m[0].length)
    if (!/^\d{1,3}(?:,\d{3})+$/.test(rest)) continue
    return { name: row.name, symbol: row.symbol, countryCode: row.countryCode }
  }
  return null
}

/** StockAnalysis-Svelte-Payload (aktuelle Top-25-Gewichte). */
export function parseRizeCybersecuritySvelteHoldings(html: string): RizeHolding[] {
  const i = html.indexOf('data:{holdings:[')
  if (i < 0) return []
  const start = html.indexOf('[{', i)
  const end = html.indexOf('],asset_allocation', start)
  if (start < 0 || end < 0) return []
  const blob = html.slice(start, end + 1)
  const out: RizeHolding[] = []
  const seen = new Set<string>()
  const re = /\{no:\d+,n:"([^"]+)",s:"([^"]+)",as:"([0-9.]+)%"/g
  for (const m of blob.matchAll(re)) {
    const name = m[1]!.replace(/\s+/g, ' ').trim()
    const percentage = Number.parseFloat(m[3]!)
    if (!name || !Number.isFinite(percentage) || percentage <= 0) continue
    const { symbol, countryCode } = yahooSymbolAusSaCode(m[2]!.trim())
    if (!symbol || seen.has(symbol)) continue
    seen.add(symbol)
    out.push({ name, symbol, percentage, countryCode })
  }
  return out.sort((a, b) => b.percentage - a.percentage)
}

/** Öffentlich bei StockAnalysis: Top-25-Konstituenten mit aktuellem Gewicht. */
export function parseRizeCybersecurityHoldingsHtml(html: string): RizeHolding[] {
  const svelte = parseRizeCybersecuritySvelteHoldings(html)
  if (svelte.length >= MIN_HOLDINGS) return svelte

  const out: RizeHolding[] = []
  const seen = new Set<string>()
  const re =
    /<a href="(\/stocks\/[^"]+|\/quote\/[^"]+)"\s*>([^<]+)<\/a>[\s\S]*?<td class="shr svelte-mfd49r">([^<]+)<\/td>[\s\S]*?<td class="svelte-mfd49r">([0-9]+(?:\.[0-9]+)?)%<\/td>/gi
  for (const m of html.matchAll(re)) {
    const href = m[1]!.trim()
    const name = m[3]!.replace(/\s+/g, ' ').trim()
    const percentage = Number.parseFloat(m[4]!)
    if (!name || !Number.isFinite(percentage) || percentage <= 0) continue
    const { symbol, countryCode } = yahooSymbolAusHref(href, m[2]!.trim())
    if (!symbol || seen.has(symbol)) continue
    seen.add(symbol)
    out.push({ name, symbol, percentage, countryCode })
  }
  return out.sort((a, b) => b.percentage - a.percentage)
}

function cyberScheduleSlice(text: string): string {
  const anchors = ['OpenText', 'CyberArk Software', 'Truecaller', 'Cognyte Software', 'BlackBerry']
  let marker = -1
  for (const a of anchors) {
    const i = text.lastIndexOf(a)
    if (i >= 0) {
      marker = i
      break
    }
  }
  if (marker < 0) return ''
  let start = text.lastIndexOf('Canada:', marker)
  if (start < 0) start = text.lastIndexOf('Israel:', marker)
  if (start < 0) start = Math.max(0, marker - 500)
  const endCandidates = ['Rize Sustainable Future of Food', 'Total Equities']
  let end = text.length
  for (const e of endCandidates) {
    const i = text.indexOf(e, marker)
    if (i >= 0 && i < end) end = i
  }
  return text.slice(start, end)
}

/** ICAV-Bericht: vollständige Liste inkl. Titel hinter der StockAnalysis-Paywall. */
export function parseRizeIcavScheduleText(text: string): RizeHolding[] {
  const slice = cyberScheduleSlice(text)
  if (!slice) return []
  const out: RizeHolding[] = []
  const seen = new Set<string>()

  for (const rawLine of slice.split('\n')) {
    const line = rawLine.replace(/\s+/g, '').trim()
    if (!line || /^total/i.test(line) || line.includes('Equities:') || line.includes('HoldingsFinancial')) continue
    const m = line.match(/^(\d{1,3}(?:,\d{3})+)(.+)(\d+\.\d{2})$/)
    if (!m) continue
    const mapped = mappeIcavAusMid(m[2]!)
    const percentage = Number.parseFloat(m[3]!)
    if (!mapped || !Number.isFinite(percentage) || percentage <= 0) continue
    if (seen.has(mapped.symbol)) continue
    seen.add(mapped.symbol)
    out.push({ ...mapped, percentage })
  }
  return out.sort((a, b) => b.percentage - a.percentage)
}

/** Live-Top-Holdings behalten; SAR-Titel nur in den Restanteil skalieren. */
export function mergeRizeHoldings(aktuell: RizeHolding[], bericht: RizeHolding[]): RizeHolding[] {
  if (!aktuell.length) return bericht
  const have = new Set(aktuell.map((r) => symbolBasis(r.symbol)))
  const extra = bericht.filter((r) => !have.has(symbolBasis(r.symbol)))
  if (!extra.length) return aktuell
  const saSum = aktuell.reduce((s, r) => s + r.percentage, 0)
  const leftover = Math.max(0, 100 - saSum)
  const extraSum = extra.reduce((s, r) => s + r.percentage, 0)
  const scaled = extra.map((r) => ({
    ...r,
    percentage: extraSum > 0 ? (r.percentage / extraSum) * leftover : leftover / extra.length,
  }))
  return [...aktuell, ...scaled]
}

async function pdfZuText(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
    const data = await pdfParse(buffer)
    return data.text || ''
  } catch {
    return ''
  }
}

async function ladeIcavSchedule(): Promise<RizeHolding[]> {
  for (const url of ICAV_REPORT_URLS) {
    try {
      const res = await fetch(url, {
        headers: { ...FETCH_HEADERS, Accept: 'application/pdf,*/*' },
        cache: 'no-store',
        signal: AbortSignal.timeout(45_000),
      })
      if (!res.ok) continue
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 10_000 || buf.length > MAX_PDF_BYTES) continue
      if (buf.slice(0, 4).toString() !== '%PDF') continue
      const rows = parseRizeIcavScheduleText(await pdfZuText(buf))
      if (rows.length >= MIN_HOLDINGS) return rows
    } catch {
      /* nächste URL */
    }
  }
  return []
}

async function ladeStockanalysisHoldings(): Promise<RizeHolding[]> {
  const res = await fetch(HOLDINGS_URL, { headers: FETCH_HEADERS, cache: 'no-store' })
  if (!res.ok) return []
  return parseRizeCybersecurityHoldingsHtml(await res.text())
}

async function ladeFinnhubEtfHoldings(): Promise<RizeHolding[]> {
  const key = (process.env.FINNHUB_API_KEY ?? '').trim()
  if (!key) return []

  for (const sym of ['RCRS.DE', 'CYBR.L', 'CYBR.MI']) {
    const u = new URL('https://finnhub.io/api/v1/etf/holdings')
    u.searchParams.set('symbol', sym)
    u.searchParams.set('token', key)
    try {
      const res = await fetch(u.toString(), { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
      if (!res.ok) continue
      const j = (await res.json()) as {
        holdings?: Array<{ symbol?: string; name?: string; percent?: number }>
      }
      const out: RizeHolding[] = []
      const seen = new Set<string>()
      for (const h of j.holdings ?? []) {
        const symbol = (h.symbol ?? '').trim().toUpperCase()
        const name = (h.name ?? symbol).replace(/\s+/g, ' ').trim()
        const percentage = Number(h.percent)
        if (!symbol || !name || !Number.isFinite(percentage) || percentage <= 0) continue
        if (seen.has(symbol)) continue
        seen.add(symbol)
        out.push({ name, symbol, percentage, countryCode: landFuerSymbol(symbol) })
      }
      if (out.length >= MIN_HOLDINGS) return out.sort((a, b) => b.percentage - a.percentage)
    } catch {
      /* nächstes Symbol */
    }
  }
  return []
}

async function ladeRizeHoldingsRaw(): Promise<RizeHolding[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows

  const [sa, icav, finnhub] = await Promise.all([
    ladeStockanalysisHoldings(),
    ladeIcavSchedule(),
    ladeFinnhubEtfHoldings(),
  ])

  let rows: RizeHolding[]
  if (finnhub.length >= VOLLSTAENDIG_MIN) {
    rows = finnhub
  } else {
    const live = sa.length >= MIN_HOLDINGS ? sa : finnhub
    const bericht = icav.length >= MIN_HOLDINGS ? icav : SAR_PAYWALL_FALLBACK
    rows = mergeRizeHoldings(live, bericht)
  }

  if (rows.length >= MIN_HOLDINGS) cache = { at: Date.now(), rows }
  return rows
}

function laenderAusHoldings(rows: RizeHolding[]): EtfBreakdown['countries'] {
  const m = new Map<string, number>()
  for (const r of rows) {
    m.set(r.countryCode, (m.get(r.countryCode) ?? 0) + r.percentage)
  }
  return [...m.entries()]
    .map(([countryCode, percentage]) => ({ countryCode, percentage }))
    .sort((a, b) => b.percentage - a.percentage)
}

/** Rize / ARK Cybersecurity & Data Privacy UCITS ETF (IE00BJXRZJ40) — Look-through. */
export async function ladeRizeCybersecurityBreakdown(): Promise<EtfBreakdown | null> {
  const rows = await ladeRizeHoldingsRaw()
  if (rows.length < MIN_HOLDINGS) return null

  const sum = rows.reduce((s, r) => s + r.percentage, 0)
  const factor = sum > 0 ? 100 / sum : 1
  const normiert = rows.map((r) => ({ ...r, percentage: r.percentage * factor }))

  const topHoldings = await reichereHoldingsMitSektor(
    normiert.map((r) => ({
      name: r.name,
      symbol: r.symbol,
      percentage: r.percentage,
    })),
    50,
  )

  return {
    topHoldings,
    sectors: [],
    countries: laenderAusHoldings(normiert),
  }
}

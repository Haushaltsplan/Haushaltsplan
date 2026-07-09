import 'server-only'

import {
  FUNDAMENTAL_TTM_KEY,
  type FundamentalFrequenz,
  type FundamentalMetrikZeile,
  type FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { formatFundamentalPeriodeLabel } from '@/lib/portfolio-analyse/fundamentaldaten-format'

const BASE = 'https://www.macrotrends.net'
const IFRAME_BASE =
  'https://www.macrotrends.net/production/stocks/desktop/PRODUCTION/fundamental_iframe.php'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const CACHE_MS = 24 * 60 * 60 * 1000
const FEHLER_CACHE_MS = 3 * 60 * 1000
/** Bei Live-Fehler: erfolgreichen Cache bis 7 Tage als Fallback (kein Datenverlust). */
const STALE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const MIN_ABSTAND_MS = 520
const FETCH_TIMEOUT_MS = 35_000
const MAX_FETCH_RETRIES = 3
const RETRY_BASE_MS = 900

const FETCH_HEADERS: Record<string, string> = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.macrotrends.net/',
  'Cache-Control': 'no-cache',
}

let letzterAbruf = 0
let warteschlange: Promise<void> = Promise.resolve()

type PageCache = { at: number; html: string | null; fehler?: boolean }
const pageCache = new Map<string, PageCache>()

export type MacrotrendsIdent = {
  ticker: string
  slug: string
  firmenname: string
}

export type MacrotrendsIdentOpts = {
  erwarteterTicker?: string
  firmenname?: string
  slug?: string
  /** Macrotrends-Chart-Ticker wenn ≠ Börsensymbol (z. B. MC → LVMUY). */
  macrotrendsTicker?: string
}

/** Kurz-Ticker / EU-Listings: Macrotrends nutzt oft ADR-Ticker oder eigene Slugs. */
const BEKANNTE_MACROTRENDS_SLUGS: Record<
  string,
  { slug: string; firmenname: string; macrotrendsTicker?: string }
> = {
  MA: { slug: 'mastercard', firmenname: 'Mastercard' },
  V: { slug: 'visa', firmenname: 'Visa' },
  WM: { slug: 'waste-management', firmenname: 'Waste Management' },
  HD: { slug: 'home-depot', firmenname: 'Home Depot' },
  MC: { slug: 'louis-vuitton', firmenname: 'LVMH', macrotrendsTicker: 'LVMUY' },
  RMS: { slug: 'hermes-international', firmenname: 'Hermès', macrotrendsTicker: 'HESAY' },
  ASML: { slug: 'asml-holding', firmenname: 'ASML Holding' },
  WKL: { slug: 'wolters-kluwer', firmenname: 'Wolters Kluwer', macrotrendsTicker: 'WTKWY' },
  MUM: { slug: 'mensch-und-maschine', firmenname: 'Mensch und Maschine' },
  HLMA: { slug: 'halma', firmenname: 'Halma' },
  STMN: { slug: 'straumann-holding', firmenname: 'Straumann Holding', macrotrendsTicker: 'SAUHY' },
  SIKA: { slug: 'sika', firmenname: 'Sika', macrotrendsTicker: 'SXYAY' },
  ATD: { slug: 'alimentation-couche-tard', firmenname: 'Alimentation Couche-Tard' },
  GOOG: { slug: 'alphabet', firmenname: 'Alphabet' },
  GOOGL: { slug: 'alphabet', firmenname: 'Alphabet', macrotrendsTicker: 'GOOG' },
  MSFT: { slug: 'microsoft', firmenname: 'Microsoft' },
  SPGI: { slug: 's-p-global', firmenname: 'S&P Global' },
  UNH: { slug: 'unitedhealth-group', firmenname: 'UnitedHealth' },
  TMO: { slug: 'thermo-fisher-scientific', firmenname: 'Thermo Fisher Scientific' },
  NOW: { slug: 'servicenow', firmenname: 'ServiceNow' },
  RMD: { slug: 'resmed', firmenname: 'Resmed' },
  ODFL: { slug: 'old-dominion-freight-line', firmenname: 'Old Dominion Freight Line' },
  UNP: { slug: 'union-pacific', firmenname: 'Union Pacific' },
  ZTS: { slug: 'zoetis', firmenname: 'Zoetis' },
  MCD: { slug: 'mcdonalds', firmenname: "McDonald's" },
  DDOG: { slug: 'datadog', firmenname: 'Datadog' },
  BCPC: { slug: 'balchem', firmenname: 'Balchem' },
  LIN: { slug: 'linde', firmenname: 'Linde' },
  VEEV: { slug: 'veeva-systems', firmenname: 'Veeva Systems' },
  KNSL: { slug: 'kinsale-capital', firmenname: 'Kinsale Capital' },
  GGG: { slug: 'graco', firmenname: 'Graco' },
  ANET: { slug: 'arista-networks', firmenname: 'Arista Networks' },
  ROL: { slug: 'rollins', firmenname: 'Rollins' },
  CTAS: { slug: 'cintas', firmenname: 'Cintas' },
  UPST: { slug: 'upstart-holdings', firmenname: 'Upstart Holdings' },
  MSCI: { slug: 'msci', firmenname: 'MSCI' },
}

type RohZeile = Record<string, string | number> & { field_name: string }

type StatementSeite =
  | 'financial-ratios'
  | 'income-statement'
  | 'cash-flow-statement'
  | 'price-ratios'
  | 'balance-sheet'

type MetrikDef = {
  slug: string
  id: string
  label: string
  gruppe: FundamentalMetrikZeile['gruppe']
  einheit: FundamentalMetrikZeile['einheit']
  aliases?: string[]
  statement: StatementSeite
}

const INCOME_STATEMENT_METRIKEN: MetrikDef[] = [
  { slug: 'revenue', id: 'umsatz', label: 'Umsatz', gruppe: 'finanzdaten', einheit: 'waehrung_usd_mio', statement: 'income-statement' },
  { slug: 'gross-profit', id: 'bruttogewinn', label: 'Bruttogewinn', gruppe: 'finanzdaten', einheit: 'waehrung_usd_mio', statement: 'income-statement' },
  { slug: 'ebitda', id: 'ebitda', label: 'EBITDA', gruppe: 'finanzdaten', einheit: 'waehrung_usd_mio', statement: 'income-statement' },
  { slug: 'operating-income', id: 'ebit', label: 'EBIT', gruppe: 'finanzdaten', einheit: 'waehrung_usd_mio', statement: 'income-statement' },
  { slug: 'net-income', id: 'nettogewinn', label: 'Nettogewinn', gruppe: 'finanzdaten', einheit: 'waehrung_usd_mio', statement: 'income-statement' },
  {
    slug: 'eps-earnings-per-share-diluted',
    id: 'eps',
    label: 'EPS (verwässert)',
    gruppe: 'finanzdaten',
    einheit: 'waehrung_usd_aktie',
    statement: 'income-statement',
    aliases: ['eps-basic-net-earnings-per-share'],
  },
  {
    slug: 'research-development-expenses',
    id: 'rd',
    label: 'Forschung & Entwicklung (R&D)',
    gruppe: 'finanzdaten',
    einheit: 'waehrung_usd_mio',
    statement: 'income-statement',
  },
  {
    slug: 'selling-general-administrative-expenses',
    id: 'sga',
    label: 'SG&A (Vertrieb & Verwaltung)',
    gruppe: 'finanzdaten',
    einheit: 'waehrung_usd_mio',
    statement: 'income-statement',
  },
  { slug: 'shares-outstanding', id: 'aktien', label: 'Ausstehende Aktien', gruppe: 'finanzdaten', einheit: 'aktien_mio', statement: 'income-statement' },
]

const CASH_FLOW_METRIKEN: MetrikDef[] = [
  {
    slug: 'cash-flow-from-operating-activities',
    id: 'ocf',
    label: 'Operativer Cashflow',
    gruppe: 'cashflow',
    einheit: 'waehrung_usd_mio',
    statement: 'cash-flow-statement',
  },
  {
    slug: 'net-change-in-property-plant-equipment',
    id: 'capex',
    label: 'CapEx (Investitionen)',
    gruppe: 'cashflow',
    einheit: 'waehrung_usd_mio',
    statement: 'cash-flow-statement',
  },
  {
    slug: 'stock-based-compensation',
    id: 'sbc',
    label: 'Stock-Based Compensation (SBC)',
    gruppe: 'cashflow',
    einheit: 'waehrung_usd_mio',
    statement: 'cash-flow-statement',
  },
  {
    slug: 'depreciation-amortization',
    id: 'da',
    label: 'Abschreibungen (D&A)',
    gruppe: 'cashflow',
    einheit: 'waehrung_usd_mio',
    statement: 'cash-flow-statement',
    aliases: ['total-depreciation-amortization-cash-flow'],
  },
  {
    slug: 'common-stock-repurchased',
    id: 'aktienrueckkauf',
    label: 'Aktienrückkäufe',
    gruppe: 'cashflow',
    einheit: 'waehrung_usd_mio',
    statement: 'cash-flow-statement',
    aliases: ['net-common-equity-issued-repurchased'],
  },
  {
    slug: 'common-stock-dividends-paid',
    id: 'dividenden_gezahlt',
    label: 'Gezahlte Dividenden',
    gruppe: 'cashflow',
    einheit: 'waehrung_usd_mio',
    statement: 'cash-flow-statement',
  },
]

const BALANCE_SHEET_METRIKEN: MetrikDef[] = [
  { slug: 'total-assets', id: 'gesamtvermoegen', label: 'Gesamtvermögen', gruppe: 'bilanz', einheit: 'waehrung_usd_mio', statement: 'balance-sheet' },
  { slug: 'total-liabilities', id: 'gesamtverbindlichkeiten', label: 'Gesamtverbindlichkeiten', gruppe: 'bilanz', einheit: 'waehrung_usd_mio', statement: 'balance-sheet' },
  {
    slug: 'total-stockholder-equity',
    id: 'eigenkapital',
    label: 'Eigenkapital',
    gruppe: 'bilanz',
    einheit: 'waehrung_usd_mio',
    statement: 'balance-sheet',
    aliases: ['total-stockholders-equity'],
  },
  { slug: 'total-debt', id: 'gesamtverschuldung', label: 'Gesamtverschuldung', gruppe: 'bilanz', einheit: 'waehrung_usd_mio', statement: 'balance-sheet' },
  { slug: 'cash-on-hand', id: 'bargeld', label: 'Bargeld & Äquivalente', gruppe: 'bilanz', einheit: 'waehrung_usd_mio', statement: 'balance-sheet' },
  { slug: 'net-receivables', id: 'forderungen', label: 'Forderungen (netto)', gruppe: 'bilanz', einheit: 'waehrung_usd_mio', statement: 'balance-sheet' },
  { slug: 'inventory', id: 'vorraete', label: 'Vorräte', gruppe: 'bilanz', einheit: 'waehrung_usd_mio', statement: 'balance-sheet' },
  { slug: 'goodwill', id: 'goodwill', label: 'Goodwill', gruppe: 'bilanz', einheit: 'waehrung_usd_mio', statement: 'balance-sheet' },
  { slug: 'total-current-assets', id: 'umlaufvermoegen', label: 'Umlaufvermögen', gruppe: 'bilanz', einheit: 'waehrung_usd_mio', statement: 'balance-sheet' },
  { slug: 'total-current-liabilities', id: 'kurzfrist_verbindl', label: 'Kurzfristige Verbindlichkeiten', gruppe: 'bilanz', einheit: 'waehrung_usd_mio', statement: 'balance-sheet' },
]

const FINANCIAL_RATIOS_METRIKEN: MetrikDef[] = [
  { slug: 'roa', id: 'roa', label: 'Gesamtkapitalrendite (ROA %)', gruppe: 'rentabilitaet', einheit: 'prozent', statement: 'financial-ratios' },
  { slug: 'roe', id: 'roe', label: 'Eigenkapitalrendite (ROE %)', gruppe: 'rentabilitaet', einheit: 'prozent', statement: 'financial-ratios' },
  {
    slug: 'roi',
    id: 'roi',
    label: 'ROIC %',
    gruppe: 'rentabilitaet',
    einheit: 'prozent',
    statement: 'financial-ratios',
    aliases: ['return-on-invested-capital'],
  },
  { slug: 'gross-margin', id: 'bruttomarge', label: 'Bruttomarge %', gruppe: 'margen', einheit: 'prozent', statement: 'financial-ratios' },
  { slug: 'ebitda-margin', id: 'ebitda_marge', label: 'EBITDA-Marge %', gruppe: 'margen', einheit: 'prozent', statement: 'financial-ratios' },
  { slug: 'ebit-margin', id: 'ebit_marge', label: 'EBIT-Marge %', gruppe: 'margen', einheit: 'prozent', statement: 'financial-ratios' },
  { slug: 'net-profit-margin', id: 'nettomarge', label: 'Nettomarge %', gruppe: 'margen', einheit: 'prozent', statement: 'financial-ratios' },
  { slug: 'asset-turnover', id: 'kapitalumschlag', label: 'Kapitalumschlaghäufigkeit', gruppe: 'umschlag', einheit: 'ratio', statement: 'financial-ratios' },
  { slug: 'inventory-turnover', id: 'anlagenumschlag', label: 'Lagerumschlag', gruppe: 'umschlag', einheit: 'ratio', statement: 'financial-ratios' },
  { slug: 'receiveable-turnover', id: 'forderungsumschlag', label: 'Forderungsumschlag', gruppe: 'umschlag', einheit: 'ratio', statement: 'financial-ratios' },
  {
    slug: 'days-sales-in-receivables',
    id: 'dso',
    label: 'Forderungslaufzeit (DSO, Tage)',
    gruppe: 'umschlag',
    einheit: 'zahl',
    statement: 'financial-ratios',
  },
  {
    slug: 'days-in-inventory',
    id: 'dio',
    label: 'Lagerdauer (DIO, Tage)',
    gruppe: 'umschlag',
    einheit: 'zahl',
    statement: 'financial-ratios',
    aliases: ['days-sales-in-inventory'],
  },
  {
    slug: 'days-payables-outstanding',
    id: 'dpo',
    label: 'Verbindlichkeitenlaufzeit (DPO, Tage)',
    gruppe: 'umschlag',
    einheit: 'zahl',
    statement: 'financial-ratios',
  },
]

const BEWERTUNG_METRIKEN: Array<
  MetrikDef & { wertFeld: 'v3' | 'v1' | 'value'; ttmFeld?: 'v3' | 'v1' }
> = [
  { slug: 'pe-ratio', id: 'kgv', label: 'KGV (P/E)', gruppe: 'bewertung_trailing', einheit: 'multiple', statement: 'price-ratios', wertFeld: 'v3', ttmFeld: 'v3' },
  { slug: 'price-sales', id: 'ps', label: 'KGV/Umsatz (P/S)', gruppe: 'bewertung_trailing', einheit: 'multiple', statement: 'price-ratios', wertFeld: 'v3', ttmFeld: 'v3' },
  { slug: 'price-book', id: 'pb', label: 'KBV (P/B)', gruppe: 'bewertung_trailing', einheit: 'multiple', statement: 'price-ratios', wertFeld: 'v3', ttmFeld: 'v3' },
  { slug: 'price-fcf', id: 'pfcf', label: 'Kurs/FCF', gruppe: 'bewertung_trailing', einheit: 'multiple', statement: 'price-ratios', wertFeld: 'v3', ttmFeld: 'v3' },
]

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function htmlBlockiertOderLeer(html: string): boolean {
  if (html.length < 1_500) return true
  if (html.includes('Oops!')) return true
  const kopf = html.slice(0, 8_000).toLowerCase()
  return /access denied|403 forbidden|rate limit|cf-challenge|just a moment|captcha|bot detection/i.test(
    kopf,
  )
}

function htmlHatOriginalData(html: string): boolean {
  return html.includes('var originalData = ')
}

function htmlHatChartData(html: string): boolean {
  return html.includes('var chartData = ')
}

async function rateLimitedFetch(url: string): Promise<string | null> {
  await warteschlange
  let resolve!: () => void
  warteschlange = new Promise((r) => {
    resolve = r
  })
  try {
    for (let attempt = 0; attempt <= MAX_FETCH_RETRIES; attempt++) {
      const warten = Math.max(0, MIN_ABSTAND_MS - (Date.now() - letzterAbruf))
      if (warten > 0) await pause(warten)
      letzterAbruf = Date.now()

      try {
        const res = await fetch(url, {
          headers: FETCH_HEADERS,
          cache: 'no-store',
          redirect: 'follow',
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        })

        if (res.status === 429 || res.status === 503 || res.status === 502 || res.status === 403) {
          if (attempt < MAX_FETCH_RETRIES) {
            await pause(RETRY_BASE_MS * (attempt + 1) + 400)
            continue
          }
          return null
        }

        if (!res.ok) {
          if (res.status >= 500 && attempt < MAX_FETCH_RETRIES) {
            await pause(RETRY_BASE_MS * (attempt + 1))
            continue
          }
          return null
        }

        const html = await res.text()
        if (htmlBlockiertOderLeer(html)) {
          if (attempt < MAX_FETCH_RETRIES) {
            await pause(RETRY_BASE_MS * (attempt + 1) + 600)
            continue
          }
          return null
        }
        return html
      } catch {
        if (attempt < MAX_FETCH_RETRIES) {
          await pause(RETRY_BASE_MS * (attempt + 1))
          continue
        }
        return null
      }
    }
    return null
  } finally {
    resolve()
  }
}

function staleFallback(url: string): string | null {
  const hit = pageCache.get(url)
  if (!hit?.html || hit.fehler) return null
  const age = Date.now() - hit.at
  if (age > STALE_MAX_AGE_MS) return null
  console.warn(`[macrotrends] Stale-Cache-Fallback (${Math.round(age / 3600000)}h alt): ${url}`)
  return hit.html
}

async function ladeSeite(
  url: string,
  opts?: { forceRefresh?: boolean; nurCache?: boolean },
): Promise<string | null> {
  const hit = pageCache.get(url)
  const now = Date.now()
  if (!opts?.forceRefresh && hit && now - hit.at < (hit.fehler ? FEHLER_CACHE_MS : CACHE_MS)) {
    return hit.html
  }

  if (opts?.nurCache) {
    if (hit?.html && !hit.fehler) return hit.html
    return staleFallback(url)
  }

  const html = await rateLimitedFetch(url)
  if (html) {
    pageCache.set(url, { at: now, html, fehler: false })
    return html
  }

  const stale = staleFallback(url)
  if (stale) return stale

  pageCache.set(url, { at: now, html: null, fehler: true })
  return null
}

function parseJsonArray<T>(html: string, marker: string): T[] | null {
  const idx = html.indexOf(marker)
  if (idx < 0) return null
  const start = idx + marker.length
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < html.length; i++) {
    const ch = html[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') {
      inStr = true
      continue
    }
    if (ch === '[') depth++
    if (ch === ']') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1)) as T[]
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function slugAusFieldName(fieldName: string): string | null {
  const href = fieldName.match(/href=['"]\/stocks\/charts\/[^/]+\/[^/]+\/([^'">?]+)/i)
  if (href?.[1]) return href[1]
  const m = fieldName.match(/\/stocks\/charts\/[^/]+\/[^/]+\/([^'">\s]+)/)
  return m?.[1] ?? null
}

function parseOriginalData(html: string): RohZeile[] | null {
  return parseJsonArray<RohZeile>(html, 'var originalData = ')
}

function parseZahl(raw: unknown): number | null {
  if (raw == null || raw === '' || raw === '-') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function periodenAusRoh(zeilen: RohZeile[]): string[] {
  const set = new Set<string>()
  for (const z of zeilen) {
    for (const k of Object.keys(z)) {
      if (k === 'field_name' || k === 'popup_icon') continue
      if (/^\d{4}-\d{2}-\d{2}$/.test(k)) set.add(k)
    }
  }
  return [...set].sort()
}

function zeileFuerSlug(zeilen: RohZeile[], slug: string, aliases: string[] = []): RohZeile | null {
  const suche = new Set([slug, ...aliases])
  return (
    zeilen.find((z) => {
      const s = slugAusFieldName(String(z.field_name))
      return s != null && suche.has(s)
    }) ?? null
  )
}

function bauePerioden(isoListe: string[], mitTtm: boolean, frequenz?: FundamentalFrequenz): FundamentalPeriode[] {
  const perioden: FundamentalPeriode[] = isoListe.map((iso) => ({
    iso,
    label: formatFundamentalPeriodeLabel(iso, frequenz),
  }))
  if (mitTtm) {
    perioden.push({ iso: FUNDAMENTAL_TTM_KEY, label: 'TTM', istLtm: true })
  }
  return perioden
}

function werteAusRoh(
  zeile: RohZeile | null,
  perioden: string[],
  ttmWert?: number | null,
): Record<string, number | null> {
  const out: Record<string, number | null> = {}
  for (const p of perioden) {
    out[p] = zeile ? parseZahl(zeile[p]) : null
  }
  if (ttmWert !== undefined) {
    out[FUNDAMENTAL_TTM_KEY] = ttmWert ?? null
  }
  return out
}

type ChartPunkt = { date: string; v1?: number; v2?: number; v3?: number; value?: number }

function parseChartData(html: string): ChartPunkt[] | null {
  return parseJsonArray<ChartPunkt>(html, 'var chartData = ')
}

function wertAusChartPunkt(p: ChartPunkt, feld: 'v3' | 'v1' | 'value'): number | null {
  const v = p[feld] ?? p.v3 ?? p.v1 ?? p.value
  return parseZahl(v)
}

const CHART_DATUM_TOLERANZ_MS = 45 * 24 * 3600 * 1000

function wertAusChartNaehe(
  chart: ChartPunkt[],
  iso: string,
  feld: 'v3' | 'v1' | 'value',
): number | null {
  const byDate = new Map(chart.map((p) => [p.date, p]))
  const exakt = byDate.get(iso)
  if (exakt) return wertAusChartPunkt(exakt, feld)

  const ziel = new Date(`${iso}T12:00:00Z`).getTime()
  let best: ChartPunkt | null = null
  let bestDiff = Infinity
  for (const p of chart) {
    const diff = Math.abs(new Date(`${p.date}T12:00:00Z`).getTime() - ziel)
    if (diff < bestDiff && diff <= CHART_DATUM_TOLERANZ_MS) {
      bestDiff = diff
      best = p
    }
  }
  return best ? wertAusChartPunkt(best, feld) : null
}

/** Geschäftsjahres-Enddaten mit ±45-Tage-Toleranz zum Chart; letzter Chart-Punkt = TTM. */
function werteAusChartExakt(
  chart: ChartPunkt[],
  perioden: string[],
  feld: 'v3' | 'v1' | 'value',
  mitTtm = true,
): Record<string, number | null> {
  const out: Record<string, number | null> = {}
  for (const iso of perioden) {
    out[iso] = wertAusChartNaehe(chart, iso, feld)
  }
  if (mitTtm) {
    const latest = chart.length > 0 ? chart[chart.length - 1] : null
    out[FUNDAMENTAL_TTM_KEY] = latest ? wertAusChartPunkt(latest, feld) : null
  }
  return out
}

/** FY-Spalten aus Bewertungs-Charts ergänzen, wenn GuV/FR noch kein aktuelles Jahr hat. */
function ergaenzePeriodenAusBewertungsCharts(
  periodenIso: string[],
  charts: ChartPunkt[][],
  mitTtm: boolean,
): string[] {
  const set = new Set(periodenIso)
  const jahreInPerioden = new Set(periodenIso.map((iso) => iso.slice(0, 4)))
  const aktuellesJahr = String(new Date().getUTCFullYear())

  for (const chart of charts) {
    if (!chart.length) continue
    const historisch = mitTtm ? chart.slice(0, -1) : chart
    const letzterProJahr = new Map<string, string>()
    for (const punkt of historisch) {
      const jahr = punkt.date.slice(0, 4)
      const prev = letzterProJahr.get(jahr)
      if (!prev || punkt.date > prev) letzterProJahr.set(jahr, punkt.date)
    }
    for (const [jahr, iso] of letzterProJahr) {
      if (jahreInPerioden.has(jahr)) continue
      if (jahr >= aktuellesJahr) continue
      set.add(iso)
      jahreInPerioden.add(jahr)
    }
  }

  return [...set].sort()
}

function berechneFcf(ocf: Record<string, number | null>, capex: Record<string, number | null>): Record<string, number | null> {
  const keys = new Set([...Object.keys(ocf), ...Object.keys(capex)])
  const out: Record<string, number | null> = {}
  for (const k of keys) {
    const o = ocf[k]
    const c = capex[k]
    if (o == null && c == null) {
      out[k] = null
    } else {
      out[k] = (o ?? 0) + (c ?? 0)
    }
  }
  return out
}

async function ladeStatementRoh(
  ident: MacrotrendsIdent,
  statement: StatementSeite,
  frequenz: FundamentalFrequenz = 'jahr',
  opts?: { nurCache?: boolean },
): Promise<RohZeile[] | null> {
  const freqParam = frequenz === 'quartal' ? '?freq=Q' : ''
  const url = `${BASE}/stocks/charts/${ident.ticker}/${ident.slug}/${statement}${freqParam}`

  const maxVersuche = opts?.nurCache ? 1 : 2
  for (let versuch = 0; versuch < maxVersuche; versuch++) {
    const html = await ladeSeite(
      url,
      opts?.nurCache
        ? { nurCache: true }
        : versuch > 0
          ? { forceRefresh: true }
          : undefined,
    )
    if (!html) continue
    const roh = parseOriginalData(html)
    if (roh?.length) return roh
    if (!opts?.nurCache) pageCache.delete(url)
  }
  return null
}

/** Konzern-Umsatz pro Geschäftsjahr (ISO-Jahreszahl) aus GuV — für Segment-Abgleich. */
export async function baueUmsatzProJahrAusMacrotrends(
  ident: MacrotrendsIdent,
  frequenz: FundamentalFrequenz = 'jahr',
): Promise<Map<number, number>> {
  const roh = await ladeStatementRoh(ident, 'income-statement', frequenz)
  const rev = roh ? zeileFuerSlug(roh, 'revenue') : null
  const map = new Map<number, number>()
  if (!rev) return map
  for (const key of Object.keys(rev)) {
    if (key === 'field_name' || key === 'popup_icon') continue
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue
    const val = parseZahl(rev[key])
    if (val == null || val <= 0) continue
    map.set(parseInt(key.slice(0, 4), 10), val)
  }
  return map
}

export async function loeseMacrotrendsIdent(
  suchbegriff: string,
  nameOrOpts?: string | MacrotrendsIdentOpts,
): Promise<MacrotrendsIdent | null> {
  const opts: MacrotrendsIdentOpts =
    typeof nameOrOpts === 'string' ? { firmenname: nameOrOpts } : (nameOrOpts ?? {})
  const q = suchbegriff.trim()
  const firmenname = opts.firmenname?.trim()
  const erwartet = opts.erwarteterTicker?.trim().toUpperCase()

  if (erwartet) {
    const ausSlug = identAusBekanntemSlug(erwartet, opts.slug, firmenname, opts.macrotrendsTicker)
    if (ausSlug) return ausSlug
  }

  const suchbegriffe: string[] = []
  if (firmenname) suchbegriffe.push(firmenname)
  if (q && !suchbegriffe.includes(q)) suchbegriffe.push(q)

  for (const s of suchbegriffe) {
    const items = await ladeMacrotrendsSuchergebnisse(s)
    const ident = waehleMacrotrendsIdent(items, { erwarteterTicker: erwartet, firmenname })
    if (ident) return ident
  }

  return null
}

async function ladeMacrotrendsSuchergebnisse(q: string): Promise<Array<{ name?: string; url?: string }>> {
  if (!q.trim()) return []
  const url = `${BASE}/assets/php/all_pages_query.php?q=${encodeURIComponent(q.trim())}`

  for (let versuch = 0; versuch < 2; versuch++) {
    const html = await ladeSeite(url, versuch > 0 ? { forceRefresh: true } : undefined)
    if (!html) continue
    try {
      const items = JSON.parse(html) as Array<{ name?: string; url?: string }>
      return Array.isArray(items) ? items : []
    } catch {
      pageCache.delete(url)
    }
  }
  return []
}

function firmennameAusSuchtitel(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*-\s*.*$/i, '')
    .replace(/\s*-\s*.*$/i, '')
    .trim()
}

function identsAusSuchergebnis(items: Array<{ name?: string; url?: string }>): MacrotrendsIdent[] {
  const seen = new Set<string>()
  const out: MacrotrendsIdent[] = []
  for (const item of items) {
    const url = item.url ?? ''
    if (!url.includes('/stocks/charts/')) continue
    const m = url.match(/\/stocks\/charts\/([^/]+)\/([^/]+)\//)
    if (!m) continue
    const key = `${m[1].toUpperCase()}|${m[2].toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    const titel = item.name?.trim() ?? ''
    out.push({
      ticker: m[1].toUpperCase(),
      slug: m[2],
      firmenname: firmennameAusSuchtitel(titel) || m[2].replace(/-/g, ' '),
    })
  }
  return out
}

function normalisiereName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function namePasstZuIdent(firmenname: string, ident: MacrotrendsIdent): boolean {
  const n = normalisiereName(firmenname)
  const f = normalisiereName(ident.firmenname)
  if (!n || !f) return false
  if (/hermes|hermès/.test(n) && /federated|federal/.test(f)) return false
  if (/hermes|hermès/.test(n) && ident.slug.includes('federated')) return false
  return f.includes(n) || n.includes(f) || n.split(' ').filter((w) => w.length > 3).every((w) => f.includes(w))
}

function waehleMacrotrendsIdent(
  items: Array<{ name?: string; url?: string }>,
  opts: { erwarteterTicker?: string; firmenname?: string },
): MacrotrendsIdent | null {
  const kandidaten = identsAusSuchergebnis(items)
  if (kandidaten.length === 0) return null

  const erwartet = opts.erwarteterTicker?.toUpperCase()
  if (erwartet) {
    const exakt = kandidaten.find((k) => k.ticker.toUpperCase() === erwartet)
    if (exakt) return exakt
    if (opts.firmenname) {
      const perName = kandidaten.find((k) => namePasstZuIdent(opts.firmenname!, k))
      if (perName) return perName
    }
    return null
  }

  if (opts.firmenname) {
    const perName = kandidaten.find((k) => namePasstZuIdent(opts.firmenname!, k))
    if (perName) return perName
  }

  return kandidaten[0] ?? null
}

function identAusBekanntemSlug(
  ticker: string,
  slugOverride?: string,
  firmenname?: string,
  macrotrendsTickerOverride?: string,
): MacrotrendsIdent | null {
  const t = ticker.toUpperCase()
  let basis = BEKANNTE_MACROTRENDS_SLUGS[t]
  if (!basis) {
    for (const [, val] of Object.entries(BEKANNTE_MACROTRENDS_SLUGS)) {
      if (val.macrotrendsTicker?.toUpperCase() === t) {
        basis = val
        break
      }
    }
  }
  const slug = slugOverride?.trim() || basis?.slug
  if (!slug) return null
  const chartTicker =
    macrotrendsTickerOverride?.trim().toUpperCase() || basis?.macrotrendsTicker?.toUpperCase() || t
  return {
    ticker: chartTicker,
    slug,
    firmenname: firmenname?.trim() || basis?.firmenname || t,
  }
}

export function macrotrendsTickerAusSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase()
  const m = /^([A-Z0-9-]+)\.(DE|PA|AS|L|SW|HM|F|MI|MC|MU|BE|VI|WA|BR|HE|DU|SG|ST|TO|AX|NZ|US)$/i.exec(s)
  if (m) return m[1].toUpperCase()
  return s.replace(/\./g, '-').split('-')[0] ?? s
}

export type MacrotrendsFundamentalRoh = {
  ident: MacrotrendsIdent
  perioden: FundamentalPeriode[]
  zeilen: FundamentalMetrikZeile[]
  beschreibung: string | null
  branche: string | null
}

export async function ladeMacrotrendsFundamentaldaten(
  ident: MacrotrendsIdent,
  frequenz: FundamentalFrequenz = 'jahr',
  opts?: { nurCache?: boolean },
): Promise<MacrotrendsFundamentalRoh | null> {
  const mtOpts = opts?.nurCache ? { nurCache: true as const } : undefined
  const [ratiosRoh, incomeRoh, cfRoh, bsRoh] = await Promise.all([
    ladeStatementRoh(ident, 'financial-ratios', frequenz, mtOpts),
    ladeStatementRoh(ident, 'income-statement', frequenz, mtOpts),
    ladeStatementRoh(ident, 'cash-flow-statement', frequenz, mtOpts),
    ladeStatementRoh(ident, 'balance-sheet', frequenz, mtOpts),
  ])

  const ratios = ratiosRoh ?? []
  const income = incomeRoh ?? []
  const cf = cfRoh ?? []
  const bs = bsRoh ?? []

  if (ratios.length === 0 && income.length === 0 && cf.length === 0 && bs.length === 0) {
    return null
  }

  /** Union aller Statements — financial-ratios hinkt oft hinter GuV/CF (z. B. ASML FY2025). */
  let periodenIso = [
    ...new Set([
      ...periodenAusRoh(ratios),
      ...periodenAusRoh(income),
      ...periodenAusRoh(cf),
      ...periodenAusRoh(bs),
    ]),
  ].sort()
  if (periodenIso.length === 0) return null

  const mitTtm = frequenz === 'jahr'
  let perioden = bauePerioden(periodenIso, mitTtm, frequenz)
  const zeilen: FundamentalMetrikZeile[] = []

  const rohCache = new Map<StatementSeite, RohZeile[]>([
    ['financial-ratios', ratios],
    ['income-statement', income],
    ['cash-flow-statement', cf],
    ['balance-sheet', bs],
  ])

  function metrikenAusDefs(defs: MetrikDef[]) {
    for (const def of defs) {
      const roh = rohCache.get(def.statement) ?? []
      const row = zeileFuerSlug(roh, def.slug, def.aliases)
      if (!row) continue
      zeilen.push({
        id: def.id,
        label: def.label,
        gruppe: def.gruppe,
        einheit: def.einheit,
        werte: werteAusRoh(row, periodenIso),
        macrotrendsSlug: def.slug,
        macrotrendsStatement: def.statement === 'price-ratios' ? 'price-ratios' : def.statement,
      })
    }
  }

  metrikenAusDefs(INCOME_STATEMENT_METRIKEN)
  metrikenAusDefs(CASH_FLOW_METRIKEN)
  metrikenAusDefs(BALANCE_SHEET_METRIKEN)
  metrikenAusDefs(FINANCIAL_RATIOS_METRIKEN)

  const ocfRow = zeileFuerSlug(cf, 'cash-flow-from-operating-activities')
  const capexRow = zeileFuerSlug(cf, 'net-change-in-property-plant-equipment')
  if (ocfRow || capexRow) {
    const ocfWerte = werteAusRoh(ocfRow, periodenIso)
    const capexWerte = werteAusRoh(capexRow, periodenIso)
    zeilen.push({
      id: 'fcf',
      label: 'Free Cashflow (FCF)',
      gruppe: 'cashflow',
      einheit: 'waehrung_usd_mio',
      werte: berechneFcf(ocfWerte, capexWerte),
      macrotrendsStatement: 'cash-flow-statement',
    })
  }

  const daRow = zeileFuerSlug(cf, 'depreciation-amortization', ['total-depreciation-amortization-cash-flow'])
  if (capexRow && daRow) {
    const capexWerte = werteAusRoh(capexRow, periodenIso)
    const daWerte = werteAusRoh(daRow, periodenIso)
    const ratioWerte: Record<string, number | null> = {}
    for (const iso of periodenIso) {
      const c = capexWerte[iso]
      const d = daWerte[iso]
      if (c != null && d != null && d !== 0) ratioWerte[iso] = Math.abs(c) / Math.abs(d)
      else ratioWerte[iso] = null
    }
    zeilen.push({
      id: 'capex_da_ratio',
      label: 'CapEx / D&A (Wartungs-CapEx-Proxy)',
      gruppe: 'cashflow',
      einheit: 'ratio',
      werte: ratioWerte,
      macrotrendsStatement: 'cash-flow-statement',
    })
  }

  const bewertungCharts = await Promise.all(
    BEWERTUNG_METRIKEN.map(async (def) => {
      const freqCode = frequenz === 'quartal' ? 'Q' : 'A'
      const iframeUrl = `${IFRAME_BASE}?t=${encodeURIComponent(ident.ticker)}&type=${encodeURIComponent(def.slug)}&statement=price-ratios&freq=${freqCode}&sub=&yb=15`
      let iframeHtml = await ladeSeite(iframeUrl)
      let chart = iframeHtml ? parseChartData(iframeHtml) : null
      if (!chart?.length && iframeHtml && !htmlHatChartData(iframeHtml)) {
        pageCache.delete(iframeUrl)
        iframeHtml = await ladeSeite(iframeUrl, { forceRefresh: true })
        chart = iframeHtml ? parseChartData(iframeHtml) : null
      }
      return { def, chart }
    }),
  )

  if (mitTtm && bewertungCharts.some((b) => b.chart?.length)) {
    const charts = bewertungCharts.map((b) => b.chart).filter((c): c is ChartPunkt[] => c != null && c.length > 0)
    const erweitert = ergaenzePeriodenAusBewertungsCharts(periodenIso, charts, mitTtm)
    if (erweitert.length > periodenIso.length) {
      const neu = erweitert.filter((iso) => !periodenIso.includes(iso))
      periodenIso = erweitert
      perioden = bauePerioden(periodenIso, mitTtm, frequenz)
      for (const z of zeilen) {
        for (const iso of neu) {
          if (!(iso in z.werte)) z.werte[iso] = null
        }
      }
    }
  }

  for (const { def, chart } of bewertungCharts) {
    zeilen.push({
      id: def.id,
      label: def.label,
      gruppe: def.gruppe,
      einheit: def.einheit,
      werte: chart
        ? werteAusChartExakt(chart, periodenIso, def.wertFeld, mitTtm)
        : Object.fromEntries([...periodenIso, ...(mitTtm ? [FUNDAMENTAL_TTM_KEY] : [])].map((p) => [p, null])),
      macrotrendsSlug: def.slug,
      macrotrendsStatement: 'price-ratios',
    })
  }

  const lastFy = [...periodenIso].reverse().find((iso) => {
    for (const z of zeilen) {
      if (z.macrotrendsStatement === 'price-ratios') continue
      const v = z.werte[iso]
      if (v != null && Number.isFinite(v)) return true
    }
    return false
  })
  if (lastFy && mitTtm) {
    for (const z of zeilen) {
      if (z.macrotrendsStatement === 'price-ratios') continue
      if (z.werte[FUNDAMENTAL_TTM_KEY] == null && z.werte[lastFy] != null) {
        z.werte[FUNDAMENTAL_TTM_KEY] = z.werte[lastFy]
      }
    }
  }

  const ratiosUrl = `${BASE}/stocks/charts/${ident.ticker}/${ident.slug}/financial-ratios`
  const ratiosHtml = pageCache.get(ratiosUrl)?.html ?? (await ladeSeite(ratiosUrl))
  const metaMatch = ratiosHtml?.match(/<meta name="description" content="([^"]+)"/)
  const beschreibung =
    metaMatch?.[1]?.replace(/&lt;[^&]+&gt;/g, '').replace(/&[^;]+;/g, ' ').trim() ?? null

  return {
    ident,
    perioden,
    zeilen,
    beschreibung,
    branche: null,
  }
}

export async function ladeMacrotrendsChartSerie(
  ident: MacrotrendsIdent,
  slug: string,
  statement: 'financial-ratios' | 'price-ratios' | 'income-statement' | 'cash-flow-statement' | 'balance-sheet',
  frequenz: FundamentalFrequenz = 'jahr',
): Promise<Array<{ datum: string; wert: number }>> {
  if (statement === 'price-ratios') {
    const iframeUrl = `${IFRAME_BASE}?t=${encodeURIComponent(ident.ticker)}&type=${encodeURIComponent(slug)}&statement=price-ratios&freq=A&sub=&yb=15`
    const iframeHtml = await ladeSeite(iframeUrl)
    const chart = iframeHtml ? parseChartData(iframeHtml) : null
    if (chart?.length) {
      return chart
        .map((p) => ({
          datum: p.date,
          wert: wertAusChartPunkt(p, 'v3') ?? wertAusChartPunkt(p, 'v1') ?? 0,
        }))
        .filter((p) => Number.isFinite(p.wert))
    }
  }

  const roh = await ladeStatementRoh(ident, statement, frequenz)
  const row = roh ? zeileFuerSlug(roh, slug) : null
  if (row) {
    return periodenAusRoh([row])
      .map((iso) => ({ datum: iso, wert: parseZahl(row[iso]) ?? 0 }))
      .filter((p) => p.wert !== 0)
  }

  return []
}

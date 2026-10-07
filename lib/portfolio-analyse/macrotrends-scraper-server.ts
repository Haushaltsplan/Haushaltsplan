import 'server-only'

import {
  FUNDAMENTAL_TTM_KEY,
  type FundamentalFrequenz,
  type FundamentalMetrikZeile,
  type FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { formatFundamentalPeriodeLabel } from '@/lib/portfolio-analyse/fundamentaldaten-format'

/**
 * Legacy-Fassade: Typen + Ident-Auflösung bleiben (viele Importe),
 * GuV kommt ausschließlich aus SEC EDGAR. Macrotrends-HTML ist abgeschaltet.
 */
const BASE = 'https://www.macrotrends.net'
const IFRAME_BASE =
  'https://www.macrotrends.net/production/stocks/desktop/PRODUCTION/fundamental_iframe.php'

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
  /** Macrotrends-Chart-Ticker wenn â‰  BÃ¶rsensymbol (z. B. MC â†’ LVMUY). */
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
  RMS: { slug: 'hermes-international', firmenname: 'HermÃ¨s', macrotrendsTicker: 'HESAY' },
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
  AOS: { slug: 'a-o-smith', firmenname: 'A.O. Smith' },
  FICO: { slug: 'fair-isaac', firmenname: 'Fair Isaac' },
}

type RohZeile = Record<string, string | number> & { field_name: string }

export type StatementSeite =
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
    label: 'EPS (verwÃ¤ssert)',
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
    label: 'AktienrÃ¼ckkÃ¤ufe',
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
  { slug: 'total-assets', id: 'gesamtvermoegen', label: 'GesamtvermÃ¶gen', gruppe: 'bilanz', einheit: 'waehrung_usd_mio', statement: 'balance-sheet' },
  { slug: 'total-liabilities', id: 'gesamtverbindlichkeiten', label: 'Gesamtverbindlichkeiten', gruppe: 'bilanz', einheit: 'waehrung_usd_mio', statement: 'balance-sheet' },
  {
    // Macrotrends 2026: â€žtotal-share-holder-equityâ€œ (Bindestrich share-holder)
    slug: 'total-share-holder-equity',
    id: 'eigenkapital',
    label: 'Eigenkapital',
    gruppe: 'bilanz',
    einheit: 'waehrung_usd_mio',
    statement: 'balance-sheet',
    aliases: ['total-stockholder-equity', 'total-stockholders-equity', 'total-shareholders-equity'],
  },
  /**
   * Macrotrends hat kein â€žtotal-debtâ€œ (404) â€” nur langfristig.
   * Gesamtverschuldung (inkl. kurzfristig + Leases) kommt spÃ¤ter von Yahoo.
   */
  {
    slug: 'long-term-debt',
    id: 'gesamtverschuldung',
    label: 'Langfristige Schulden (Macrotrends-Fallback)',
    gruppe: 'bilanz',
    einheit: 'waehrung_usd_mio',
    statement: 'balance-sheet',
    aliases: ['total-debt'],
  },
  { slug: 'cash-on-hand', id: 'bargeld', label: 'Bargeld & Ã„quivalente', gruppe: 'bilanz', einheit: 'waehrung_usd_mio', statement: 'balance-sheet' },
  {
    slug: 'receivables-total',
    id: 'forderungen',
    label: 'Forderungen (netto)',
    gruppe: 'bilanz',
    einheit: 'waehrung_usd_mio',
    statement: 'balance-sheet',
    aliases: ['net-receivables'],
  },
  { slug: 'inventory', id: 'vorraete', label: 'VorrÃ¤te', gruppe: 'bilanz', einheit: 'waehrung_usd_mio', statement: 'balance-sheet' },
  {
    slug: 'goodwill',
    id: 'goodwill',
    label: 'Goodwill',
    gruppe: 'bilanz',
    einheit: 'waehrung_usd_mio',
    statement: 'balance-sheet',
    aliases: ['goodwill-intangible-assets-total'],
  },
  { slug: 'total-current-assets', id: 'umlaufvermoegen', label: 'UmlaufvermÃ¶gen', gruppe: 'bilanz', einheit: 'waehrung_usd_mio', statement: 'balance-sheet' },
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
  { slug: 'asset-turnover', id: 'kapitalumschlag', label: 'KapitalumschlaghÃ¤ufigkeit', gruppe: 'umschlag', einheit: 'ratio', statement: 'financial-ratios' },
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
  MetrikDef & {
    wertFeld: 'v3' | 'v1' | 'value'
    ttmFeld?: 'v3' | 'v1'
    /** Chart-Rohwert multiplizieren (market-cap: v3 in Mrd. USD â†’ Mio.) */
    scale?: number
  }
> = [
  { slug: 'pe-ratio', id: 'kgv', label: 'KGV (P/E)', gruppe: 'bewertung_trailing', einheit: 'multiple', statement: 'price-ratios', wertFeld: 'v3', ttmFeld: 'v3' },
  { slug: 'price-sales', id: 'ps', label: 'KUV (P/S)', gruppe: 'bewertung_trailing', einheit: 'multiple', statement: 'price-ratios', wertFeld: 'v3', ttmFeld: 'v3' },
  { slug: 'price-book', id: 'pb', label: 'KBV (P/B)', gruppe: 'bewertung_trailing', einheit: 'multiple', statement: 'price-ratios', wertFeld: 'v3', ttmFeld: 'v3' },
  { slug: 'price-fcf', id: 'pfcf', label: 'Kurs/FCF', gruppe: 'bewertung_trailing', einheit: 'multiple', statement: 'price-ratios', wertFeld: 'v3', ttmFeld: 'v3' },
  {
    slug: 'market-cap',
    id: 'marktkapitalisierung',
    label: 'Marktkapitalisierung',
    gruppe: 'bilanz',
    einheit: 'waehrung_usd_mio',
    statement: 'price-ratios',
    wertFeld: 'v3',
    ttmFeld: 'v3',
    scale: 1000,
  },
]

/** Macrotrends-HTML abgeschaltet — Fundamentals kommen aus SEC EDGAR (+ Yahoo/URD für EU). */
async function ladeSeite(
  _url: string,
  _opts?: { forceRefresh?: boolean; nurCache?: boolean; erwartetJson?: boolean },
): Promise<string | null> {
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

/** Price-Ratio-Multiples â‰¤ 0 sind Platzhalter (Macrotrends) â†’ null. */
function normalisiereMultipleWert(v: number | null): number | null {
  if (v == null || !Number.isFinite(v) || v <= 0) return null
  return v
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
  if (best) return wertAusChartPunkt(best, feld)

  // Same-year Fallback (FY-Ende driftet >45 Tage zwischen Charts und GuV)
  const jahr = iso.slice(0, 4)
  let bestJahr: ChartPunkt | null = null
  for (const p of chart) {
    if (p.date.slice(0, 4) !== jahr) continue
    if (!bestJahr || p.date > bestJahr.date) bestJahr = p
  }
  return bestJahr ? wertAusChartPunkt(bestJahr, feld) : null
}

/** GeschÃ¤ftsjahres-Enddaten mit Â±45-Tage-Toleranz zum Chart; letzter Chart-Punkt = TTM. */
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

/** FY-Spalten aus Bewertungs-Charts ergÃ¤nzen, wenn GuV/FR noch kein aktuelles Jahr hat. */
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
    if (o == null) {
      out[k] = null
    } else {
      out[k] = o + (c ?? 0)
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

/** Konzern-Umsatz pro Geschäftsjahr (ISO-Jahreszahl) aus SEC-GuV — für Segment-Abgleich. */
export async function ladeMacrotrendsStatementSerien(
  _ident: MacrotrendsIdent,
  _statement: StatementSeite,
  _frequenz: FundamentalFrequenz = 'jahr',
): Promise<Map<string, Map<string, number>> | null> {
  return null
}

export async function baueUmsatzProJahrAusMacrotrends(
  ident: MacrotrendsIdent,
  _frequenz: FundamentalFrequenz = 'jahr',
): Promise<Map<number, number>> {
  const { baueUmsatzProJahrAusSec } = await import('@/lib/portfolio-analyse/sec-fundamentaldaten-server')
  return baueUmsatzProJahrAusSec(ident)
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
    return identAusBekanntemSlug(erwartet, opts.slug, firmenname, opts.macrotrendsTicker)
  }

  const tickerLike = q.toUpperCase()
  if (/^[A-Z0-9.-]{1,12}$/.test(tickerLike) && !/\s/.test(q)) {
    return identAusBekanntemSlug(tickerLike, opts.slug, firmenname, opts.macrotrendsTicker)
  }

  return null
}

function jsonArrayAusHtml(html: string): string | null {
  const tryParse = (s: string): string | null => {
    const t = s.trim()
    if (!t.startsWith('[')) return null
    try {
      const v = JSON.parse(t) as unknown
      return Array.isArray(v) ? t : null
    } catch {
      return null
    }
  }
  const direkt = tryParse(html)
  if (direkt) return direkt
  const pre = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i)
  if (pre?.[1]) {
    const inner = pre[1]
      .replace(/&quot;/g, '"')
      .replace(/&#34;/g, '"')
      .replace(/&amp;/g, '&')
    const ausPre = tryParse(inner)
    if (ausPre) return ausPre
  }
  return null
}

async function ladeMacrotrendsSuchergebnisse(q: string): Promise<Array<{ name?: string; url?: string }>> {
  if (!q.trim()) return []
  const url = `${BASE}/assets/php/all_pages_query.php?q=${encodeURIComponent(q.trim())}`

  for (let versuch = 0; versuch < 2; versuch++) {
    const html = await ladeSeite(url, { erwartetJson: true, ...(versuch > 0 ? { forceRefresh: true } : {}) })
    if (!html) continue
    const json = jsonArrayAusHtml(html)
    if (!json) {
      pageCache.delete(url)
      continue
    }
    try {
      const items = JSON.parse(json) as Array<{ name?: string; url?: string }>
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

/** WÃ¶rter, die allein keinen Firmen-Match rechtfertigen (zu generisch). */
const SCHWACHE_NAMENSWORTER = new Set([
  'smith', 'group', 'holding', 'holdings', 'corp', 'corporation', 'inc', 'ltd',
  'limited', 'plc', 'ag', 'sa', 'nv', 'se', 'co', 'company', 'international',
  'industries', 'systems', 'technologies', 'services', 'capital', 'partners',
])

function namePasstZuIdent(firmenname: string, ident: MacrotrendsIdent): boolean {
  const n = normalisiereName(firmenname)
  const f = normalisiereName(ident.firmenname)
  if (!n || !f) return false
  if (/hermes|hermÃ¨s/.test(n) && /federated|federal/.test(f)) return false
  if (/hermes|hermÃ¨s/.test(n) && ident.slug.includes('federated')) return false
  // Volle Zeichenkette enthalten (z. B. â€žmicrosoft" in â€žmicrosoft corporation")
  if (f.includes(n) || n.includes(f)) return true
  // Wortweise: mind. 2 signifikante WÃ¶rter mÃ¼ssen passen â€” sonst z. B.
  // â€žA.O. Smith" â†’ nur â€žsmith" â†’ fÃ¤lschlich â€žSmith & Nephew".
  const signifikante = n.split(' ').filter((w) => w.length > 2 && !SCHWACHE_NAMENSWORTER.has(w))
  if (signifikante.length === 0) {
    // Nur schwache WÃ¶rter (z. B. reine â€žSmith Corp"): dann ALLE WÃ¶rter > 2 Zeichen
    const alle = n.split(' ').filter((w) => w.length > 2)
    return alle.length >= 2 && alle.every((w) => f.includes(w))
  }
  if (signifikante.length === 1) {
    // Ein starkes Wort reicht nur, wenn es das dominante Wort im Ident ist
    // (z. B. â€žDatadog" â†’ â€ždatadog") â€” nicht bei Teil-Match in lÃ¤ngeren Namen.
    return f === signifikante[0] || f.startsWith(`${signifikante[0]} `)
  }
  return signifikante.every((w) => f.includes(w))
}

function waehleMacrotrendsIdent(
  items: Array<{ name?: string; url?: string }>,
  opts: { erwarteterTicker?: string; firmenname?: string },
): MacrotrendsIdent | null {
  const kandidaten = identsAusSuchergebnis(items)
  if (kandidaten.length === 0) return null

  const erwartet = opts.erwarteterTicker?.toUpperCase()
  if (erwartet) {
    // Bei bekanntem Ticker: NUR exakter Ticker-Treffer.
    // Kein Namens-Fallback â€” sonst landet â€žA.O. Smith"/AOS bei â€žSmith & Nephew"/SNN.
    return kandidaten.find((k) => k.ticker.toUpperCase() === erwartet) ?? null
  }

  if (opts.firmenname) {
    // Kein blinder Erst-Treffer: Bei Namenssuche ohne Ãœbereinstimmung lieber null
    // (sonst z. B. â€žRATIONAL Aktiengesellschaft" â†’ â€žDeutsche Bank Aktiengesellschaft").
    return kandidaten.find((k) => namePasstZuIdent(opts.firmenname!, k)) ?? null
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
  const slug = slugOverride?.trim() || basis?.slug || t.toLowerCase()
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
  /** SEC Company Facts statt Macrotrends-HTML */
  guvQuelle?: 'sec'
  waehrung?: string
}

async function praefetchSeiten(_urls: string[]): Promise<void> {
  /* Macrotrends-HTML abgeschaltet */
}

function statementUrlsFuer(ident: MacrotrendsIdent, frequenz: FundamentalFrequenz): string[] {
  const freqParam = frequenz === 'quartal' ? '?freq=Q' : ''
  return (['financial-ratios', 'income-statement', 'cash-flow-statement', 'balance-sheet'] as const).map(
    (s) => `${BASE}/stocks/charts/${ident.ticker}/${ident.slug}/${s}${freqParam}`,
  )
}

function bewertungUrlsFuer(ident: MacrotrendsIdent, frequenz: FundamentalFrequenz): string[] {
  const freqCode = frequenz === 'quartal' ? 'Q' : 'A'
  return BEWERTUNG_METRIKEN.map(
    (def) =>
      `${IFRAME_BASE}?t=${encodeURIComponent(ident.ticker)}&type=${encodeURIComponent(def.slug)}&statement=price-ratios&freq=${freqCode}&sub=&yb=15`,
  )
}

export async function ladeMacrotrendsFundamentaldaten(
  ident: MacrotrendsIdent,
  frequenz: FundamentalFrequenz = 'jahr',
  opts?: { nurCache?: boolean },
): Promise<MacrotrendsFundamentalRoh | null> {
  const { ladeSecFundamentaldaten } = await import('@/lib/portfolio-analyse/sec-fundamentaldaten-server')
  const sec = await ladeSecFundamentaldaten(ident, frequenz)
  if (sec) return sec
  if (opts?.nurCache) return null
  return null
}
/** Abgeschaltet — GuV/Bewertung kommen aus SEC EDGAR + Yahoo, nicht Macrotrends-HTML. */
export async function ladeMacrotrendsChartSerie(
  _ident: MacrotrendsIdent,
  _slug: string,
  _statement: 'financial-ratios' | 'price-ratios' | 'income-statement' | 'cash-flow-statement' | 'balance-sheet',
  _frequenz: FundamentalFrequenz = 'jahr',
): Promise<Array<{ datum: string; wert: number }>> {
  return []
}

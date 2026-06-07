import 'server-only'

import type {
  FundamentalMetrikZeile,
  FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { formatFundamentalPeriodeLabel } from '@/lib/portfolio-analyse/fundamentaldaten-format'

const BASE = 'https://www.macrotrends.net'
const IFRAME_BASE =
  'https://www.macrotrends.net/production/stocks/desktop/PRODUCTION/fundamental_iframe.php'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const CACHE_MS = 24 * 60 * 60 * 1000
const FEHLER_CACHE_MS = 15 * 60 * 1000
const MIN_ABSTAND_MS = 450

let letzterAbruf = 0
let warteschlange: Promise<void> = Promise.resolve()

type PageCache = { at: number; html: string | null; fehler?: boolean }
const pageCache = new Map<string, PageCache>()

export type MacrotrendsIdent = {
  ticker: string
  slug: string
  firmenname: string
}

type RohZeile = Record<string, string | number> & { field_name: string }

type MetrikDef = {
  slug: string
  id: string
  label: string
  gruppe: FundamentalMetrikZeile['gruppe']
  einheit: FundamentalMetrikZeile['einheit']
  aliases?: string[]
}

const FINANCIAL_RATIOS_METRIKEN: MetrikDef[] = [
  { slug: 'roa', id: 'roa', label: 'Gesamtkapitalrendite (ROA %)', gruppe: 'rentabilitaet', einheit: 'prozent' },
  { slug: 'roi', id: 'roic', label: 'Investiertes Kapitalrendite (ROIC %)', gruppe: 'rentabilitaet', einheit: 'prozent', aliases: ['roi'] },
  { slug: 'roe', id: 'roe', label: 'Eigenkapitalrendite (ROE %)', gruppe: 'rentabilitaet', einheit: 'prozent' },
  { slug: 'gross-margin', id: 'bruttomarge', label: 'Bruttomarge %', gruppe: 'margen', einheit: 'prozent' },
  { slug: 'ebitda-margin', id: 'ebitda_marge', label: 'EBITDA-Marge %', gruppe: 'margen', einheit: 'prozent' },
  { slug: 'ebit-margin', id: 'ebit_marge', label: 'EBIT-Marge %', gruppe: 'margen', einheit: 'prozent' },
  { slug: 'net-profit-margin', id: 'nettomarge', label: 'Nettomarge %', gruppe: 'margen', einheit: 'prozent' },
  { slug: 'asset-turnover', id: 'kapitalumschlag', label: 'Kapitalumschlaghäufigkeit', gruppe: 'umschlag', einheit: 'ratio' },
  { slug: 'inventory-turnover', id: 'anlagenumschlag', label: 'Anlagenumschlag', gruppe: 'umschlag', einheit: 'ratio' },
  { slug: 'receiveable-turnover', id: 'forderungsumschlag', label: 'Forderungsumschlag', gruppe: 'umschlag', einheit: 'ratio' },
]

const BEWERTUNG_METRIKEN: Array<
  MetrikDef & { statement: 'price-ratios'; wertFeld: 'v3' | 'v1' | 'value' }
> = [
  { slug: 'pe-ratio', id: 'kgv_ltm', label: 'LTM KGV (P/E)', gruppe: 'bewertung_trailing', einheit: 'multiple', statement: 'price-ratios', wertFeld: 'v3' },
  { slug: 'price-sales', id: 'ev_umsatz_ltm', label: 'LTM KGV/Umsatz (P/S)', gruppe: 'bewertung_trailing', einheit: 'multiple', statement: 'price-ratios', wertFeld: 'v3' },
  { slug: 'price-book', id: 'kbv_ltm', label: 'LTM KBV (P/B)', gruppe: 'bewertung_trailing', einheit: 'multiple', statement: 'price-ratios', wertFeld: 'v3' },
  { slug: 'price-fcf', id: 'kgv_fcf_ltm', label: 'LTM Kurs/FCF', gruppe: 'bewertung_trailing', einheit: 'multiple', statement: 'price-ratios', wertFeld: 'v3' },
  { slug: 'dividend-yield-history', id: 'dividendenrendite_ltm', label: 'LTM Dividendenrendite', gruppe: 'bewertung_trailing', einheit: 'prozent', statement: 'price-ratios', wertFeld: 'v3' },
]

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function rateLimitedFetch(url: string): Promise<string | null> {
  await warteschlange
  let resolve!: () => void
  warteschlange = new Promise((r) => {
    resolve = r
  })
  try {
    const warten = Math.max(0, MIN_ABSTAND_MS - (Date.now() - letzterAbruf))
    if (warten > 0) await pause(warten)
    letzterAbruf = Date.now()
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  } finally {
    resolve()
  }
}

async function ladeSeite(url: string): Promise<string | null> {
  const hit = pageCache.get(url)
  if (hit && Date.now() - hit.at < (hit.fehler ? FEHLER_CACHE_MS : CACHE_MS)) {
    return hit.html
  }
  const html = await rateLimitedFetch(url)
  pageCache.set(url, { at: Date.now(), html, fehler: html == null })
  return html
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
  const m = fieldName.match(/\/stocks\/charts\/[^/]+\/[^/]+\/([^'"]+)/)
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

function bauePerioden(isoListe: string[], ltmIso: string | null): FundamentalPeriode[] {
  const perioden: FundamentalPeriode[] = isoListe.map((iso) => ({
    iso,
    label: formatFundamentalPeriodeLabel(iso),
  }))
  if (ltmIso) {
    const idx = perioden.findIndex((p) => p.iso === ltmIso)
    if (idx >= 0) {
      perioden[idx] = { ...perioden[idx], label: 'LTM', istLtm: true }
    }
  }
  return perioden
}

function werteAusRoh(zeile: RohZeile | null, perioden: string[]): Record<string, number | null> {
  const out: Record<string, number | null> = {}
  for (const p of perioden) {
    out[p] = zeile ? parseZahl(zeile[p]) : null
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

function werteAusChart(
  chart: ChartPunkt[],
  perioden: string[],
  feld: 'v3' | 'v1' | 'value',
): Record<string, number | null> {
  const byDate = new Map(chart.map((p) => [p.date, p]))
  const out: Record<string, number | null> = {}
  for (const iso of perioden) {
    const exakt = byDate.get(iso)
    if (exakt) {
      out[iso] = wertAusChartPunkt(exakt, feld)
      continue
    }
    const ziel = new Date(`${iso}T12:00:00Z`).getTime()
    let best: ChartPunkt | null = null
    let bestDiff = Infinity
    for (const p of chart) {
      const diff = Math.abs(new Date(`${p.date}T12:00:00Z`).getTime() - ziel)
      if (diff < bestDiff && diff <= 45 * 86_400_000) {
        bestDiff = diff
        best = p
      }
    }
    out[iso] = best ? wertAusChartPunkt(best, feld) : null
  }
  return out
}

export async function loeseMacrotrendsIdent(
  suchbegriff: string,
  name?: string,
): Promise<MacrotrendsIdent | null> {
  const q = suchbegriff.trim() || name?.trim() || ''
  if (!q) return null
  const html = await ladeSeite(`${BASE}/assets/php/all_pages_query.php?q=${encodeURIComponent(q)}`)
  if (!html) return null
  let items: Array<{ name?: string; url?: string }>
  try {
    items = JSON.parse(html) as Array<{ name?: string; url?: string }>
  } catch {
    return null
  }
  if (!Array.isArray(items) || items.length === 0) return null
  const stock = items.find((i) => i.url?.includes('/stocks/charts/')) ?? items[0]
  const url = stock.url ?? ''
  const m = url.match(/\/stocks\/charts\/([^/]+)\/([^/]+)\//)
  if (!m) return null
  const firmenname = (stock.name ?? name ?? m[1]).replace(/\s*\([^)]*\).*$/, '').trim()
  return { ticker: m[1], slug: m[2], firmenname }
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
): Promise<MacrotrendsFundamentalRoh | null> {
  const ratiosUrl = `${BASE}/stocks/charts/${ident.ticker}/${ident.slug}/financial-ratios`
  const ratiosHtml = await ladeSeite(ratiosUrl)
  if (!ratiosHtml || ratiosHtml.includes('Oops!')) return null

  const roh = parseOriginalData(ratiosHtml)
  if (!roh?.length) return null

  const periodenIso = periodenAusRoh(roh)
  if (periodenIso.length === 0) return null

  const ltmIso = periodenIso[periodenIso.length - 1] ?? null
  const perioden = bauePerioden(periodenIso, ltmIso)

  const zeilen: FundamentalMetrikZeile[] = []

  for (const def of FINANCIAL_RATIOS_METRIKEN) {
    const row = zeileFuerSlug(roh, def.slug, def.aliases)
    if (!row) continue
    zeilen.push({
      id: def.id,
      label: def.label,
      gruppe: def.gruppe,
      einheit: def.einheit,
      werte: werteAusRoh(row, periodenIso),
      macrotrendsSlug: def.slug,
      macrotrendsStatement: 'financial-ratios',
    })
  }

  for (const def of BEWERTUNG_METRIKEN) {
    const iframeUrl = `${IFRAME_BASE}?t=${encodeURIComponent(ident.ticker)}&type=${encodeURIComponent(def.slug)}&statement=${def.statement}&freq=A&sub=&yb=15`
    const iframeHtml = await ladeSeite(iframeUrl)
    const chart = iframeHtml ? parseChartData(iframeHtml) : null
    zeilen.push({
      id: def.id,
      label: def.label,
      gruppe: def.gruppe,
      einheit: def.einheit,
      werte: chart
        ? werteAusChart(chart, periodenIso, def.wertFeld)
        : Object.fromEntries(periodenIso.map((p) => [p, null])),
      macrotrendsSlug: def.slug,
      macrotrendsStatement: 'price-ratios',
    })
  }

  const metaMatch = ratiosHtml.match(/<meta name="description" content="([^"]+)"/)
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
  statement: 'financial-ratios' | 'price-ratios',
): Promise<Array<{ datum: string; wert: number }>> {
  const iframeUrl = `${IFRAME_BASE}?t=${encodeURIComponent(ident.ticker)}&type=${encodeURIComponent(slug)}&statement=${statement}&freq=A&sub=&yb=15`
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

  if (statement === 'financial-ratios') {
    const url = `${BASE}/stocks/charts/${ident.ticker}/${ident.slug}/financial-ratios`
    const html = await ladeSeite(url)
    const roh = html ? parseOriginalData(html) : null
    const row = roh ? zeileFuerSlug(roh, slug) : null
    if (row) {
      return periodenAusRoh([row])
        .map((iso) => ({ datum: iso, wert: parseZahl(row[iso]) ?? 0 }))
        .filter((p) => p.wert !== 0)
    }
  }

  return []
}

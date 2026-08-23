/**
 * StockAnalysis — vollständige Jahres-Statements (IS / BS / CF).
 * Ergänzt Macrotrends/Yahoo um D&A, SG&A, R&D, OCF, CapEx, SBC und Bilanz für Beneish/Sloan.
 */

import 'server-only'

import { formatFundamentalPeriodeLabel } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import type { FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

const BASE = 'https://stockanalysis.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const CACHE_MS = 6 * 60 * 60 * 1000
const MIN_ABSTAND_MS = 200

const YAHOO_SUFFIX_TO_EXCHANGE: Record<string, string> = {
  PA: 'epa',
  AS: 'ams',
  DE: 'etr',
  L: 'lon',
  SW: 'swx',
  MI: 'mil',
  MC: 'bme',
  ST: 'sto',
  HE: 'etr',
  HM: 'ham',
  TO: 'tsx',
  V: 'vie',
}

const SA_QUOTE_BASE: Record<string, string> = {
  HLMA: '/quote/lon/HLMA',
  MUM: '/quote/etr/MUM',
  ATD: '/quote/tsx/ATD',
  SIKA: '/quote/swx/SIKA',
  WKL: '/quote/ams/WKL',
  STMN: '/quote/swx/STMN',
  RMS: '/quote/epa/RMS',
  ASML: '/quote/ams/ASML',
  HESAY: '/quote/otc/HESAY',
}

export type StockanalysisStatementsRoh = {
  perioden: FundamentalPeriode[]
  zeilen: FundamentalMetrikZeile[]
  quelle: 'stockanalysis'
  url: string
}

const cache = new Map<string, { at: number; daten: StockanalysisStatementsRoh | null }>()
let letzterAbruf = 0

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function throttle(): Promise<void> {
  const warten = MIN_ABSTAND_MS - (Date.now() - letzterAbruf)
  if (warten > 0) await pause(warten)
  letzterAbruf = Date.now()
}

async function fetchHtml(path: string): Promise<string | null> {
  await throttle()
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(18_000),
    })
    if (!res.ok) return null
    const html = await res.text()
    return html.length > 8_000 ? html : null
  } catch {
    return null
  }
}

function parseString(v: unknown): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return ''
}

function parseZahl(v: unknown): number | null {
  if (v == null || v === '' || v === '[PRO]') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function parseArrayLiteral(block: string, key: string): unknown[] | null {
  const marker = `${key}:`
  const idx = block.indexOf(marker)
  if (idx < 0) return null
  const start = block.indexOf('[', idx + marker.length - 1)
  if (start < 0) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < block.length; i++) {
    const ch = block[i]!
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
          return JSON.parse(block.slice(start, i + 1)) as unknown[]
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function parseArrayMitAliases(block: string, ...keys: string[]): unknown[] {
  for (const key of keys) {
    const hit = parseArrayLiteral(block, key)
    if (hit && hit.length > 0) return hit
  }
  return []
}

function extrahiereAnnualBlock(html: string): string | null {
  const idx = html.search(/fiscalYear:\s*\[/)
  if (idx < 0) return null
  if (/gp:\[|revenue:\[|assets:\[|ncfo:\[|equity:\[/.test(html.slice(idx, idx + 8_000))) {
    return html.slice(Math.max(0, idx - 20), Math.min(html.length, idx + 45_000))
  }
  return html.slice(idx, Math.min(html.length, idx + 45_000))
}

function zuMio(raw: number | null): number | null {
  if (raw == null || !Number.isFinite(raw)) return null
  return raw / 1_000_000
}

function baueZeile(
  id: string,
  label: string,
  gruppe: FundamentalMetrikZeile['gruppe'],
  periodenIso: string[],
  werteMap: Map<string, number>,
): FundamentalMetrikZeile | null {
  if (werteMap.size === 0) return null
  const werte: Record<string, number | null> = {}
  for (const iso of periodenIso) {
    const v = werteMap.get(iso)
    werte[iso] = v != null && Number.isFinite(v) ? v : null
  }
  if (!Object.values(werte).some((v) => v != null)) return null
  return {
    id,
    label,
    gruppe,
    einheit: 'waehrung_usd_mio',
    werte,
    macrotrendsStatement:
      gruppe === 'cashflow' ? 'cash-flow-statement' : gruppe === 'bilanz' ? 'balance-sheet' : 'income-statement',
  }
}

type SpaltenMeta = { jahre: number[]; dates: string[]; quarters: string[] }

function spaltenMeta(block: string): SpaltenMeta {
  const years = parseArrayMitAliases(block, 'fiscalYear')
    .map((y) => Number(parseString(y)))
    .filter((y) => Number.isFinite(y) && y > 2000)
  const dates = parseArrayMitAliases(block, 'datekey', 'dates').map((d) => parseString(d))
  const quarters = parseArrayMitAliases(block, 'fiscalQuarter').map((q) => parseString(q))
  return { jahre: years, dates, quarters }
}

function istZwischenbericht(q: string): boolean {
  const u = q.toUpperCase()
  return /^H1$|^Q[123]$/i.test(u)
}

function mappeSerie(
  meta: SpaltenMeta,
  values: unknown[],
  modus: 'raw' | 'abfluss' = 'raw',
): Map<string, number> {
  const out = new Map<string, number>()
  for (let i = 0; i < meta.jahre.length; i++) {
    if (istZwischenbericht(meta.quarters[i] ?? '')) continue
    const jahr = meta.jahre[i]!
    const raw = parseZahl(values[i])
    if (raw == null) continue
    // CapEx/Investitionen: Cash-Abfluss immer ≤ 0 (wie Macrotrends/Yahoo), nie abs().
    const usd = modus === 'abfluss' ? (raw > 0 ? -raw : raw) : raw
    const mio = zuMio(usd)
    if (mio == null) continue
    const iso =
      meta.dates[i]?.match(/^\d{4}-\d{2}-\d{2}$/) ? meta.dates[i]! : `${jahr}-12-31`
    // FY bevorzugen: größerer |Wert| bei Duplikaten
    const prev = out.get(iso)
    if (prev == null || Math.abs(mio) >= Math.abs(prev)) out.set(iso, mio)
  }
  return out
}

function parseIsBlock(block: string): FundamentalMetrikZeile[] {
  const meta = spaltenMeta(block)
  if (meta.jahre.length === 0) return []
  const sample = mappeSerie(meta, parseArrayMitAliases(block, 'revenue', 'gp', 'ebitda'))
  const isos = [...sample.keys()].sort()
  if (isos.length === 0) return []

  const zeilen = [
    baueZeile(
      'da',
      'Abschreibungen (D&A)',
      'finanzdaten',
      isos,
      mappeSerie(meta, parseArrayMitAliases(block, 'depAmorEbitda')),
    ),
    baueZeile(
      'sga',
      'SG&A (Vertrieb & Verwaltung)',
      'finanzdaten',
      isos,
      mappeSerie(meta, parseArrayMitAliases(block, 'sgna', 'sga')),
    ),
    baueZeile(
      'rd',
      'Forschung & Entwicklung (R&D)',
      'finanzdaten',
      isos,
      mappeSerie(meta, parseArrayMitAliases(block, 'rnd', 'rd', 'researchDevelopment')),
    ),
    baueZeile(
      'bruttogewinn',
      'Bruttogewinn',
      'finanzdaten',
      isos,
      mappeSerie(meta, parseArrayMitAliases(block, 'gp', 'grossProfit')),
    ),
    baueZeile(
      'ebitda',
      'EBITDA',
      'finanzdaten',
      isos,
      mappeSerie(meta, parseArrayMitAliases(block, 'ebitda')),
    ),
    baueZeile(
      'ebit',
      'EBIT',
      'finanzdaten',
      isos,
      mappeSerie(meta, parseArrayMitAliases(block, 'opinc', 'ebit', 'operatingIncome')),
    ),
  ]
  return zeilen.filter((z): z is FundamentalMetrikZeile => z != null)
}

function parseBsBlock(block: string): FundamentalMetrikZeile[] {
  const meta = spaltenMeta(block)
  if (meta.jahre.length === 0) return []
  const sample = mappeSerie(meta, parseArrayMitAliases(block, 'assets', 'equity'))
  const isos = [...sample.keys()].sort()
  if (isos.length === 0) {
    for (let i = 0; i < meta.jahre.length; i++) {
      if (!istZwischenbericht(meta.quarters[i] ?? '')) isos.push(`${meta.jahre[i]}-12-31`)
    }
  }

  const zeilen = [
    baueZeile(
      'forderungen',
      'Forderungen (netto)',
      'bilanz',
      isos,
      mappeSerie(meta, parseArrayMitAliases(block, 'receivables', 'accountsReceivable')),
    ),
    baueZeile(
      'vorraete',
      'Vorräte',
      'bilanz',
      isos,
      mappeSerie(meta, parseArrayMitAliases(block, 'inventory')),
    ),
    baueZeile(
      'bargeld',
      'Bargeld & Äquivalente',
      'bilanz',
      isos,
      mappeSerie(meta, parseArrayMitAliases(block, 'cashneq', 'totalcash', 'cashnshortterminvest')),
    ),
    baueZeile(
      'umlaufvermoegen',
      'Umlaufvermögen',
      'bilanz',
      isos,
      mappeSerie(meta, parseArrayMitAliases(block, 'assetsc', 'totalcurrentassets')),
    ),
    baueZeile(
      'gesamtvermoegen',
      'Gesamtvermögen',
      'bilanz',
      isos,
      mappeSerie(meta, parseArrayMitAliases(block, 'assets', 'totalassets')),
    ),
    baueZeile(
      'gesamtverschuldung',
      'Gesamtverschuldung',
      'bilanz',
      isos,
      mappeSerie(meta, parseArrayMitAliases(block, 'debt', 'totaldebt')),
    ),
    baueZeile(
      'eigenkapital',
      'Eigenkapital',
      'bilanz',
      isos,
      mappeSerie(meta, parseArrayMitAliases(block, 'equity', 'totalCommonEquity')),
    ),
    baueZeile(
      'goodwill',
      'Goodwill',
      'bilanz',
      isos,
      mappeSerie(meta, parseArrayMitAliases(block, 'goodwill')),
    ),
    baueZeile(
      'intangibles',
      'Immaterielle Vermögenswerte',
      'bilanz',
      isos,
      mappeSerie(meta, parseArrayMitAliases(block, 'otherIntangibles', 'intangibles')),
    ),
  ]
  return zeilen.filter((z): z is FundamentalMetrikZeile => z != null)
}

function parseCfBlock(block: string): FundamentalMetrikZeile[] {
  const meta = spaltenMeta(block)
  if (meta.jahre.length === 0) return []
  const sample = mappeSerie(meta, parseArrayMitAliases(block, 'ncfo', 'fcf'))
  const isos = [...sample.keys()].sort()

  const daCf = mappeSerie(meta, parseArrayMitAliases(block, 'totalDepAmorCF', 'depAmor', 'depamor'))
  const zeilen = [
    baueZeile('da', 'Abschreibungen (D&A)', 'cashflow', isos, daCf),
    baueZeile(
      'ocf',
      'Operativer Cashflow',
      'cashflow',
      isos,
      mappeSerie(meta, parseArrayMitAliases(block, 'ncfo', 'operatingCashFlow')),
    ),
    baueZeile(
      'capex',
      'CapEx (Investitionen)',
      'cashflow',
      isos,
      mappeSerie(meta, parseArrayMitAliases(block, 'capex'), 'abfluss'),
    ),
    baueZeile(
      'fcf',
      'Free Cashflow (FCF)',
      'cashflow',
      isos,
      mappeSerie(meta, parseArrayMitAliases(block, 'fcf', 'freeCashFlow')),
    ),
    baueZeile(
      'sbc',
      'Aktienbasierte Vergütung (SBC)',
      'cashflow',
      isos,
      mappeSerie(meta, parseArrayMitAliases(block, 'sbcomp', 'sbc')),
    ),
  ]
  return zeilen.filter((z): z is FundamentalMetrikZeile => z != null)
}

function mergeZeilen(teile: FundamentalMetrikZeile[][]): {
  perioden: FundamentalPeriode[]
  zeilen: FundamentalMetrikZeile[]
} {
  const byId = new Map<string, FundamentalMetrikZeile>()
  const isos = new Set<string>()
  for (const teil of teile) {
    for (const z of teil) {
      for (const iso of Object.keys(z.werte)) {
        if (z.werte[iso] != null) isos.add(iso)
      }
      const cur = byId.get(z.id)
      if (!cur) {
        byId.set(z.id, { ...z, werte: { ...z.werte } })
        continue
      }
      for (const [iso, v] of Object.entries(z.werte)) {
        if (v != null && cur.werte[iso] == null) cur.werte[iso] = v
      }
    }
  }
  const periodenIso = [...isos].sort()
  const perioden = periodenIso.map((iso) => ({
    iso,
    label: formatFundamentalPeriodeLabel(iso, 'jahr'),
  }))
  // Normalisiere auf gemeinsame Perioden
  const zeilen = [...byId.values()].map((z) => {
    const werte: Record<string, number | null> = {}
    for (const iso of periodenIso) werte[iso] = z.werte[iso] ?? null
    return { ...z, werte }
  })
  return { perioden, zeilen }
}

function basisPfade(opts: {
  symbolYahoo?: string | null
  ticker?: string | null
  isin?: string | null
}): string[] {
  const out: string[] = []
  const add = (p: string) => {
    if (p && !out.includes(p)) out.push(p)
  }
  const k = isinKenntnis(opts.isin?.trim().toUpperCase() ?? '')
  for (const key of [k?.logoSymbol, k?.macrotrendsTicker, opts.ticker]) {
    const sym = key?.trim().toUpperCase()
    if (sym && SA_QUOTE_BASE[sym]) add(SA_QUOTE_BASE[sym]!)
  }
  const sym = opts.symbolYahoo?.trim().toUpperCase() ?? ''
  if (sym.includes('.')) {
    const [base, suf] = sym.split('.')
    const ex = YAHOO_SUFFIX_TO_EXCHANGE[suf ?? '']
    if (ex && base) add(`/quote/${ex}/${base}`)
  } else if (sym) {
    add(`/stocks/${sym.toLowerCase()}`)
  }
  const ticker = opts.ticker?.trim().toUpperCase()
  if (ticker && !sym.includes(ticker)) add(`/stocks/${ticker.toLowerCase()}`)
  return out
}

export async function ladeStockanalysisStatementsRoh(opts: {
  symbolYahoo?: string | null
  ticker?: string | null
  firmenname?: string | null
  isin?: string | null
  refresh?: boolean
}): Promise<StockanalysisStatementsRoh | null> {
  const cacheKey = `${opts.isin ?? ''}|${opts.symbolYahoo ?? ''}|${opts.ticker ?? ''}`
  if (!opts.refresh) {
    const hit = cache.get(cacheKey)
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.daten
  }

  const basen = basisPfade(opts)
  for (const basis of basen) {
    const [isHtml, bsHtml, cfHtml] = await Promise.all([
      fetchHtml(`${basis}/financials/income-statement/`),
      fetchHtml(`${basis}/financials/balance-sheet/`),
      fetchHtml(`${basis}/financials/cash-flow-statement/`),
    ])
    const isBlock = isHtml ? extrahiereAnnualBlock(isHtml) : null
    const bsBlock = bsHtml ? extrahiereAnnualBlock(bsHtml) : null
    const cfBlock = cfHtml ? extrahiereAnnualBlock(cfHtml) : null
    const merged = mergeZeilen([
      isBlock ? parseIsBlock(isBlock) : [],
      bsBlock ? parseBsBlock(bsBlock) : [],
      cfBlock ? parseCfBlock(cfBlock) : [],
    ])
    if (merged.zeilen.length >= 3 && merged.perioden.length >= 2) {
      const daten: StockanalysisStatementsRoh = {
        ...merged,
        quelle: 'stockanalysis',
        url: `${BASE}${basis}/financials/`,
      }
      cache.set(cacheKey, { at: Date.now(), daten })
      return daten
    }
  }

  cache.set(cacheKey, { at: Date.now(), daten: null })
  return null
}

/** Snapshots für Incremental ROIC aus SA-Statements. */
export function snapsFuerIncrementalRoic(roh: StockanalysisStatementsRoh | null): Array<{
  jahr: number
  nopatMio: number
  icMio: number
  capexMio: number | null
  daMio: number | null
  goodwillMio: number | null
  intangiblesMio: number | null
}> {
  if (!roh) return []
  const ebit = roh.zeilen.find((z) => z.id === 'ebit')
  const equity = roh.zeilen.find((z) => z.id === 'eigenkapital')
  const debt = roh.zeilen.find((z) => z.id === 'gesamtverschuldung')
  const cash = roh.zeilen.find((z) => z.id === 'bargeld')
  const capex = roh.zeilen.find((z) => z.id === 'capex')
  const da = roh.zeilen.find((z) => z.id === 'da')
  const gw = roh.zeilen.find((z) => z.id === 'goodwill')
  const inta = roh.zeilen.find((z) => z.id === 'intangibles')
  const out: Array<{
    jahr: number
    nopatMio: number
    icMio: number
    capexMio: number | null
    daMio: number | null
    goodwillMio: number | null
    intangiblesMio: number | null
  }> = []
  for (const p of roh.perioden) {
    const jahr = parseInt(p.iso.slice(0, 4), 10)
    const oi = ebit?.werte[p.iso]
    const eq = equity?.werte[p.iso]
    if (oi == null || eq == null || !Number.isFinite(jahr)) continue
    const nopatMio = oi * 0.79
    const icMio = eq + (debt?.werte[p.iso] ?? 0) - (cash?.werte[p.iso] ?? 0)
    if (!Number.isFinite(nopatMio) || !Number.isFinite(icMio)) continue
    out.push({
      jahr,
      nopatMio,
      icMio,
      capexMio: capex?.werte[p.iso] ?? null,
      daMio: da?.werte[p.iso] ?? null,
      goodwillMio: gw?.werte[p.iso] ?? null,
      intangiblesMio: inta?.werte[p.iso] ?? null,
    })
  }
  return out.sort((a, b) => a.jahr - b.jahr)
}

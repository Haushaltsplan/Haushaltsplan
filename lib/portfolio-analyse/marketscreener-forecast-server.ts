import 'server-only'

import { fruehestesSchaetzJahr } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { marketscreenerSlugKandidaten } from '@/lib/portfolio-analyse/marketscreener-slug'

export type MarketscreenerJahresForecastEintrag = {
  jahr: number
  umsatzUsd: number | null
  netIncomeUsd: number | null
}

const BASE = 'https://www.marketscreener.com/quote/stock'
const CACHE_MS = 6 * 60 * 60 * 1000
const MIN_ABSTAND_MS = 140
function minSchaetzJahr(): number {
  return fruehestesSchaetzJahr()
}
const ZIEL_SCHAETZ_JAHR = 2028

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

let letzterAbruf = 0
const pageCache = new Map<string, { at: number; html: string | null }>()

export type MarketscreenerForecastJahresEintrag = MarketscreenerJahresForecastEintrag & {
  /** annual = Konsens-Jahrestabelle; quartal = Summe aus Schätzungsquartalen */
  herkunft: 'annual' | 'quartal'
  schaetzQuartale?: number
}

export type MarketscreenerForecastReihe = {
  quelle: 'marketscreener'
  jahresreihe: MarketscreenerForecastJahresEintrag[]
}

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function throttle(): Promise<void> {
  const warten = Math.max(0, MIN_ABSTAND_MS - (Date.now() - letzterAbruf))
  if (warten > 0) await pause(warten)
  letzterAbruf = Date.now()
}

async function fetchHtml(url: string, cacheKey: string): Promise<string | null> {
  const cached = pageCache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.html

  await throttle()
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(22_000),
    })
    if (!res.ok) {
      pageCache.set(cacheKey, { at: Date.now(), html: null })
      return null
    }
    const html = await res.text()
    pageCache.set(cacheKey, { at: Date.now(), html })
    return html
  } catch {
    pageCache.set(cacheKey, { at: Date.now(), html: null })
    return null
  }
}

function parseUsdZeile(rowHtml: string, maxCols: number): number[] {
  const vals: number[] = []
  const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
  for (const cell of cells.slice(1, maxCols + 1)) {
    const html = cell[1]
    const primary =
      html.match(
        /<span class="efd_(?:USD|EUR|GBP|CHF)\s*"[^>]*>[\s\S]*?<span title="([^"]+)">/,
      ) ??
      html.match(/<span class="efd_USD[^"]*"[^>]*>[\s\S]*?<span title="([^"]+)">/)
    if (!primary) continue
    const n = Number(primary[1].replace(/,/g, ''))
    if (Number.isFinite(n)) vals.push(n)
  }
  if (vals.length > 0) return vals.slice(0, maxCols)

  for (const m of rowHtml.matchAll(
    /<span class="efd_USD[^"]*"[^>]*>[\s\S]*?<span title="([^"]+)">/g,
  )) {
    const n = Number(m[1].replace(/,/g, ''))
    if (Number.isFinite(n)) vals.push(n)
  }
  return vals.slice(0, maxCols)
}

/** Filtert offensichtlich falsche MS-Werte (z. B. SPGI mit defekter USD-Spalte). */
export function marketscreenerUmsatzPlausibel(
  umsatzUsd: number | null,
  referenzUsd: number | null,
): boolean {
  if (umsatzUsd == null || umsatzUsd < 1e8) return false
  if (referenzUsd == null || referenzUsd < 1e9) return true
  const ratio = umsatzUsd / referenzUsd
  return ratio >= 0.25 && ratio <= 5
}

function parseKonsensTabelle(html: string): {
  headers: { jahr: number; schaetzung: boolean }[]
  zeilen: Record<string, number[]>
} | null {
  const rowStart = html.search(/<td[^>]*>\s*Net sales\s*<\/td>/i)
  if (rowStart < 0) return null

  const tableStart = html.lastIndexOf('<table', rowStart)
  const tableEnd = html.indexOf('</table>', rowStart)
  if (tableStart < 0 || tableEnd < 0) return null
  const table = html.slice(tableStart, tableEnd + 8)

  const thead = table.match(/<thead>[\s\S]*?<\/thead>/i)?.[0] ?? ''
  const headers: { jahr: number; schaetzung: boolean }[] = []
  for (const m of thead.matchAll(/>(\d{4})\s*(\*)?<\/th>/g)) {
    const jahr = Number(m[1])
    if (!Number.isFinite(jahr)) continue
    headers.push({ jahr, schaetzung: m[2] === '*' })
  }
  if (headers.length === 0) return null

  const zeilen: Record<string, number[]> = {}
  for (const label of ['Net sales', 'Net income']) {
    const pos = table.search(new RegExp(`<td[^>]*>\\s*${label}\\s*<\\/td>`, 'i'))
    if (pos < 0) continue
    const rowEnd = table.indexOf('</tr>', pos)
    const row = table.slice(pos, rowEnd > pos ? rowEnd : pos + 14_000)
    zeilen[label] = parseUsdZeile(row, headers.length)
  }

  if (!zeilen['Net sales']?.length) return null
  return { headers, zeilen }
}

function parseAnnualKonsens(html: string): MarketscreenerForecastJahresEintrag[] {
  const tab = parseKonsensTabelle(html)
  if (!tab) return []

  const umsatz = tab.zeilen['Net sales'] ?? []
  const netIncome = tab.zeilen['Net income'] ?? []
  const out: MarketscreenerForecastJahresEintrag[] = []

  for (let i = 0; i < tab.headers.length; i++) {
    const hdr = tab.headers[i]
    if (!hdr?.schaetzung || hdr.jahr < minSchaetzJahr()) continue
    const umsatzUsd = umsatz[i] ?? null
    const netIncomeUsd = netIncome[i] ?? null
    if (umsatzUsd == null && netIncomeUsd == null) continue
    if (umsatzUsd != null && umsatzUsd < 1e9) continue
    out.push({
      jahr: hdr.jahr,
      umsatzUsd,
      netIncomeUsd,
      herkunft: 'annual',
    })
  }
  return out
}

function istSchaetzungsZelle(classAttr: string, cellHtml: string): boolean {
  return (
    /estimate|txt-italic|txt-muted/i.test(classAttr) ||
    /class="[^"]*estimate/i.test(cellHtml)
  )
}

function parseMioZahl(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '')
  if (!t || t === '-' || t === '—') return null
  const n = Number(t.replace(/,/g, ''))
  return Number.isFinite(n) ? n * 1_000_000 : null
}

type QuartalsSpalte = { label: string; index: number; istSchaetzung: boolean }

function parseQuartalsTabelle(html: string): {
  spalten: QuartalsSpalte[]
  zeilen: Partial<Record<'umsatz' | 'net_income', Map<number, { wertUsd: number; quartale: number }>>>
} | null {
  const idx = html.indexOf('income-statement-quarterly')
  if (idx < 0) return null

  const block = html.slice(idx, idx + 450_000)
  const tableMatch = [...block.matchAll(/<table[\s\S]*?<\/table>/gi)].find((t) => /\d{4} Q\d/.test(t[0]))
  if (!tableMatch) return null
  const table = tableMatch[0]

  const spalten: QuartalsSpalte[] = []
  let colIdx = 0
  for (const m of table.matchAll(/<th([^>]*)>([\s\S]*?)<\/th>/gi)) {
    const label = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (!/\d{4} Q\d/.test(label)) continue
    spalten.push({
      label,
      index: colIdx,
      istSchaetzung: /estimate|italic|muted/i.test(m[1]),
    })
    colIdx++
  }
  if (spalten.length === 0) return null

  const metrikFuerLabel = (label: string): 'umsatz' | 'net_income' | null => {
    const l = label.trim()
    if (/^Net sales/i.test(l)) return 'umsatz'
    if (/^Net income/i.test(l)) return 'net_income'
    return null
  }

  const zeilen: Partial<Record<'umsatz' | 'net_income', Map<number, { wertUsd: number; quartale: number }>>> = {
    umsatz: new Map(),
    net_income: new Map(),
  }

  for (const tr of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = tr[1]
    if (!row.startsWith('<td')) continue

    const tds = [...row.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)]
    if (tds.length < 2) continue

    const rowLabel = tds[0][2].replace(/<sup[\s\S]*?<\/sup>/gi, '').replace(/<[^>]+>/g, '').trim()
    const metrik = metrikFuerLabel(rowLabel)
    if (!metrik) continue

    const byJahr = zeilen[metrik]!

    for (let i = 0; i < spalten.length; i++) {
      const spalte = spalten[i]!
      const td = tds[i + 1]
      if (!td) continue
      if (!istSchaetzungsZelle(td[1], td[2]) && !spalte.istSchaetzung) continue

      const m = /^(\d{4}) Q\d$/.exec(spalte.label)
      if (!m) continue
      const jahr = Number(m[1])
      if (!Number.isFinite(jahr) || jahr < minSchaetzJahr()) continue

      const wertUsd = parseMioZahl(td[2].replace(/<[^>]+>/g, '').trim())
      if (wertUsd == null) continue

      const cur = byJahr.get(jahr) ?? { wertUsd: 0, quartale: 0 }
      cur.wertUsd += wertUsd
      cur.quartale += 1
      byJahr.set(jahr, cur)
    }
  }

  const hatDaten = (zeilen.umsatz?.size ?? 0) > 0 || (zeilen.net_income?.size ?? 0) > 0
  if (!hatDaten) return null
  return { spalten, zeilen }
}

function parseQuartalsAggregation(html: string): MarketscreenerForecastJahresEintrag[] {
  const parsed = parseQuartalsTabelle(html)
  if (!parsed) return []

  const jahre = new Set<number>([
    ...(parsed.zeilen.umsatz?.keys() ?? []),
    ...(parsed.zeilen.net_income?.keys() ?? []),
  ])

  const out: MarketscreenerForecastJahresEintrag[] = []
  for (const jahr of [...jahre].sort((a, b) => a - b)) {
    const u = parsed.zeilen.umsatz?.get(jahr)
    const n = parsed.zeilen.net_income?.get(jahr)
    const quartale = Math.max(u?.quartale ?? 0, n?.quartale ?? 0)
    if (quartale < 4) continue

    const umsatzUsd = u?.wertUsd ?? null
    const netIncomeUsd = n?.wertUsd ?? null
    if (umsatzUsd == null && netIncomeUsd == null) continue
    if (umsatzUsd != null && umsatzUsd < 1e9) continue

    out.push({
      jahr,
      umsatzUsd,
      netIncomeUsd,
      herkunft: 'quartal',
      schaetzQuartale: quartale,
    })
  }
  return out
}

function mergeForecastReihe(
  annual: MarketscreenerForecastJahresEintrag[],
  quartal: MarketscreenerForecastJahresEintrag[],
): MarketscreenerForecastJahresEintrag[] {
  const byJahr = new Map<number, MarketscreenerForecastJahresEintrag>()

  for (const q of quartal) {
    byJahr.set(q.jahr, { ...q })
  }
  for (const a of annual) {
    const cur = byJahr.get(a.jahr) ?? {
      jahr: a.jahr,
      umsatzUsd: null,
      netIncomeUsd: null,
      herkunft: 'annual' as const,
    }
    if (a.umsatzUsd != null) cur.umsatzUsd = a.umsatzUsd
    if (a.netIncomeUsd != null) cur.netIncomeUsd = a.netIncomeUsd
    cur.herkunft = 'annual'
    byJahr.set(a.jahr, cur)
  }

  return [...byJahr.values()]
    .filter((e) => e.jahr >= minSchaetzJahr() && e.jahr <= ZIEL_SCHAETZ_JAHR + 2)
    .filter((e) => (e.umsatzUsd != null && e.umsatzUsd >= 1e9) || e.netIncomeUsd != null)
    .sort((a, b) => a.jahr - b.jahr)
}

/**
 * Marketscreener-Schätzungen: Jahres-Konsens (finances-consensus) +
 * Quartals-Aggregation (finances, nur Jahre mit 4 Schätzungsquartalen).
 * Liefert typischerweise FY2026–FY2028 (abhängig vom Titel).
 */
export async function ladeMarketscreenerForecastReihe(
  isin: string,
  name: string,
  symbolYahoo?: string | null,
): Promise<MarketscreenerForecastReihe | null> {
  for (const slug of marketscreenerSlugKandidaten(isin, name, symbolYahoo)) {
    const slugVariants = [slug, slug.replace(/-CORP-/, '-CORPORATION-')]

    let annual: MarketscreenerForecastJahresEintrag[] = []
    let quartal: MarketscreenerForecastJahresEintrag[] = []

    for (const s of slugVariants) {
      const consensusHtml = await fetchHtml(`${BASE}/${s}/finances-consensus/`, `consensus:${s}`)
      if (consensusHtml?.includes('Net sales')) {
        annual = parseAnnualKonsens(consensusHtml)
      }

      const financesHtml = await fetchHtml(`${BASE}/${s}/finances/`, `finances:${s}`)
      if (financesHtml?.includes('income-statement-quarterly')) {
        quartal = parseQuartalsAggregation(financesHtml)
      }

      if (annual.length > 0 || quartal.length > 0) break
    }

    const jahresreihe = mergeForecastReihe(annual, quartal)
    if (jahresreihe.length === 0) continue

    return { quelle: 'marketscreener', jahresreihe }
  }
  return null
}

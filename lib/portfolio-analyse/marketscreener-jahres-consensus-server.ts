import { formatEpsUsd, formatKompaktUsd } from '@/lib/portfolio-analyse/earnings-quartals-prognose'
import type { JahresEarningsSchaetzung } from '@/lib/portfolio-analyse/jahres-earnings-schaetzung'
import { ladeMarketscreenerForecastReihe } from '@/lib/portfolio-analyse/marketscreener-forecast-server'
import type { MarketscreenerJahresForecastEintrag } from '@/lib/portfolio-analyse/marketscreener-forecast-server'
import { marketscreenerSlugKandidaten } from '@/lib/portfolio-analyse/marketscreener-slug'
import { ladeStockanalysisJahresForecast } from '@/lib/portfolio-analyse/stockanalysis-forecast-server'
import { wachstumProzent, formatWachstumProzent } from '@/lib/portfolio-analyse/earnings-kennzahlen'

const BASE = 'https://www.marketscreener.com/quote/stock'
const CACHE_MS = 6 * 60 * 60 * 1000
const MIN_ABSTAND_MS = 140

let letzterAbruf = 0
const pageCache = new Map<string, { at: number; html: string | null }>()

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function parseUsdZeile(rowHtml: string, maxCols: number): number[] {
  const vals: number[] = []
  for (const m of rowHtml.matchAll(
    /<span class="efd_USD[^"]*"[^>]*>[\s\S]*?<span title="([^"]+)">/g,
  )) {
    const n = Number(m[1].replace(/,/g, ''))
    if (Number.isFinite(n)) vals.push(n)
  }
  return vals.slice(0, maxCols)
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
    const row = table.slice(pos, rowEnd > pos ? rowEnd : pos + 12_000)
    zeilen[label] = parseUsdZeile(row, headers.length)
  }

  if (!zeilen['Net sales']?.length) return null
  return { headers, zeilen }
}

export type { MarketscreenerJahresForecastEintrag } from '@/lib/portfolio-analyse/marketscreener-forecast-server'

export type MarketscreenerJahresForecast = {
  quelle: 'marketscreener'
  fy0Jahr: number | null
  fy1Jahr: number | null
  umsatzUsdFy0: number | null
  umsatzUsdFy1: number | null
  umsatzBasisUsd: number | null
  umsatzWachstumFy0Pct: number | null
  umsatzWachstumFy1Pct: number | null
  /** Alle Schätzungs-Spalten der Konsens-Tabelle (oft FY+2 / FY+3). */
  jahresreihe: MarketscreenerJahresForecastEintrag[]
}

function parseJahresKonsensVoll(html: string): MarketscreenerJahresForecast | null {
  const tab = parseKonsensTabelle(html)
  if (!tab) return null

  const estIdx = tab.headers.map((h, i) => (h.schaetzung ? i : -1)).filter((i) => i >= 0)
  if (estIdx.length === 0) return null

  const umsatz = tab.zeilen['Net sales'] ?? []
  const netIncome = tab.zeilen['Net income'] ?? []
  const fy0Idx = estIdx[0]!
  const fy1Idx = estIdx[1]
  const umsatzUsdFy0 = umsatz[fy0Idx] ?? null
  const umsatzUsdFy1 = fy1Idx != null ? (umsatz[fy1Idx] ?? null) : null
  if (umsatzUsdFy0 == null || umsatzUsdFy0 < 1e8) return null

  const basisIdx = fy0Idx > 0 ? fy0Idx - 1 : -1
  const umsatzBasisUsd = basisIdx >= 0 ? (umsatz[basisIdx] ?? null) : null
  const basisFy1 = fy1Idx != null && fy1Idx > 0 ? (umsatz[fy1Idx - 1] ?? null) : null

  const jahresreihe: MarketscreenerJahresForecastEintrag[] = estIdx.map((i) => ({
    jahr: tab.headers[i]?.jahr ?? 0,
    umsatzUsd: umsatz[i] ?? null,
    netIncomeUsd: netIncome[i] ?? null,
    operatingIncomeUsd: null,
    ebitdaUsd: null,
  })).filter((e) => e.jahr > 2000 && (e.umsatzUsd != null || e.netIncomeUsd != null))

  return {
    quelle: 'marketscreener',
    fy0Jahr: tab.headers[fy0Idx]?.jahr ?? null,
    fy1Jahr: fy1Idx != null ? (tab.headers[fy1Idx]?.jahr ?? null) : null,
    umsatzUsdFy0,
    umsatzUsdFy1,
    umsatzBasisUsd,
    umsatzWachstumFy0Pct: wachstumProzent(umsatzUsdFy0, umsatzBasisUsd),
    umsatzWachstumFy1Pct:
      umsatzUsdFy1 != null && basisFy1 != null ? wachstumProzent(umsatzUsdFy1, umsatzUsdFy0) : null,
    jahresreihe,
  }
}

function parseJahresKonsens(html: string): {
  jahrSchaetzung: number
  jahrBasis: number
  umsatzEst: number
  umsatzBasis: number | null
} | null {
  const voll = parseJahresKonsensVoll(html)
  if (!voll?.fy0Jahr || voll.umsatzUsdFy0 == null) return null
  return {
    jahrSchaetzung: voll.fy0Jahr,
    jahrBasis: voll.fy0Jahr - 1,
    umsatzEst: voll.umsatzUsdFy0,
    umsatzBasis: voll.umsatzBasisUsd,
  }
}

/** FY0/FY1-Umsatz-Konsens von Marketscreener finances-consensus + Quartals-Aggregation. */
export async function ladeMarketscreenerJahresForecast(
  isin: string,
  name: string,
  symbolYahoo?: string | null,
): Promise<MarketscreenerJahresForecast | null> {
  const forecast = await ladeMarketscreenerForecastReihe(isin, name, symbolYahoo)
  if (!forecast || forecast.jahresreihe.length === 0) return null

  const jahresreihe = forecast.jahresreihe.map(
    ({ jahr, umsatzUsd, netIncomeUsd, operatingIncomeUsd }) => ({
      jahr,
      umsatzUsd,
      netIncomeUsd,
      operatingIncomeUsd: operatingIncomeUsd ?? null,
      ebitdaUsd: null,
    }),
  )

  const fy0 = jahresreihe[0]
  const fy1 = jahresreihe[1]
  const umsatzUsdFy0 = fy0?.umsatzUsd ?? null
  const umsatzUsdFy1 = fy1?.umsatzUsd ?? null

  if (umsatzUsdFy0 == null || umsatzUsdFy0 < 1e8) return null

  return {
    quelle: 'marketscreener',
    fy0Jahr: fy0?.jahr ?? null,
    fy1Jahr: fy1?.jahr ?? null,
    umsatzUsdFy0,
    umsatzUsdFy1,
    umsatzBasisUsd: null,
    umsatzWachstumFy0Pct: null,
    umsatzWachstumFy1Pct:
      umsatzUsdFy0 != null && umsatzUsdFy1 != null
        ? wachstumProzent(umsatzUsdFy1, umsatzUsdFy0)
        : null,
    jahresreihe,
  }
}

async function fetchConsensusHtml(slug: string): Promise<string | null> {
  const cached = pageCache.get(slug)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.html

  const now = Date.now()
  const warten = Math.max(0, MIN_ABSTAND_MS - (now - letzterAbruf))
  if (warten > 0) await pause(warten)
  letzterAbruf = Date.now()

  const urls = [
    `${BASE}/${slug}/finances-consensus/`,
    `${BASE}/${slug.replace(/-CORP-/, '-CORPORATION-')}/finances-consensus/`,
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) continue
      const html = await res.text()
      if (html.length > 80_000 && html.includes('Net sales')) {
        pageCache.set(slug, { at: Date.now(), html })
        return html
      }
    } catch {
      continue
    }
  }
  pageCache.set(slug, { at: Date.now(), html: null })
  return null
}

/** Jahres-Umsatz-Konsens von Marketscreener (nur wenn sauber parsebar). */
export async function ladeMarketscreenerJahresUmsatz(
  isin: string,
  name: string,
  symbolYahoo?: string | null,
): Promise<Pick<JahresEarningsSchaetzung, 'jahrLabel' | 'vorjahrLabel' | 'waehrung' | 'umsatz'> | null> {
  for (const slug of marketscreenerSlugKandidaten(isin, name, symbolYahoo)) {
    const html = await fetchConsensusHtml(slug)
    if (!html) continue
    const parsed = parseJahresKonsens(html)
    if (!parsed) continue

    const w = wachstumProzent(parsed.umsatzEst, parsed.umsatzBasis)
    return {
      jahrLabel: `Geschäftsjahr ${parsed.jahrSchaetzung}e`,
      vorjahrLabel: `Geschäftsjahr ${parsed.jahrBasis}`,
      waehrung: 'USD',
      umsatz: {
        schaetzung: parsed.umsatzEst,
        schaetzungAnzeige: formatKompaktUsd(parsed.umsatzEst),
        vorjahr: parsed.umsatzBasis,
        vorjahrAnzeige: parsed.umsatzBasis != null ? formatKompaktUsd(parsed.umsatzBasis) : null,
        wachstumAnzeige: formatWachstumProzent(w),
      },
    }
  }
  return null
}

/** EPS aus Wallstreet-Jahrestabelle (nur EPS, kein Umsatz). */
export function jahresEpsAusWallstreet(
  ws: { jahr?: number | null; kennzahlen: { schluessel: string; spanne: { average: number | null; averageAnzeige: string | null }; vorjahrWert: number | null; vorjahrAnzeige: string | null; wachstumAnzeige: string | null }[] } | null,
  waehrung: string,
): JahresEarningsSchaetzung['eps'] | null {
  if (!ws) return null
  const epsK = ws.kennzahlen.find((k) => k.schluessel === 'eps')
  if (!epsK?.spanne.average) return null
  return {
    schaetzung: epsK.spanne.average,
    schaetzungAnzeige: epsK.spanne.averageAnzeige ?? formatEpsUsd(epsK.spanne.average),
    vorjahr: epsK.vorjahrWert,
    vorjahrAnzeige: epsK.vorjahrAnzeige,
    wachstumAnzeige: epsK.wachstumAnzeige,
  }
}

export async function ladeJahresSchaetzungKombiniert(
  isin: string,
  name: string,
  symbolYahoo: string | null,
  wallstreet: Parameters<typeof jahresEpsAusWallstreet>[0],
): Promise<JahresEarningsSchaetzung | null> {
  const [msUmsatz, stockanalysis] = await Promise.all([
    ladeMarketscreenerJahresUmsatz(isin, name, symbolYahoo),
    ladeStockanalysisJahresForecast({
      symbolYahoo,
      firmenname: name,
      isin,
    }),
  ])
  const eps =
    stockanalysis?.epsFy0 != null
      ? {
          schaetzung: stockanalysis.epsFy0,
          schaetzungAnzeige: formatEpsUsd(stockanalysis.epsFy0),
          vorjahr: null,
          vorjahrAnzeige: null,
          wachstumAnzeige:
            stockanalysis.epsWachstumFy0Pct != null
              ? formatWachstumProzent(stockanalysis.epsWachstumFy0Pct)
              : null,
        }
      : jahresEpsAusWallstreet(wallstreet, msUmsatz?.waehrung ?? 'USD')

  const umsatzAusSa =
    stockanalysis?.umsatzUsdFy0 != null && stockanalysis.umsatzUsdFy0 >= 1e8
      ? {
          schaetzung: stockanalysis.umsatzUsdFy0,
          schaetzungAnzeige: formatKompaktUsd(stockanalysis.umsatzUsdFy0),
          vorjahr: null,
          vorjahrAnzeige: null,
          wachstumAnzeige:
            stockanalysis.umsatzWachstumFy0Pct != null
              ? formatWachstumProzent(stockanalysis.umsatzWachstumFy0Pct)
              : null,
        }
      : null

  const hatUmsatz =
    (msUmsatz?.umsatz.schaetzung != null && msUmsatz.umsatz.schaetzung >= 1e8) ||
    umsatzAusSa != null
  const hatEps = eps?.schaetzung != null
  if (!hatUmsatz && !hatEps) return null

  return {
    jahrLabel:
      msUmsatz?.jahrLabel ??
      (stockanalysis?.fy0Jahr ? `Geschäftsjahr ${stockanalysis.fy0Jahr}e` : null) ??
      (wallstreet?.jahr ? `Geschäftsjahr ${wallstreet.jahr}e` : 'Geschäftsjahr'),
    vorjahrLabel: msUmsatz?.vorjahrLabel ?? null,
    waehrung: msUmsatz?.waehrung ?? 'USD',
    umsatz: hatUmsatz
      ? (umsatzAusSa ?? msUmsatz!.umsatz)
      : {
          schaetzung: null,
          schaetzungAnzeige: null,
          vorjahr: null,
          vorjahrAnzeige: null,
          wachstumAnzeige: null,
        },
    eps: eps ?? {
      schaetzung: null,
      schaetzungAnzeige: null,
      vorjahr: null,
      vorjahrAnzeige: null,
      wachstumAnzeige: null,
    },
  }
}

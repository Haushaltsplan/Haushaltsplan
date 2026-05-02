import type { InvestmentMoverKarteDaten } from '@/components/investment-mover-karte'
import { PORTFOLIO_POSITIONEN } from '@/lib/investment-portfolio-data'

/** Yahoo blockiert oft `/v7/finance/quote` mit 401; `/v7/finance/spark` bleibt zuverlässig (wie S&P-Movers). */
const YAHOO_SPARK_BATCH = 20

const YAHOO_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Referer: 'https://finance.yahoo.com/',
  Accept: 'application/json',
} as const

type YahooSparkMeta = {
  regularMarketPrice?: number
  regularMarketTime?: number
  previousClose?: number
  chartPreviousClose?: number
}

function teileArray<T>(arr: T[], groesse: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += groesse) out.push(arr.slice(i, i + groesse))
  return out
}

function yahooZeitAlsUnixSekunden(t: number | undefined): number | null {
  if (t == null || !Number.isFinite(t)) return null
  if (t > 1e12) return Math.floor(t / 1000)
  return Math.floor(t)
}

function prozentVonSchlusskursZuPreis(preis: number, vorherigerSchluss: number): number | null {
  if (!Number.isFinite(preis) || !Number.isFinite(vorherigerSchluss) || vorherigerSchluss === 0) return null
  return Math.round(((preis - vorherigerSchluss) / vorherigerSchluss) * 10_000) / 100
}

async function ladeYahooSpark(symbole: string[]): Promise<Map<string, { pct: number | null; preis: number | null; zeitUnix: number | null }>> {
  const sym = [...new Set(symbole.map((s) => s.trim()).filter(Boolean))]
  const out = new Map<string, { pct: number | null; preis: number | null; zeitUnix: number | null }>()
  const batches = teileArray(sym, YAHOO_SPARK_BATCH)
  for (const batch of batches) {
    const u = new URL('https://query1.finance.yahoo.com/v7/finance/spark')
    u.searchParams.set('symbols', batch.join(','))
    const res = await fetch(u.toString(), {
      next: { revalidate: 120 },
      headers: YAHOO_FETCH_HEADERS,
    })
    if (!res.ok) continue
    const j = (await res.json()) as {
      spark?: { result?: Array<{ symbol?: string; response?: Array<{ meta?: YahooSparkMeta }> }> }
    }
    for (const zeile of j.spark?.result ?? []) {
      const ySym = zeile.symbol?.trim()
      const meta = zeile.response?.[0]?.meta
      if (!ySym || !meta) continue
      const preis = meta.regularMarketPrice
      const vorSchluss = meta.previousClose ?? meta.chartPreviousClose
      const pct =
        preis != null && vorSchluss != null ? prozentVonSchlusskursZuPreis(Number(preis), Number(vorSchluss)) : null
      const preisN = preis != null && Number.isFinite(Number(preis)) ? Number(preis) : null
      out.set(ySym.toUpperCase(), {
        pct,
        preis: preisN,
        zeitUnix: yahooZeitAlsUnixSekunden(meta.regularMarketTime),
      })
    }
  }
  return out
}

/** Yahoo kann Symbol-Schreibweise leicht variieren — mehrere Schlüssel versuchen. */
function quoteFuerSymbol(
  map: Map<string, { pct: number | null; preis: number | null; zeitUnix: number | null }>,
  symbolYahoo: string,
): { pct: number | null; preis: number | null; zeitUnix: number | null } | undefined {
  const roh = symbolYahoo.trim()
  const kandidaten = [
    roh.toUpperCase(),
    roh.replace(/\./g, '-').toUpperCase(),
    roh.replace(/-/g, '.').toUpperCase(),
  ]
  for (const k of kandidaten) {
    const hit = map.get(k)
    if (hit) return hit
  }
  return undefined
}

export type PortfolioKurseBericht = {
  sessionLabel: string
  positionen: InvestmentMoverKarteDaten[]
  fehler: string | null
}

export async function ladePortfolioKurseBericht(): Promise<PortfolioKurseBericht> {
  try {
    const symbole = PORTFOLIO_POSITIONEN.map((p) => p.symbolYahoo)
    const map = await ladeYahooSpark(symbole)

    let maxZeit: number | null = null
    const positionen: InvestmentMoverKarteDaten[] = PORTFOLIO_POSITIONEN.map((p) => {
      const q = quoteFuerSymbol(map, p.symbolYahoo)
      if (q?.zeitUnix != null && Number.isFinite(q.zeitUnix)) {
        maxZeit = maxZeit == null ? q.zeitUnix : Math.max(maxZeit, q.zeitUnix)
      }
      return {
        symbol: p.symbolYahoo,
        name: p.name,
        brancheAnzeige: null,
        aenderungProzent: q?.pct ?? null,
        kurs: q?.preis ?? null,
        notierung: p.notierung,
      }
    })

    positionen.sort((a, b) => a.name.localeCompare(b.name, 'de'))

    let sessionLabel = 'Letzte reguläre US-/Heimatbörse lt. Yahoo Finance'
    if (maxZeit != null) {
      try {
        const d = new Date(maxZeit * 1000)
        const ny = d.toLocaleString('de-DE', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })
        const de = d.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'medium', timeStyle: 'short' })
        sessionLabel = `Kursstände bis ca. ${ny} (New York) · ${de} (Deutschland)`
      } catch {
        /* ignore */
      }
    }

    const ohneKurs = positionen.filter((x) => x.kurs == null && x.aenderungProzent == null).length
    const fehler =
      ohneKurs > 0 ? `${ohneKurs} Position(en): keine Spark-Daten — Symbol prüfen oder später erneut laden.` : null

    return { sessionLabel, positionen, fehler }
  } catch (e) {
    return {
      sessionLabel: '—',
      positionen: PORTFOLIO_POSITIONEN.map((p) => ({
        symbol: p.symbolYahoo,
        name: p.name,
        brancheAnzeige: null,
        aenderungProzent: null,
        kurs: null,
        notierung: p.notierung,
      })).sort((a, b) => a.name.localeCompare(b.name, 'de')),
      fehler: e instanceof Error ? e.message : 'Portfolio-Kurse nicht erreichbar',
    }
  }
}


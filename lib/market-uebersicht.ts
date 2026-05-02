/** Kurs-Snapshot für Spar-Anzeige (Yahoo Spark), ohne Aktien-Movers-Logik. */

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

export type MarktKennzahl = {
  /** Yahoo-Symbol z. B. ^GSPC */
  symbolYahoo: string
  /** Kurzlabel für UI */
  kurzlabel: string
  /** Ausführlicher Titel */
  titel: string
  /** Aktueller Stand */
  wert: number | null
  /** Tagesveränderung ggü. Vorborsschluss, % */
  aenderungProzent: number | null
  /** Unix-Sekunden der Kurszeit */
  zeitUnix: number | null
}

export type MarktUebersicht = {
  zeilen: MarktKennzahl[]
  fehler: string | null
}

function prozentVonSchlusskursZuPreis(preis: number, vorherigerSchluss: number): number | null {
  if (!Number.isFinite(preis) || !Number.isFinite(vorherigerSchluss) || vorherigerSchluss === 0) return null
  return Math.round(((preis - vorherigerSchluss) / vorherigerSchluss) * 10_000) / 100
}

function yahooZeitAlsUnixSekunden(t: number | undefined): number | null {
  if (t == null || !Number.isFinite(t)) return null
  if (t > 1e12) return Math.floor(t / 1000)
  return Math.floor(t)
}

async function ladeYahooSparkEinmal(symbols: string[]): Promise<Map<string, { preis: number; pct: number; zeit: number | null }>> {
  const u = new URL('https://query1.finance.yahoo.com/v7/finance/spark')
  u.searchParams.set('symbols', symbols.join(','))
  const res = await fetch(u.toString(), {
    next: { revalidate: 180 },
    headers: YAHOO_FETCH_HEADERS,
  })
  if (!res.ok) throw new Error(`Yahoo Finance: HTTP ${res.status}`)
  const j = (await res.json()) as {
    spark?: {
      result?: Array<{ symbol?: string; response?: Array<{ meta?: YahooSparkMeta }> }>
    }
  }
  const out = new Map<string, { preis: number; pct: number; zeit: number | null }>()
  for (const zeile of j.spark?.result ?? []) {
    const ySym = zeile.symbol?.trim()
    const meta = zeile.response?.[0]?.meta
    if (!ySym || !meta) continue
    const preis = meta.regularMarketPrice
    const vorSchluss = meta.previousClose ?? meta.chartPreviousClose
    const pct =
      preis != null && vorSchluss != null ? prozentVonSchlusskursZuPreis(Number(preis), Number(vorSchluss)) : null
    if (pct == null || !Number.isFinite(pct) || preis == null || !Number.isFinite(Number(preis))) continue
    out.set(ySym, {
      preis: Number(preis),
      pct,
      zeit: yahooZeitAlsUnixSekunden(meta.regularMarketTime),
    })
  }
  return out
}

const MACRO_DEFS: Array<{ symbolYahoo: string; kurzlabel: string; titel: string }> = [
  { symbolYahoo: '^GSPC', kurzlabel: 'S&P 500', titel: 'S&P 500 Index' },
  { symbolYahoo: 'EURUSD=X', kurzlabel: 'EUR / USD', titel: 'Euro zu US-Dollar' },
  { symbolYahoo: '^VIX', kurzlabel: 'VIX', titel: 'CBOE Volatility Index' },
]

export async function ladeMarktUebersicht(): Promise<MarktUebersicht> {
  try {
    const sym = MACRO_DEFS.map((d) => d.symbolYahoo)
    const map = await ladeYahooSparkEinmal(sym)
    const zeilen: MarktKennzahl[] = MACRO_DEFS.map((d) => {
      const row = map.get(d.symbolYahoo)
      return {
        symbolYahoo: d.symbolYahoo,
        kurzlabel: d.kurzlabel,
        titel: d.titel,
        wert: row?.preis ?? null,
        aenderungProzent: row?.pct ?? null,
        zeitUnix: row?.zeit ?? null,
      }
    })
    return { zeilen, fehler: null }
  } catch (e) {
    return {
      zeilen: MACRO_DEFS.map((d) => ({
        symbolYahoo: d.symbolYahoo,
        kurzlabel: d.kurzlabel,
        titel: d.titel,
        wert: null,
        aenderungProzent: null,
        zeitUnix: null,
      })),
      fehler: e instanceof Error ? e.message : 'Marktdaten konnten nicht geladen werden.',
    }
  }
}

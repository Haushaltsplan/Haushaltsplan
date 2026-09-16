import 'server-only'

import {
  fuellePreisLoecher,
  renditenAusPreisen,
  saisonAusRenditen,
  wahlZyklusAusRenditen,
  type KursPunkt,
} from '@/lib/portfolio-analyse/boersen-saison-logik'
import type { BoersenSaisonIndex, BoersenSaisonPaket } from '@/lib/portfolio-analyse/boersen-saison-types'

export type { BoersenSaisonPaket }

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const FETCH_TIMEOUT_MS = 7_000
const CACHE_MS = 6 * 60 * 60 * 1000

let paketCache: { at: number; paket: BoersenSaisonPaket } | null = null

async function fetchMitTimeout(url: string, init: RequestInit = {}): Promise<Response | null> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, cache: 'no-store', signal: ac.signal })
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

const INDEX_LIST = [
  {
    id: 'sp500',
    name: 'S&P 500',
    symbolYahoo: '^GSPC',
    yahooAlt: null as string | null,
    macrotrendsId: '2324',
    shiller: true,
    fredId: null as string | null,
    startYear: 1871,
    hinweis: 'Kursindex ohne Dividenden, inkl. Vorläuferindex als Monatsschnitt nach Shiller ab 1871.',
  },
  {
    id: 'dow',
    name: 'Dow Jones',
    symbolYahoo: 'DJI',
    yahooAlt: '^DJI',
    macrotrendsId: '1319',
    shiller: false,
    fredId: 'M1109BUSM293NNBR',
    startYear: 1914,
    hinweis:
      'Dow Jones Industrial Average als Kursindex. Durchgehende Reihe ab Wiederaufnahme nach der WWI-Pause (Dez. 1914).',
  },
  {
    id: 'nasdaq',
    name: 'Nasdaq',
    symbolYahoo: '^IXIC',
    yahooAlt: null,
    macrotrendsId: '1320',
    shiller: false,
    fredId: 'NASDAQCOM',
    startYear: 1971,
    hinweis: 'Nasdaq Composite seit Auflage 1971 (nicht der Nasdaq-100).',
  },
  {
    id: 'dax',
    name: 'DAX',
    symbolYahoo: '^GDAXI',
    yahooAlt: null,
    macrotrendsId: null as string | null,
    shiller: false,
    fredId: null,
    startYear: 1987,
    hinweis: 'Deutscher Leitindex als Performanceindex (Dividenden im Stand enthalten), ab 1988/87.',
  },
] as const

type YahooChartJson = {
  chart?: {
    result?: Array<{
      timestamp?: number[]
      indicators?: {
        quote?: Array<{ close?: (number | null)[] }>
        adjclose?: Array<{ adjclose?: (number | null)[] }>
      }
    }>
  }
}

function ohneLaufendenMonat(punkte: KursPunkt[]): KursPunkt[] {
  const jetzt = new Date()
  const ym = `${jetzt.getUTCFullYear()}-${String(jetzt.getUTCMonth() + 1).padStart(2, '0')}`
  return punkte.filter((p) => !p.datum.startsWith(ym))
}

function unixVonJahr(jahr: number): number {
  return Math.floor(Date.UTC(jahr, 0, 1) / 1000)
}

function datumAusUnix(ts: number): string | null {
  if (!Number.isFinite(ts)) return null
  const d = new Date(ts * 1000)
  if (!Number.isFinite(d.getTime())) return null
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`
}

async function yahooChart(
  symbol: string,
  interval: '1mo' | '1d',
  period1: number,
  period2: number,
): Promise<KursPunkt[]> {
  const u = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`)
  u.searchParams.set('interval', interval)
  u.searchParams.set('period1', String(period1))
  u.searchParams.set('period2', String(period2))
  u.searchParams.set('events', 'div,split')

  const headers = {
    'User-Agent': USER_AGENT,
    Referer: 'https://finance.yahoo.com/',
    Accept: 'application/json',
  } as const
  const parse = async (host: string): Promise<KursPunkt[]> => {
    const url = u.toString().replace('query1.finance.yahoo.com', host)
    const res = await fetchMitTimeout(url, { headers })
    if (!res?.ok) return []
    const j = (await res.json()) as YahooChartJson
    const result = j.chart?.result?.[0]
    if (!result?.timestamp?.length) return []
    const closes =
      result.indicators?.adjclose?.[0]?.adjclose ?? result.indicators?.quote?.[0]?.close ?? []
    const out: KursPunkt[] = []
    for (let i = 0; i < result.timestamp.length; i++) {
      const ts = result.timestamp[i]
      const c = closes[i]
      if (ts == null || c == null || !Number.isFinite(c) || c <= 0) continue
      const datum = datumAusUnix(ts)
      if (!datum) continue
      out.push({ datum, kurs: Math.round(c * 10000) / 10000 })
    }
    return out
  }

  const [a, b] = await Promise.all([
    parse('query1.finance.yahoo.com'),
    parse('query2.finance.yahoo.com'),
  ])
  return a.length >= b.length ? a : b
}

/** Ein Request reicht: Yahoo-Monatsdaten sind ab ~1985 ~500 Punkte, darunter greifen Shiller/Macrotrends. */
async function ladeYahooMonatlich(symbol: string, startYear: number): Promise<KursPunkt[]> {
  const jetzt = Math.floor(Date.now() / 1000)
  return yahooChart(symbol, '1mo', unixVonJahr(Math.max(startYear, 1985)), jetzt)
}

async function ladeMacrotrendsMonatlich(pageId: string): Promise<KursPunkt[]> {
  try {
    const res = await fetchMitTimeout(`https://www.macrotrends.net/economic-data/${pageId}/M`, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: 'https://www.macrotrends.net/',
        Accept: 'application/json',
      },
    })
    if (!res?.ok) return []
    const j = (await res.json()) as { data?: Array<[number, number]> }
    if (!Array.isArray(j.data) || j.data.length < 24) return []
    const out: KursPunkt[] = []
    for (const row of j.data) {
      const ts = row?.[0]
      const v = row?.[1]
      if (ts == null || v == null || !Number.isFinite(ts) || !Number.isFinite(v) || v <= 0) continue
      const d = new Date(ts)
      if (!Number.isFinite(d.getTime())) continue
      const datum = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
        d.getUTCDate(),
      ).padStart(2, '0')}`
      out.push({ datum, kurs: Math.round(v * 10000) / 10000 })
    }
    return out
  } catch {
    return []
  }
}

async function ladeShillerSp500(): Promise<KursPunkt[]> {
  try {
    const res = await fetchMitTimeout('https://raw.githubusercontent.com/datasets/s-and-p-500/master/data/data.csv', {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/csv,*/*' },
    })
    if (!res?.ok) return []
    const text = await res.text()
    const lines = text.split(/\r?\n/)
    const out: KursPunkt[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i]!.split(',')
      const datumRoh = (cols[0] ?? '').trim()
      const kurs = Number.parseFloat((cols[1] ?? '').trim())
      if (!/^\d{4}-\d{2}-\d{2}$/.test(datumRoh) || !Number.isFinite(kurs) || kurs <= 0) continue
      out.push({ datum: datumRoh, kurs: Math.round(kurs * 10000) / 10000 })
    }
    return out
  } catch {
    return []
  }
}

function monatsschluesseAusTaeglich(punkte: KursPunkt[]): KursPunkt[] {
  const last = new Map<string, KursPunkt>()
  for (const p of [...punkte].sort((a, b) => a.datum.localeCompare(b.datum))) {
    last.set(p.datum.slice(0, 7), p)
  }
  return [...last.values()].sort((a, b) => a.datum.localeCompare(b.datum))
}

async function ladeFredCsv(seriesId: string): Promise<KursPunkt[]> {
  try {
    const res = await fetchMitTimeout(
      `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`,
      {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/csv,*/*' },
      },
    )
    if (!res?.ok) return []
    const text = await res.text()
    const lines = text.split(/\r?\n/)
    const out: KursPunkt[] = []
    for (let i = 1; i < lines.length; i++) {
      const [datumRoh, wertRoh] = lines[i]!.split(',')
      const datum = (datumRoh ?? '').trim()
      const kurs = Number.parseFloat((wertRoh ?? '').trim())
      if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || !Number.isFinite(kurs) || kurs <= 0) continue
      out.push({ datum, kurs: Math.round(kurs * 10000) / 10000 })
    }
    return out
  } catch {
    return []
  }
}

function waehlePrimaer(serien: KursPunkt[][]): KursPunkt[] {
  const ok = serien.filter((s) => s.length >= 24)
  if (ok.length === 0) return []
  ok.sort((a, b) => {
    const da = a[0]!.datum
    const db = b[0]!.datum
    if (da !== db) return da.localeCompare(db)
    return b.length - a.length
  })
  return ok[0]!
}

async function ladeMonatsserie(cfg: (typeof INDEX_LIST)[number]): Promise<KursPunkt[]> {
  const [macro, shiller] = await Promise.all([
    cfg.macrotrendsId ? ladeMacrotrendsMonatlich(cfg.macrotrendsId) : Promise.resolve([]),
    cfg.shiller ? ladeShillerSp500() : Promise.resolve([]),
  ])
  let serie = waehlePrimaer([shiller, macro])
  const fruehest = serie[0] ? Number(serie[0].datum.slice(0, 4)) : 9999
  const reicht = serie.length >= 120 && fruehest <= cfg.startYear + 8

  if (!reicht) {
    const [fred, yahoo] = await Promise.all([
      cfg.fredId ? ladeFredCsv(cfg.fredId) : Promise.resolve([]),
      ladeYahooMonatlich(cfg.symbolYahoo, cfg.startYear),
    ])
    const fredMonat = monatsschluesseAusTaeglich(fred)
    const yahooAlt =
      yahoo.length < 24 && cfg.yahooAlt ? await ladeYahooMonatlich(cfg.yahooAlt, cfg.startYear) : []
    serie = fuellePreisLoecher(
      waehlePrimaer([serie, shiller, macro, fredMonat, yahoo, yahooAlt]),
      shiller,
      macro,
      fredMonat,
      yahoo,
      yahooAlt,
    )
  } else {
    serie = fuellePreisLoecher(serie, shiller, macro)
  }

  return ohneLaufendenMonat(serie)
}

export async function ladeBoersenSaison(): Promise<BoersenSaisonPaket> {
  if (paketCache && Date.now() - paketCache.at < CACHE_MS) return paketCache.paket

  const indezes: BoersenSaisonIndex[] = []
  await Promise.all(
    INDEX_LIST.map(async (cfg) => {
      try {
        const serie = await ladeMonatsserie(cfg)
        const rets = renditenAusPreisen(serie)
        const { monate, vonJahr, bisJahr } = saisonAusRenditen(rets)
        if (monate.every((m) => m.anzahl === 0)) return
        indezes.push({
          id: cfg.id,
          name: cfg.name,
          symbol: cfg.symbolYahoo,
          vonJahr,
          bisJahr,
          hinweis: cfg.hinweis,
          monate,
          wahlZyklus: wahlZyklusAusRenditen(rets),
        })
      } catch (e) {
        console.error('[boerse-saison]', cfg.id, e)
      }
    }),
  )

  indezes.sort((a, b) => INDEX_LIST.findIndex((x) => x.id === a.id) - INDEX_LIST.findIndex((x) => x.id === b.id))

  const paket: BoersenSaisonPaket = {
    ok: indezes.length > 0,
    indezes,
    geladenAm: new Date().toISOString(),
    fehler: indezes.length === 0 ? 'Keine Indexhistorie geladen.' : undefined,
  }
  if (paket.ok) paketCache = { at: Date.now(), paket }
  return paket
}

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

const REVALIDATE = 43_200

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
    yahooDailyFrom: 1928,
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
    yahooDailyFrom: 1985,
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
    yahooDailyFrom: 1971,
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
    yahooDailyFrom: 1987,
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

  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    const url = u.toString().replace('query1.finance.yahoo.com', host)
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Referer: 'https://finance.yahoo.com/',
          Accept: 'application/json',
        },
        next: { revalidate: REVALIDATE },
      })
      if (!res.ok) continue
      const j = (await res.json()) as YahooChartJson
      const result = j.chart?.result?.[0]
      if (!result?.timestamp?.length) continue
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
      if (out.length) return out
    } catch {
      continue
    }
  }
  return []
}

async function ladeYahooChunks(
  symbol: string,
  interval: '1mo' | '1d',
  startYear: number,
): Promise<KursPunkt[]> {
  const jetzt = Math.floor(Date.now() / 1000)
  const schrittJahre = interval === '1mo' ? 12 : 4
  const schritt = schrittJahre * 365 * 24 * 60 * 60
  const byYm = new Map<string, KursPunkt>()
  let von = unixVonJahr(startYear)
  while (von < jetzt) {
    const bis = Math.min(jetzt, von + schritt)
    const chunk = await yahooChart(symbol, interval, von, bis)
    for (const p of chunk) byYm.set(p.datum.slice(0, 7), p)
    von = bis + 1
  }
  return [...byYm.values()].sort((a, b) => a.datum.localeCompare(b.datum))
}

async function ladeMacrotrendsMonatlich(pageId: string): Promise<KursPunkt[]> {
  try {
    const res = await fetch(`https://www.macrotrends.net/economic-data/${pageId}/M`, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: 'https://www.macrotrends.net/',
        Accept: 'application/json',
      },
      next: { revalidate: REVALIDATE },
    })
    if (!res.ok) return []
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
    const res = await fetch('https://raw.githubusercontent.com/datasets/s-and-p-500/master/data/data.csv', {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/csv,*/*' },
      next: { revalidate: REVALIDATE },
    })
    if (!res.ok) return []
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
    const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/csv,*/*' },
      next: { revalidate: REVALIDATE },
    })
    if (!res.ok) return []
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
  const [macro, shiller, fred] = await Promise.all([
    cfg.macrotrendsId ? ladeMacrotrendsMonatlich(cfg.macrotrendsId) : Promise.resolve([]),
    cfg.shiller ? ladeShillerSp500() : Promise.resolve([]),
    cfg.fredId ? ladeFredCsv(cfg.fredId) : Promise.resolve([]),
  ])
  const fredMonat = monatsschluesseAusTaeglich(fred)
  const [yahoo, yahooAlt] = await Promise.all([
    ladeYahooChunks(cfg.symbolYahoo, '1mo', Math.max(cfg.startYear, 1985)),
    cfg.yahooAlt ? ladeYahooChunks(cfg.yahooAlt, '1mo', Math.max(cfg.startYear, 1985)) : Promise.resolve([]),
  ])

  let serie = waehlePrimaer([shiller, macro, fredMonat, yahoo, yahooAlt])
  const fruehest = serie[0] ? Number(serie[0].datum.slice(0, 4)) : 9999
  if (serie.length < 24 || fruehest > cfg.startYear + 8) {
    const [yahooDaily, yahooAltDaily] = await Promise.all([
      ladeYahooChunks(cfg.symbolYahoo, '1d', cfg.yahooDailyFrom),
      cfg.yahooAlt ? ladeYahooChunks(cfg.yahooAlt, '1d', cfg.yahooDailyFrom) : Promise.resolve([]),
    ])
    serie = waehlePrimaer([serie, shiller, macro, fredMonat, yahoo, yahooAlt, yahooDaily, yahooAltDaily])
    serie = fuellePreisLoecher(serie, shiller, macro, fredMonat, yahoo, yahooAlt, yahooDaily, yahooAltDaily)
  } else {
    serie = fuellePreisLoecher(serie, shiller, macro, fredMonat, yahoo, yahooAlt)
  }

  return ohneLaufendenMonat(serie)
}

export async function ladeBoersenSaison(): Promise<BoersenSaisonPaket> {
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

  return {
    ok: indezes.length > 0,
    indezes,
    geladenAm: new Date().toISOString(),
    fehler: indezes.length === 0 ? 'Keine Indexhistorie geladen.' : undefined,
  }
}

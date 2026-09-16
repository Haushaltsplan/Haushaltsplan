import 'server-only'

import { ladeStooqHistorieTaeglich } from '@/lib/portfolio-analyse/stooq-historie-server'
import {
  BOERSEN_MONAT_KURZ,
  BOERSEN_MONAT_LABELS,
  type BoersenSaisonIndex,
  type BoersenSaisonMonat,
  type BoersenSaisonPaket,
} from '@/lib/portfolio-analyse/boersen-saison-types'

export type { BoersenSaisonPaket }

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

const INDEX_LIST = [
  {
    id: 'sp500',
    name: 'S&P 500',
    symbolYahoo: '^GSPC',
    stooq: '^spx',
    hinweis: 'US-Leitindex als Kursindex (ohne Dividenden). Längste Historie — der Klassiker für Saisoneffekte.',
  },
  {
    id: 'dax',
    name: 'DAX',
    symbolYahoo: '^GDAXI',
    stooq: '^dax',
    hinweis: 'Deutscher Leitindex als Performanceindex (Dividenden im Stand enthalten).',
  },
  {
    id: 'world',
    name: 'MSCI World',
    symbolYahoo: 'URTH',
    stooq: 'urth.us',
    hinweis: 'Weltaktien über den ETF URTH (kürzere Historie als S&P 500).',
  },
] as const

type KursPunkt = { datum: string; kurs: number }

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

function heuteIso(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function median(werte: number[]): number {
  const s = [...werte].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  if (s.length === 0) return 0
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

function monatsschluesseAusTaeglich(tage: Map<string, number>): KursPunkt[] {
  const last = new Map<string, KursPunkt>()
  const sortiert = [...tage.entries()].sort(([a], [b]) => a.localeCompare(b))
  for (const [datum, kurs] of sortiert) {
    last.set(datum.slice(0, 7), { datum, kurs })
  }
  return [...last.values()].sort((a, b) => a.datum.localeCompare(b.datum))
}

function ohneLaufendenMonat(punkte: KursPunkt[]): KursPunkt[] {
  const jetzt = new Date()
  const ym = `${jetzt.getUTCFullYear()}-${String(jetzt.getUTCMonth() + 1).padStart(2, '0')}`
  return punkte.filter((p) => !p.datum.startsWith(ym))
}

async function ladeYahooMonatsAdjclose(symbol: string): Promise<KursPunkt[]> {
  const sym = symbol.trim()
  if (!sym) return []
  const jetzt = Math.floor(Date.now() / 1000)
  const chunks: { von: number; bis: number }[] = []
  let von = Math.floor(Date.UTC(1950, 0, 1) / 1000)
  const schritt = 20 * 365 * 24 * 60 * 60
  while (von < jetzt) {
    const bis = Math.min(jetzt, von + schritt)
    chunks.push({ von, bis })
    von = bis + 1
  }

  const byDatum = new Map<string, number>()
  for (const chunk of chunks) {
    const u = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}`)
    u.searchParams.set('interval', '1mo')
    u.searchParams.set('period1', String(chunk.von))
    u.searchParams.set('period2', String(chunk.bis))
    u.searchParams.set('events', 'div,split')
    let ok = false
    for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
      const url = u.toString().replace('query1.finance.yahoo.com', host)
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': USER_AGENT,
            Referer: 'https://finance.yahoo.com/',
            Accept: 'application/json',
          },
          next: { revalidate: 43_200 },
        })
        if (!res.ok) continue
        const j = (await res.json()) as YahooChartJson
        const result = j.chart?.result?.[0]
        if (!result?.timestamp?.length) continue
        const closes =
          result.indicators?.adjclose?.[0]?.adjclose ?? result.indicators?.quote?.[0]?.close ?? []
        for (let i = 0; i < result.timestamp.length; i++) {
          const ts = result.timestamp[i]
          const c = closes[i]
          if (ts == null || c == null || !Number.isFinite(c) || c <= 0) continue
          const d = new Date(ts * 1000)
          const datum = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
          byDatum.set(datum, Math.round(c * 10000) / 10000)
        }
        ok = true
        break
      } catch {
        continue
      }
    }
    if (!ok) continue
  }

  return [...byDatum.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([datum, kurs]) => ({ datum, kurs }))
}

async function ladeMonatsserie(symbolYahoo: string, stooq: string): Promise<KursPunkt[]> {
  const yahoo = ohneLaufendenMonat(await ladeYahooMonatsAdjclose(symbolYahoo))
  if (yahoo.length >= 24) return yahoo
  const von = '1950-01-01'
  const taeglich = await ladeStooqHistorieTaeglich(stooq, von, heuteIso())
  return ohneLaufendenMonat(monatsschluesseAusTaeglich(taeglich))
}

function saisonAusSerie(punkte: KursPunkt[]): {
  monate: BoersenSaisonMonat[]
  vonJahr: number | null
  bisJahr: number | null
} {
  const buckets: number[][] = Array.from({ length: 12 }, () => [])
  const sortiert = [...punkte].sort((a, b) => a.datum.localeCompare(b.datum))
  for (let i = 1; i < sortiert.length; i++) {
    const prev = sortiert[i - 1]!
    const cur = sortiert[i]!
    if (prev.kurs <= 0) continue
    const retPct = (cur.kurs / prev.kurs - 1) * 100
    if (!Number.isFinite(retPct)) continue
    const monat = Number(cur.datum.slice(5, 7))
    if (monat < 1 || monat > 12) continue
    buckets[monat - 1]!.push(retPct)
  }

  const monate: BoersenSaisonMonat[] = buckets.map((werte, i) => {
    const n = werte.length
    const avg = n ? werte.reduce((s, x) => s + x, 0) / n : 0
    const pos = werte.filter((x) => x > 0).length
    return {
      monat: i + 1,
      label: BOERSEN_MONAT_LABELS[i]!,
      kurz: BOERSEN_MONAT_KURZ[i]!,
      durchschnittPct: n ? Math.round(avg * 100) / 100 : 0,
      medianPct: n ? Math.round(median(werte) * 100) / 100 : 0,
      trefferquotePct: n ? Math.round((pos / n) * 1000) / 10 : 0,
      anzahl: n,
      minPct: n ? Math.round(Math.min(...werte) * 100) / 100 : 0,
      maxPct: n ? Math.round(Math.max(...werte) * 100) / 100 : 0,
    }
  })

  const jahre = sortiert.map((p) => Number(p.datum.slice(0, 4))).filter((y) => Number.isFinite(y))
  return {
    monate,
    vonJahr: jahre.length ? Math.min(...jahre) : null,
    bisJahr: jahre.length ? Math.max(...jahre) : null,
  }
}

export async function ladeBoersenSaison(): Promise<BoersenSaisonPaket> {
  const indezes: BoersenSaisonIndex[] = []
  await Promise.all(
    INDEX_LIST.map(async (cfg) => {
      try {
        const serie = await ladeMonatsserie(cfg.symbolYahoo, cfg.stooq)
        const { monate, vonJahr, bisJahr } = saisonAusSerie(serie)
        if (monate.every((m) => m.anzahl === 0)) return
        indezes.push({
          id: cfg.id,
          name: cfg.name,
          symbol: cfg.symbolYahoo,
          vonJahr,
          bisJahr,
          hinweis: cfg.hinweis,
          monate,
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

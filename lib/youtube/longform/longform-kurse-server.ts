/** 10 Jahre Tageskurse für den 10.000-$-Chart: Kurs, Total Return (adjclose), SPY, Sektor-ETF, Wechselkurs. */
import 'server-only'

import { LONGFORM_INVEST_USD, type LongformChart10k, type LongformChartPunkt } from '@/lib/youtube/longform/longform-types'

const KOPF = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Referer: 'https://finance.yahoo.com/',
  Accept: 'application/json',
} as const

/** Yahoo GICS-ähnliche Sektoren → Select-Sector SPDR. Unbekannt → null (UI zeigt nur SPY). */
const SEKTOR_ETF: Record<string, string> = {
  technology: 'XLK',
  'information technology': 'XLK',
  'communication services': 'XLC',
  'consumer cyclical': 'XLY',
  'consumer discretionary': 'XLY',
  'consumer defensive': 'XLP',
  'consumer staples': 'XLP',
  energy: 'XLE',
  financial: 'XLF',
  financials: 'XLF',
  healthcare: 'XLV',
  'health care': 'XLV',
  industrials: 'XLI',
  'basic materials': 'XLB',
  materials: 'XLB',
  'real estate': 'XLRE',
  utilities: 'XLU',
}

export function sektorEtfSymbol(sektor: string | null | undefined): string | null {
  if (!sektor?.trim()) return null
  const key = sektor.trim().toLowerCase()
  if (SEKTOR_ETF[key]) return SEKTOR_ETF[key]!
  for (const [k, v] of Object.entries(SEKTOR_ETF)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return null
}

type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: { currency?: string }
      timestamp?: number[]
      indicators?: {
        quote?: Array<{ close?: (number | null)[] }>
        adjclose?: Array<{ adjclose?: (number | null)[] }>
      }
    }>
  }
}

type Tagesreihe = { waehrung: string; kurs: Map<string, number>; gesamt: Map<string, number> }

function tag(sec: number): string {
  return new Date(sec * 1000).toISOString().slice(0, 10)
}

async function ladeReihe(symbol: string, von: Date, bis: Date): Promise<Tagesreihe | null> {
  const u = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`)
  u.searchParams.set('interval', '1d')
  u.searchParams.set('period1', String(Math.floor(von.getTime() / 1000)))
  u.searchParams.set('period2', String(Math.floor(bis.getTime() / 1000)))
  u.searchParams.set('events', 'div,split')
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      const res = await fetch(u.toString().replace('query1.finance.yahoo.com', host), {
        headers: KOPF,
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) continue
      const r = ((await res.json()) as YahooChart).chart?.result?.[0]
      if (!r?.timestamp?.length) continue
      const ts = r.timestamp
      const close = r.indicators?.quote?.[0]?.close ?? []
      const adj = r.indicators?.adjclose?.[0]?.adjclose ?? close
      const kurs = new Map<string, number>()
      const gesamt = new Map<string, number>()
      for (let i = 0; i < ts.length; i++) {
        const c = close[i]
        const a = adj[i]
        if (c == null || a == null || !(c > 0) || !(a > 0)) continue
        const d = tag(ts[i]!)
        kurs.set(d, c)
        gesamt.set(d, a)
      }
      if (kurs.size < 50) continue
      return { waehrung: r.meta?.currency || 'USD', kurs, gesamt }
    } catch {
      continue
    }
  }
  return null
}

/** Letzter bekannter Wert bis einschließlich `d` (Wochenenden, Feiertage unterschiedlicher Börsen). */
function wertBis(serie: [string, number][], d: string, start: { i: number }): number | null {
  let best: number | null = null
  while (start.i < serie.length && serie[start.i]![0] <= d) {
    best = serie[start.i]![1]
    start.i++
  }
  if (best != null) return best
  return start.i > 0 ? serie[start.i - 1]![1] : null
}

function inUsd(reihe: Map<string, number>, fx: Map<string, number> | null): Map<string, number> {
  if (!fx) return reihe
  const fxSort = [...fx.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const zeiger = { i: 0 }
  let letzter: number | null = null
  const out = new Map<string, number>()
  for (const [d, v] of [...reihe.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const f: number | null = wertBis(fxSort, d, zeiger) ?? letzter
    if (f == null) continue
    letzter = f
    out.set(d, v * f)
  }
  return out
}

/** GBp (Pence) und ZAc werden von Yahoo in Hundertsteln geliefert. */
function fxSymbol(waehrung: string): { symbol: string; faktor: number } | null {
  if (waehrung === 'USD') return null
  if (waehrung === 'GBP' || waehrung === 'GBp' || waehrung === 'GBX') {
    return { symbol: 'GBPUSD=X', faktor: waehrung === 'GBP' ? 1 : 0.01 }
  }
  if (waehrung === 'ZAc' || waehrung === 'ZAC') return { symbol: 'ZARUSD=X', faktor: 0.01 }
  if (waehrung === 'ILA') return { symbol: 'ILSUSD=X', faktor: 0.01 }
  return { symbol: `${waehrung}USD=X`, faktor: 1 }
}

export async function ladeChart10k(
  symbolYahoo: string,
  jahre = 10,
  sektor?: string | null,
): Promise<LongformChart10k | null> {
  const bis = new Date()
  const von = new Date(bis)
  von.setUTCFullYear(von.getUTCFullYear() - jahre)
  const sektorSym = sektorEtfSymbol(sektor)
  const [aktie, spy, sektorReihe] = await Promise.all([
    ladeReihe(symbolYahoo, von, bis),
    ladeReihe('SPY', von, bis),
    sektorSym ? ladeReihe(sektorSym, von, bis) : Promise.resolve(null),
  ])
  if (!aktie) return null

  const fxInfo = fxSymbol(aktie.waehrung)
  let fx: Map<string, number> | null = null
  if (fxInfo) {
    const roh = await ladeReihe(fxInfo.symbol, von, bis)
    if (!roh) return null
    fx = new Map([...roh.kurs.entries()].map(([d, v]) => [d, v * fxInfo.faktor]))
  }

  const kursUsd = inUsd(aktie.kurs, fx)
  const gesamtUsd = inUsd(aktie.gesamt, fx)
  const tage = [...gesamtUsd.keys()].sort()
  if (tage.length < 50) return null
  const start = tage[0]!
  const ende = tage[tage.length - 1]!
  const g0 = gesamtUsd.get(start)!
  const k0 = kursUsd.get(start)!

  const spySort = spy ? [...spy.gesamt.entries()].sort((a, b) => a[0].localeCompare(b[0])) : []
  const spyZeiger = { i: 0 }
  const spy0 = spySort.length ? wertBis(spySort, start, { i: 0 }) ?? spySort[0]![1] : null

  const sektSort = sektorReihe ? [...sektorReihe.gesamt.entries()].sort((a, b) => a[0].localeCompare(b[0])) : []
  const sektZeiger = { i: 0 }
  const sekt0 = sektSort.length ? wertBis(sektSort, start, { i: 0 }) ?? sektSort[0]![1] : null

  const punkte: LongformChartPunkt[] = []
  let letzteWoche = ''
  for (let i = 0; i < tage.length; i++) {
    const d = tage[i]!
    const wert = (gesamtUsd.get(d)! / g0) * LONGFORM_INVEST_USD
    const kursWert = kursUsd.has(d) ? (kursUsd.get(d)! / k0) * LONGFORM_INVEST_USD : null
    const spyWert = spy0 ? wertBis(spySort, d, spyZeiger) : null
    const sektWert = sekt0 ? wertBis(sektSort, d, sektZeiger) : null
    const woche = isoWoche(d)
    if (woche !== letzteWoche || i === tage.length - 1) {
      letzteWoche = woche
      punkte.push({
        d,
        aktie: Math.round(wert),
        kursOhneDiv: kursWert != null ? Math.round(kursWert) : null,
        spy: spyWert != null && spy0 ? Math.round((spyWert / spy0) * LONGFORM_INVEST_USD) : null,
        sektor: sektWert != null && sekt0 ? Math.round((sektWert / sekt0) * LONGFORM_INVEST_USD) : null,
      })
    }
  }
  const letzter = punkte[punkte.length - 1]!
  const jahreIst = (Date.parse(ende) - Date.parse(start)) / (365.25 * 86_400_000)
  return {
    startDatum: start,
    endDatum: ende,
    punkte,
    endwertNurKurs: Math.round((kursUsd.get(ende)! / k0) * LONGFORM_INVEST_USD),
    endwertGesamt: letzter.aktie,
    endwertSpy: letzter.spy,
    endwertSektor: letzter.sektor,
    sektorEtf: sektorSym && letzter.sektor != null ? sektorSym : null,
    drawdown: korrekturVorAnstieg(punkte),
    waehrung: aktie.waehrung,
    jahre: Math.round(jahreIst * 10) / 10,
  }
}

/**
 * Letzte abgeschlossene Korrektur vor dem Hoch der Reihe.
 * Mindestens 30 % unter dem Hoch davor, danach ein deutlicher Anstieg.
 * Der noch offene Fall nach dem Hoch zählt nicht.
 */
function korrekturVorAnstieg(punkte: { d: string; aktie: number }[]): { hochDatum: string; tiefDatum: string; pct: number } | null {
  if (punkte.length < 3) return null
  let H = 0
  for (let i = 1; i < punkte.length; i++) if (punkte[i]!.aktie > punkte[H]!.aktie) H = i
  let peakI = 0
  let troughI = 0
  let letzte: { hoch: number; tief: number } | null = null
  for (let i = 1; i <= H; i++) {
    const wert = punkte[i]!.aktie
    if (wert >= punkte[peakI]!.aktie) {
      const peak = punkte[peakI]!.aktie
      const tief = punkte[troughI]!.aktie
      if (troughI > peakI && peak > 0 && tief <= peak * 0.7 && wert >= tief * 1.2) letzte = { hoch: peakI, tief: troughI }
      peakI = i
      troughI = i
    } else if (wert < punkte[troughI]!.aktie) {
      troughI = i
    }
  }
  if (!letzte) return null
  const peak = punkte[letzte.hoch]!.aktie
  const tief = punkte[letzte.tief]!.aktie
  if (peak <= 0) return null
  return {
    hochDatum: punkte[letzte.hoch]!.d,
    tiefDatum: punkte[letzte.tief]!.d,
    pct: Math.round((tief / peak - 1) * 1000) / 10,
  }
}

function isoWoche(d: string): string {
  const t = new Date(`${d}T12:00:00Z`)
  const tagNr = (t.getUTCDay() + 6) % 7
  t.setUTCDate(t.getUTCDate() - tagNr + 3)
  const jahr = t.getUTCFullYear()
  const erster = new Date(Date.UTC(jahr, 0, 4))
  const woche = 1 + Math.round(((t.getTime() - erster.getTime()) / 86_400_000 - 3 + ((erster.getUTCDay() + 6) % 7)) / 7)
  return `${jahr}-${woche}`
}

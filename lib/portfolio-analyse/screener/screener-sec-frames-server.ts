/**
 * SEC XBRL Frames → Universum aller an Nasdaq/NYSE/CBOE gelisteten Filer.
 * Pro Titel die komplette Kalenderjahr-Reihe (so weit Frames zurückreichen), Kurse von Yahoo.
 */

import 'server-only'

import { leseAlsJson } from '@/lib/http/safe-json-response'
import { secFetch } from '@/lib/portfolio-analyse/sec-edgar-common-server'
import { ladeYahooQuoteKennzahlen } from '@/lib/portfolio-analyse/yahoo-kurse-server'
import type {
  ScreenerBoerse,
  ScreenerHistPunkt,
  ScreenerSnapshot,
  ScreenerZeile,
} from '@/lib/portfolio-analyse/screener/screener-types'

const US_BOERSEN = new Set<string>(['Nasdaq', 'NYSE', 'CBOE'])
const ERSTES_FRAME_JAHR = 2009

type FramePunkt = { cik?: number; entityName?: string; val?: number }
type FrameJson = { data?: FramePunkt[] }
type TickerRow = [cik: number, name: string, ticker: string, exchange: string | null]

type JahrRoh = {
  umsatz?: number
  ebit?: number
  ni?: number
  ocf?: number
  capex?: number
  ek?: number
  assets?: number
  eps?: number
}

function zuMio(val: number | null | undefined): number | null {
  if (val == null || !Number.isFinite(val)) return null
  return Math.round((val / 1_000_000) * 10) / 10
}

function pct(zaehler: number | null, nenner: number | null): number | null {
  if (zaehler == null || nenner == null || !(nenner > 0) || !Number.isFinite(zaehler)) return null
  return Math.round((zaehler / nenner) * 1000) / 10
}

function wachstum(jetzt: number | null, vor: number | null): number | null {
  if (jetzt == null || vor == null || !(vor > 0) || !Number.isFinite(jetzt)) return null
  return Math.round((jetzt / vor - 1) * 1000) / 10
}

function runde(n: number | null, stellen = 1): number | null {
  if (n == null || !Number.isFinite(n)) return null
  const f = 10 ** stellen
  return Math.round(n * f) / f
}

function median(werte: number[]): number | null {
  if (werte.length === 0) return null
  const s = [...werte].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

function cagr(serie: { jahr: number; val: number }[], fenster: number): number | null {
  if (serie.length < 2) return null
  const last = serie[serie.length - 1]!
  const ziel = last.jahr - fenster
  let start: { jahr: number; val: number } | null = null
  for (const p of serie) {
    if (p.jahr <= ziel && p.val > 0) start = p
  }
  if (!start || start.jahr >= last.jahr || !(last.val > 0)) return null
  const n = last.jahr - start.jahr
  if (n < 2) return null
  return runde((Math.pow(last.val / start.val, 1 / n) - 1) * 100)
}

async function ladeFrame(taxonomy: string, tag: string, unit: string, periode: string): Promise<Map<number, number>> {
  const url = `https://data.sec.gov/api/xbrl/frames/${taxonomy}/${tag}/${unit}/${periode}.json`
  const res = await secFetch(url)
  const out = new Map<number, number>()
  if (!res.ok) return out
  const json = await leseAlsJson<FrameJson>(res)
  for (const e of json?.data ?? []) {
    if (e.cik == null || e.val == null || !Number.isFinite(e.val)) continue
    const prev = out.get(e.cik)
    if (prev == null || Math.abs(e.val) > Math.abs(prev)) out.set(e.cik, e.val)
  }
  return out
}

function mergen(primaer: Map<number, number>, ...rest: Map<number, number>[]): Map<number, number> {
  const out = new Map(primaer)
  for (const extra of rest) {
    for (const [cik, val] of extra) {
      if (!out.has(cik)) out.set(cik, val)
    }
  }
  return out
}

function setz(ziel: Map<number, Map<number, JahrRoh>>, cik: number, jahr: number, feld: keyof JahrRoh, roh: number) {
  let jahre = ziel.get(cik)
  if (!jahre) {
    jahre = new Map()
    ziel.set(cik, jahre)
  }
  const eintrag = jahre.get(jahr) ?? {}
  eintrag[feld] = roh
  jahre.set(jahr, eintrag)
}

async function neuestesDauerJahr(): Promise<number> {
  const jetzt = new Date().getUTCFullYear()
  for (let y = jetzt; y >= jetzt - 2; y--) {
    const ni = await ladeFrame('us-gaap', 'NetIncomeLoss', 'USD', `CY${y}`)
    if (ni.size >= 2500) return y
  }
  return jetzt - 1
}

async function ladeUsBoersenTicker(): Promise<TickerRow[]> {
  const res = await secFetch('https://www.sec.gov/files/company_tickers_exchange.json')
  if (!res.ok) throw new Error(`SEC Ticker-Börsenliste (${res.status})`)
  const json = await leseAlsJson<{ data?: TickerRow[] }>(res)
  const out: TickerRow[] = []
  for (const row of json?.data ?? []) {
    if (!Array.isArray(row) || row.length < 4) continue
    const [cik, name, ticker, exchange] = row
    if (!cik || !ticker || !exchange || !US_BOERSEN.has(exchange)) continue
    out.push([cik, name, ticker.toUpperCase(), exchange])
  }
  return out
}

export async function baueScreenerSnapshot(): Promise<ScreenerSnapshot> {
  const bisJahr = await neuestesDauerJahr()
  const ticker = await ladeUsBoersenTicker()
  const perCik = new Map<number, Map<number, JahrRoh>>()

  for (let jahr = ERSTES_FRAME_JAHR; jahr <= bisJahr; jahr++) {
    const dauer = `CY${jahr}`
    const stichtag = `CY${jahr}Q4I`
    const [umsatzAsc, umsatzRev, umsatzSales, ebit, ni, ocf, capex, eps, ek, assets] = await Promise.all([
      ladeFrame('us-gaap', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'USD', dauer),
      ladeFrame('us-gaap', 'Revenues', 'USD', dauer),
      ladeFrame('us-gaap', 'SalesRevenueNet', 'USD', dauer),
      ladeFrame('us-gaap', 'OperatingIncomeLoss', 'USD', dauer),
      ladeFrame('us-gaap', 'NetIncomeLoss', 'USD', dauer),
      ladeFrame('us-gaap', 'NetCashProvidedByUsedInOperatingActivities', 'USD', dauer),
      ladeFrame('us-gaap', 'PaymentsToAcquirePropertyPlantAndEquipment', 'USD', dauer),
      ladeFrame('us-gaap', 'EarningsPerShareDiluted', 'USD-per-shares', dauer),
      ladeFrame('us-gaap', 'StockholdersEquity', 'USD', stichtag),
      ladeFrame('us-gaap', 'Assets', 'USD', stichtag),
    ])
    const umsatz = mergen(umsatzAsc, umsatzRev, umsatzSales)
    for (const [cik, val] of umsatz) setz(perCik, cik, jahr, 'umsatz', val)
    for (const [cik, val] of ebit) setz(perCik, cik, jahr, 'ebit', val)
    for (const [cik, val] of ni) setz(perCik, cik, jahr, 'ni', val)
    for (const [cik, val] of ocf) setz(perCik, cik, jahr, 'ocf', val)
    for (const [cik, val] of capex) setz(perCik, cik, jahr, 'capex', val)
    for (const [cik, val] of eps) setz(perCik, cik, jahr, 'eps', val)
    for (const [cik, val] of ek) setz(perCik, cik, jahr, 'ek', val)
    for (const [cik, val] of assets) setz(perCik, cik, jahr, 'assets', val)
  }

  const zeilen: ScreenerZeile[] = []
  const gesehen = new Set<string>()
  for (const [cik, name, sym, exchange] of ticker) {
    if (gesehen.has(sym)) continue
    gesehen.add(sym)
    const jahreMap = perCik.get(cik)
    if (!jahreMap || jahreMap.size === 0) continue
    const jahre = [...jahreMap.keys()].sort((a, b) => a - b)
    const hist: ScreenerHistPunkt[] = jahre.map((jahr) => {
      const r = jahreMap.get(jahr)!
      const ocfMio = zuMio(r.ocf)
      const capexMio = zuMio(r.capex)
      const fcfMio =
        ocfMio == null && capexMio == null
          ? null
          : Math.round(((ocfMio ?? 0) - Math.abs(capexMio ?? 0)) * 10) / 10
      return {
        jahr,
        umsatzMio: zuMio(r.umsatz),
        ebitMio: zuMio(r.ebit),
        niMio: zuMio(r.ni),
        fcfMio,
        ekMio: zuMio(r.ek),
        eps: r.eps != null && Number.isFinite(r.eps) ? Math.round(r.eps * 1000) / 1000 : null,
      }
    })
    const last = hist[hist.length - 1]!
    const vor = hist.length >= 2 ? hist[hist.length - 2]! : null
    const lastRoh = jahreMap.get(last.jahr)!
    const umsatzSerie = hist.filter((p) => p.umsatzMio != null && p.umsatzMio > 0).map((p) => ({
      jahr: p.jahr,
      val: p.umsatzMio!,
    }))
    const niMargen = hist
      .map((p) => pct(p.niMio, p.umsatzMio))
      .filter((v): v is number => v != null)
    const epsLast = last.eps
    zeilen.push({
      ticker: sym,
      name,
      boerse: exchange as ScreenerBoerse,
      cik,
      umsatzMio: last.umsatzMio,
      ebitMio: last.ebitMio,
      niMio: last.niMio,
      ocfMio: zuMio(lastRoh.ocf),
      fcfMio: last.fcfMio,
      ekMio: last.ekMio,
      assetsMio: zuMio(lastRoh.assets),
      niMargePct: pct(last.niMio, last.umsatzMio),
      ebitMargePct: pct(last.ebitMio, last.umsatzMio),
      roePct: pct(last.niMio, last.ekMio),
      fcfMargePct: pct(last.fcfMio, last.umsatzMio),
      umsatzWachstumPct: wachstum(last.umsatzMio, vor?.umsatzMio ?? null),
      umsatzCagr3y: cagr(umsatzSerie, 3),
      umsatzCagr5y: cagr(umsatzSerie, 5),
      umsatzCagr10y: cagr(umsatzSerie, 10),
      niMargeMedian: runde(median(niMargen)),
      jahreAnzahl: umsatzSerie.length,
      vonJahr: hist[0]?.jahr ?? null,
      bisJahr: last.jahr,
      kurs: null,
      marktkapMio: null,
      kgv: null,
      kuv: null,
      kbv: null,
      hist,
    })
  }

  const quotes = await ladeYahooQuoteKennzahlen(zeilen.map((z) => z.ticker))
  for (const z of zeilen) {
    const q = quotes.get(z.ticker)
    const kurs = q?.preis ?? null
    const mcapMio = q?.marktkap != null && q.marktkap > 0 ? q.marktkap / 1_000_000 : null
    const eps = z.hist?.at(-1)?.eps ?? null
    z.kurs = kurs
    z.marktkapMio = mcapMio != null ? runde(mcapMio) : null
    z.kgv = runde(
      q?.trailingPE ?? (kurs != null && eps != null && eps > 0 ? kurs / eps : null),
    )
    z.kuv = mcapMio != null && z.umsatzMio != null && z.umsatzMio > 0 ? runde(mcapMio / z.umsatzMio) : null
    z.kbv = runde(
      q?.priceToBook ?? (mcapMio != null && z.ekMio != null && z.ekMio > 0 ? mcapMio / z.ekMio : null),
    )
  }

  zeilen.sort((a, b) => (b.umsatzMio ?? -1) - (a.umsatzMio ?? -1))

  return {
    periode: `CY${bisJahr}`,
    aktualisiertAm: new Date().toISOString(),
    n: zeilen.length,
    zeilen,
  }
}

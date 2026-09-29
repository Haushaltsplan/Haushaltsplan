/**
 * SEC XBRL Frames → Universum aller an Nasdaq/NYSE/CBOE gelisteten Filer.
 * Pro Titel die komplette Kalenderjahr-Reihe (so weit Frames zurückreichen), Kurse von Yahoo.
 */

import 'server-only'

import { leseAlsJson } from '@/lib/http/safe-json-response'
import { cagrJaehrlichAusSerie } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import { secFetch } from '@/lib/portfolio-analyse/sec-edgar-common-server'
import { SCREENER_SCHEMA_VERSION } from '@/lib/portfolio-analyse/screener/screener-types'
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
  debt?: number
  cash?: number
  da?: number
  aktien?: number
}

const MAX_ROIC_PCT = 80

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

function addMaps(a: Map<number, number>, b: Map<number, number>): Map<number, number> {
  const out = new Map(a)
  for (const [cik, val] of b) {
    out.set(cik, (out.get(cik) ?? 0) + val)
  }
  return out
}

function zuAktienMio(val: number | null | undefined): number | null {
  if (val == null || !Number.isFinite(val) || val <= 0) return null
  const mio = val >= 1_000_000 ? val / 1_000_000 : val
  return Math.round(mio * 100) / 100
}

function investedMio(ekMio: number | null, debtMio: number | null): number | null {
  if (ekMio == null) return null
  const ic = ekMio + (debtMio ?? 0)
  return ic > 0 ? ic : null
}

function roicPctAus(ebitMio: number | null, icNow: number | null, icPrev: number | null): number | null {
  if (ebitMio == null || icNow == null) return null
  const avg = icPrev != null ? (icNow + icPrev) / 2 : icNow
  if (!(avg > 0)) return null
  const v = ((ebitMio * 0.79) / avg) * 100
  if (!Number.isFinite(v)) return null
  if (v > MAX_ROIC_PCT) return MAX_ROIC_PCT
  return runde(v)
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
    const [ltDebt, debtCur, ltDebtCur, cash, shares, da] = await Promise.all([
      ladeFrame('us-gaap', 'LongTermDebt', 'USD', stichtag),
      ladeFrame('us-gaap', 'DebtCurrent', 'USD', stichtag),
      ladeFrame('us-gaap', 'LongTermDebtCurrent', 'USD', stichtag),
      ladeFrame('us-gaap', 'CashAndCashEquivalentsAtCarryingValue', 'USD', stichtag),
      ladeFrame('us-gaap', 'WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', dauer),
      ladeFrame('us-gaap', 'DepreciationDepletionAndAmortization', 'USD', dauer),
    ])
    const umsatz = mergen(umsatzAsc, umsatzRev, umsatzSales)
    const debt = addMaps(ltDebt, mergen(debtCur, ltDebtCur))
    for (const [cik, val] of umsatz) setz(perCik, cik, jahr, 'umsatz', val)
    for (const [cik, val] of ebit) setz(perCik, cik, jahr, 'ebit', val)
    for (const [cik, val] of ni) setz(perCik, cik, jahr, 'ni', val)
    for (const [cik, val] of ocf) setz(perCik, cik, jahr, 'ocf', val)
    for (const [cik, val] of capex) setz(perCik, cik, jahr, 'capex', val)
    for (const [cik, val] of eps) setz(perCik, cik, jahr, 'eps', val)
    for (const [cik, val] of ek) setz(perCik, cik, jahr, 'ek', val)
    for (const [cik, val] of assets) setz(perCik, cik, jahr, 'assets', val)
    for (const [cik, val] of debt) setz(perCik, cik, jahr, 'debt', val)
    for (const [cik, val] of cash) setz(perCik, cik, jahr, 'cash', val)
    for (const [cik, val] of shares) setz(perCik, cik, jahr, 'aktien', val)
    for (const [cik, val] of da) setz(perCik, cik, jahr, 'da', val)
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
        debtMio: zuMio(r.debt),
        cashMio: zuMio(r.cash),
        daMio: zuMio(r.da),
        aktienMio: zuAktienMio(r.aktien),
      }
    })
    const last = hist[hist.length - 1]!
    const vor = hist.length >= 2 ? hist[hist.length - 2]! : null
    const lastRoh = jahreMap.get(last.jahr)!
    const umsatzSerie = hist.filter((p) => p.umsatzMio != null && p.umsatzMio > 0).map((p) => ({
      jahr: p.jahr,
      val: p.umsatzMio!,
    }))
    const epsSerie = hist.filter((p) => p.eps != null && p.eps > 0).map((p) => ({ jahr: p.jahr, val: p.eps! }))
    const fcfSerie = hist.filter((p) => p.fcfMio != null && p.fcfMio > 0).map((p) => ({ jahr: p.jahr, val: p.fcfMio! }))
    const niMargen = hist
      .map((p) => pct(p.niMio, p.umsatzMio))
      .filter((v): v is number => v != null)
    const fcfMargePct = pct(last.fcfMio, last.umsatzMio)
    const umsatzWachstumPct = wachstum(last.umsatzMio, vor?.umsatzMio ?? null)
    const fcfConversionPct =
      last.niMio != null && last.niMio > 0 && last.fcfMio != null ? runde((last.fcfMio / last.niMio) * 100) : null
    const capexSalesPct = pct(zuMio(lastRoh.capex) != null ? Math.abs(zuMio(lastRoh.capex)!) : null, last.umsatzMio)
    const icNow = investedMio(last.ekMio, last.debtMio ?? null)
    const icPrev = vor ? investedMio(vor.ekMio, vor.debtMio ?? null) : null
    const netDebtMio =
      last.debtMio == null && last.cashMio == null
        ? null
        : runde((last.debtMio ?? 0) - (last.cashMio ?? 0))
    const ebitdaMio =
      last.ebitMio == null && last.daMio == null
        ? null
        : runde((last.ebitMio ?? 0) + Math.abs(last.daMio ?? 0))
    const netDebtEbitda =
      netDebtMio == null || ebitdaMio == null || !(ebitdaMio > 0) ? null : runde(netDebtMio / ebitdaMio, 2)
    const aktienSerie = hist.map((p) => p.aktienMio).filter((v): v is number => v != null && v > 0)
    const aktienVerwaesserungJaehrlichPct = runde(cagrJaehrlichAusSerie(aktienSerie), 2)
    const ruleOf40 =
      umsatzWachstumPct == null && fcfMargePct == null
        ? null
        : runde((umsatzWachstumPct ?? 0) + (fcfMargePct ?? 0))
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
      debtMio: last.debtMio ?? null,
      cashMio: last.cashMio ?? null,
      niMargePct: pct(last.niMio, last.umsatzMio),
      ebitMargePct: pct(last.ebitMio, last.umsatzMio),
      roePct: pct(last.niMio, last.ekMio),
      roicPct: roicPctAus(last.ebitMio, icNow, icPrev),
      fcfMargePct,
      fcfConversionPct,
      capexSalesPct,
      umsatzWachstumPct,
      umsatzCagr3y: cagr(umsatzSerie, 3),
      umsatzCagr5y: cagr(umsatzSerie, 5),
      umsatzCagr10y: cagr(umsatzSerie, 10),
      epsCagr5y: cagr(epsSerie, 5),
      fcfCagr5y: cagr(fcfSerie, 5),
      ruleOf40,
      niMargeMedian: runde(median(niMargen)),
      aktienVerwaesserungJaehrlichPct,
      netDebtMio,
      netDebtEbitda,
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
    z.sektor = q?.sektor ?? null
    z.industrie = q?.industrie ?? null
  }

  zeilen.sort((a, b) => (b.umsatzMio ?? -1) - (a.umsatzMio ?? -1))

  return {
    periode: `CY${bisJahr}`,
    aktualisiertAm: new Date().toISOString(),
    n: zeilen.length,
    schemaVersion: SCREENER_SCHEMA_VERSION,
    zeilen,
  }
}

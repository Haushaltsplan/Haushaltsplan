/**
 * SEC XBRL Frames → Universum aller an Nasdaq/NYSE/CBOE gelisteten Filer.
 * Pro Titel die komplette Kalenderjahr-Reihe (so weit Frames zurückreichen), Kurse von Yahoo.
 */

import 'server-only'

import { leseAlsJson } from '@/lib/http/safe-json-response'
import { cagrJaehrlichAusSerie, aktienreiheSplitBereinigt } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import { berechneBruttomargenStabilitaet } from '@/lib/portfolio-analyse/fundamentaldaten-pricing-power'
import { schaetzeWaccPct } from '@/lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import { secFetch } from '@/lib/portfolio-analyse/sec-edgar-common-server'
import { waehleNettoUmsatz, bereinigeUmsatzGrossVsNet } from '@/lib/portfolio-analyse/sec-umsatz-netto'
import { iroicAusJahresreihe, roic5ySchnitt, roicPctAusPunkt } from '@/lib/portfolio-analyse/screener/screener-quality-compounder'
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
  gp?: number
  zins?: number
  sbc?: number
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

/** Mittel der letzten maxN endlichen Werte (auch ≤0); mind. minN. */
function mittelLetzte(
  werte: Array<number | null | undefined>,
  maxN = 5,
  minN = 3,
  nurPositiv = false,
): number | null {
  const genommen: number[] = []
  for (let i = werte.length - 1; i >= 0 && genommen.length < maxN; i--) {
    const v = werte[i]
    if (v == null || !Number.isFinite(v)) continue
    if (nurPositiv && !(v > 0)) continue
    genommen.push(v)
  }
  if (genommen.length < minN) return null
  return genommen.reduce((a, b) => a + b, 0) / genommen.length
}

/**
 * CAGR über ~fenster Jahre. Startjahr muss nahe jahr−fenster liegen (±1),
 * sonst wäre z. B. ein 6J-Fenster als „5J“ gelabelt.
 */
function cagr(serie: { jahr: number; val: number }[], fenster: number): number | null {
  if (serie.length < 2) return null
  const last = serie[serie.length - 1]!
  const ziel = last.jahr - fenster
  let best: { jahr: number; val: number } | null = null
  let bestDist = Infinity
  for (const p of serie) {
    if (!(p.val > 0) || p.jahr >= last.jahr) continue
    const dist = Math.abs(p.jahr - ziel)
    if (dist < bestDist) {
      bestDist = dist
      best = p
    }
  }
  if (!best || bestDist > 2 || !(last.val > 0)) return null
  const n = last.jahr - best.jahr
  if (n < Math.max(2, fenster - 2)) return null
  return runde((Math.pow(last.val / best.val, 1 / n) - 1) * 100)
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

/** Netto-Tags zuerst; bei Gross-vs-Net-Konflikt die kleinere Zahl. */
function mergenUmsatzNetto(
  netto: Map<number, number>[],
  grob: Map<number, number>[],
): Map<number, number> {
  const n = mergen(netto[0] ?? new Map(), ...netto.slice(1))
  const g = mergen(grob[0] ?? new Map(), ...grob.slice(1))
  const out = new Map(n)
  for (const [cik, gv] of g) {
    const w = waehleNettoUmsatz(out.get(cik), gv)
    if (w != null) out.set(cik, w)
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
    const [
      umsatzRev,
      umsatzSales,
      umsatzAsc,
      umsatzAscTax,
      ebit,
      ni,
      ocf,
      ocfCont,
      capex,
      capexProd,
      capexOther,
      capexImp,
      eps,
      ek,
      ekNc,
      assets,
      cogs,
      cogsRev,
    ] = await Promise.all([
      ladeFrame('us-gaap', 'Revenues', 'USD', dauer),
      ladeFrame('us-gaap', 'SalesRevenueNet', 'USD', dauer),
      ladeFrame('us-gaap', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'USD', dauer),
      ladeFrame('us-gaap', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'USD', dauer),
      ladeFrame('us-gaap', 'OperatingIncomeLoss', 'USD', dauer),
      ladeFrame('us-gaap', 'NetIncomeLoss', 'USD', dauer),
      ladeFrame('us-gaap', 'NetCashProvidedByUsedInOperatingActivities', 'USD', dauer),
      ladeFrame('us-gaap', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations', 'USD', dauer),
      ladeFrame('us-gaap', 'PaymentsToAcquirePropertyPlantAndEquipment', 'USD', dauer),
      ladeFrame('us-gaap', 'PaymentsToAcquireProductiveAssets', 'USD', dauer),
      ladeFrame('us-gaap', 'PaymentsToAcquireOtherPropertyPlantAndEquipment', 'USD', dauer),
      ladeFrame('us-gaap', 'PaymentsForCapitalImprovements', 'USD', dauer),
      ladeFrame('us-gaap', 'EarningsPerShareDiluted', 'USD-per-shares', dauer),
      ladeFrame('us-gaap', 'StockholdersEquity', 'USD', stichtag),
      ladeFrame(
        'us-gaap',
        'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
        'USD',
        stichtag,
      ),
      ladeFrame('us-gaap', 'Assets', 'USD', stichtag),
      ladeFrame('us-gaap', 'CostOfGoodsAndServicesSold', 'USD', dauer),
      ladeFrame('us-gaap', 'CostOfRevenue', 'USD', dauer),
    ])
    const [
      ltDebt,
      ltDebtNc,
      ltDebtLease,
      debtCur,
      ltDebtCur,
      ltDebtLeaseCur,
      shortBorrow,
      commercialPaper,
      leaseLt,
      leaseSt,
      cash,
      cashSti,
      sti,
      stiOther,
      shares,
      sharesBasic,
      da,
      da2,
      da3,
      gp,
      zins,
      zinsDebt,
      zinsNonop,
      zinsAndDebt,
      sbc,
      sbc2,
    ] = await Promise.all([
      ladeFrame('us-gaap', 'LongTermDebt', 'USD', stichtag),
      ladeFrame('us-gaap', 'LongTermDebtNoncurrent', 'USD', stichtag),
      ladeFrame('us-gaap', 'LongTermDebtAndCapitalLeaseObligations', 'USD', stichtag),
      ladeFrame('us-gaap', 'DebtCurrent', 'USD', stichtag),
      ladeFrame('us-gaap', 'LongTermDebtCurrent', 'USD', stichtag),
      ladeFrame('us-gaap', 'LongTermDebtAndCapitalLeaseObligationsCurrent', 'USD', stichtag),
      ladeFrame('us-gaap', 'ShortTermBorrowings', 'USD', stichtag),
      ladeFrame('us-gaap', 'CommercialPaper', 'USD', stichtag),
      ladeFrame('us-gaap', 'OperatingLeaseLiabilityNoncurrent', 'USD', stichtag),
      ladeFrame('us-gaap', 'OperatingLeaseLiabilityCurrent', 'USD', stichtag),
      ladeFrame('us-gaap', 'CashAndCashEquivalentsAtCarryingValue', 'USD', stichtag),
      ladeFrame('us-gaap', 'CashCashEquivalentsAndShortTermInvestments', 'USD', stichtag),
      ladeFrame('us-gaap', 'ShortTermInvestments', 'USD', stichtag),
      ladeFrame('us-gaap', 'OtherShortTermInvestments', 'USD', stichtag),
      ladeFrame('us-gaap', 'WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', dauer),
      ladeFrame('us-gaap', 'WeightedAverageNumberOfShareOutstandingBasicAndDiluted', 'shares', dauer),
      ladeFrame('us-gaap', 'DepreciationDepletionAndAmortization', 'USD', dauer),
      ladeFrame('us-gaap', 'DepreciationAndAmortization', 'USD', dauer),
      ladeFrame('us-gaap', 'DepreciationAmortizationAndAccretionNet', 'USD', dauer),
      ladeFrame('us-gaap', 'GrossProfit', 'USD', dauer),
      ladeFrame('us-gaap', 'InterestExpense', 'USD', dauer),
      ladeFrame('us-gaap', 'InterestExpenseDebt', 'USD', dauer),
      ladeFrame('us-gaap', 'InterestExpenseNonoperating', 'USD', dauer),
      ladeFrame('us-gaap', 'InterestAndDebtExpense', 'USD', dauer),
      ladeFrame('us-gaap', 'ShareBasedCompensation', 'USD', dauer),
      ladeFrame('us-gaap', 'AllocatedShareBasedCompensationExpense', 'USD', dauer),
    ])
    const umsatz = mergenUmsatzNetto([umsatzRev, umsatzSales], [umsatzAsc, umsatzAscTax])
    const capexGesamt = mergen(capex, capexProd, capexOther, capexImp)
    const ocfGesamt = mergen(ocf, ocfCont)
    const ekGesamt = mergen(ek, ekNc)
    const sharesGesamt = mergen(shares, sharesBasic)
    const debtLt = mergen(ltDebtLease, ltDebtNc, ltDebt)
    const debtSt = mergen(debtCur, ltDebtLeaseCur, ltDebtCur, shortBorrow, commercialPaper)
    const debt = addMaps(addMaps(debtLt, debtSt), addMaps(leaseLt, leaseSt))
    const cashTeile = addMaps(cash, mergen(sti, stiOther))
    const cashGesamt = mergen(cashSti, cashTeile)
    const daGesamt = mergen(da, da2, da3)
    const zinsGesamt = mergen(zins, zinsDebt, zinsNonop, zinsAndDebt)
    const sbcGesamt = mergen(sbc, sbc2)
    const cogsGesamt = mergen(cogs, cogsRev)
    // Bruttogewinn: Tag zuerst, sonst Umsatz − COGS (keine Schein-100 %-Marge ohne COGS)
    const gpGesamt = new Map(gp)
    for (const [cik, u] of umsatz) {
      if (gpGesamt.has(cik)) continue
      const c = cogsGesamt.get(cik)
      if (c == null || !(u > 0)) continue
      const brutto = u - Math.abs(c)
      if (Number.isFinite(brutto)) gpGesamt.set(cik, brutto)
    }
    for (const [cik, val] of umsatz) setz(perCik, cik, jahr, 'umsatz', val)
    for (const [cik, val] of ebit) setz(perCik, cik, jahr, 'ebit', val)
    for (const [cik, val] of ni) setz(perCik, cik, jahr, 'ni', val)
    for (const [cik, val] of ocfGesamt) setz(perCik, cik, jahr, 'ocf', val)
    for (const [cik, val] of capexGesamt) setz(perCik, cik, jahr, 'capex', val)
    for (const [cik, val] of eps) setz(perCik, cik, jahr, 'eps', val)
    for (const [cik, val] of ekGesamt) setz(perCik, cik, jahr, 'ek', val)
    for (const [cik, val] of assets) setz(perCik, cik, jahr, 'assets', val)
    for (const [cik, val] of debt) setz(perCik, cik, jahr, 'debt', val)
    for (const [cik, val] of cashGesamt) setz(perCik, cik, jahr, 'cash', val)
    for (const [cik, val] of sharesGesamt) setz(perCik, cik, jahr, 'aktien', val)
    for (const [cik, val] of daGesamt) setz(perCik, cik, jahr, 'da', val)
    for (const [cik, val] of gpGesamt) setz(perCik, cik, jahr, 'gp', val)
    for (const [cik, val] of zinsGesamt) setz(perCik, cik, jahr, 'zins', val)
    for (const [cik, val] of sbcGesamt) setz(perCik, cik, jahr, 'sbc', val)
  }

  const zeilen: ScreenerZeile[] = []
  const gesehen = new Set<string>()
  const zinsUsdByCik = new Map<number, number>()
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
      // FCF nur mit OCF — CapEx allein erzeugt kein negatives Fake-FCF.
      const fcfMio =
        ocfMio == null
          ? null
          : Math.round((ocfMio - Math.abs(capexMio ?? 0)) * 10) / 10
      return {
        jahr,
        umsatzMio: zuMio(r.umsatz),
        ebitMio: zuMio(r.ebit),
        niMio: zuMio(r.ni),
        fcfMio,
        ekMio: zuMio(r.ek),
        eps:
          r.eps != null && Number.isFinite(r.eps)
            ? Math.round(r.eps * 1000) / 1000
            : r.ni != null && r.aktien != null && r.aktien > 0
              ? Math.round((r.ni / r.aktien) * 1000) / 1000
              : null,
        debtMio: zuMio(r.debt) ?? (r.ek != null || r.assets != null ? 0 : null),
        cashMio: zuMio(r.cash) ?? (r.ek != null || r.assets != null ? 0 : null),
        daMio: zuMio(r.da),
        aktienMio: zuAktienMio(r.aktien),
      }
    })
    const umsatzGlatt = bereinigeUmsatzGrossVsNet(hist.map((p) => ({ umsatz: p.umsatzMio, ebit: p.ebitMio })))
    for (let i = 0; i < hist.length; i++) {
      const neu = umsatzGlatt[i]!.umsatz
      if (neu != null) hist[i]!.umsatzMio = Math.round(neu * 10) / 10
    }
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
    // Schulden: fehlendes Debt-Tag bei vorhandener Bilanz = 0 (Nullverschuldung meldet oft keinen Tag).
    const hatBilanz = last.ekMio != null || zuMio(lastRoh.assets) != null
    const debtFuerNd =
      last.debtMio != null ? last.debtMio : hatBilanz ? 0 : null
    const cashFuerNd = last.cashMio ?? (hatBilanz ? 0 : null)
    const netDebtMio =
      debtFuerNd == null || cashFuerNd == null ? null : runde(debtFuerNd - cashFuerNd)
    // EBITDA = EBIT + |D&A|; D&A-Lücke → EBIT als Untergrenze (besser als null)
    const ebitdaMio =
      last.ebitMio == null
        ? null
        : runde(last.ebitMio + Math.abs(last.daMio ?? 0))
    // ND/EBITDA auch bei Netto-Cash (negativ); nur ohne positives EBITDA sinnlos
    const netDebtEbitda =
      netDebtMio == null || ebitdaMio == null || !(ebitdaMio > 0)
        ? null
        : runde(netDebtMio / ebitdaMio, 2)
    const aktienRoh = hist.map((p) => p.aktienMio).filter((v): v is number => v != null && v > 0)
    const aktienSerie = aktienreiheSplitBereinigt(aktienRoh)
    const aktienVerwaesserungJaehrlichPct = runde(cagrJaehrlichAusSerie(aktienSerie), 2)
    // Rule of 40: beide Beine nötig — Wachstum allein gilt nicht.
    const ruleOf40 =
      umsatzWachstumPct == null || fcfMargePct == null
        ? null
        : runde(umsatzWachstumPct + fcfMargePct)
    // Brutto auf bereinigtem Umsatz (gleiche Basis wie Stability).
    const bruttoSerie: number[] = []
    for (let i = 0; i < hist.length; i++) {
      const h = hist[i]!
      const r = jahreMap.get(h.jahr)!
      const m = pct(zuMio(r.gp), h.umsatzMio)
      if (m != null) bruttoSerie.push(m)
    }
    const bruttoMargePct = pct(zuMio(lastRoh.gp), last.umsatzMio)
    const bruttoStab = berechneBruttomargenStabilitaet(bruttoSerie)
    const capexAbs = zuMio(lastRoh.capex) != null ? Math.abs(zuMio(lastRoh.capex)!) : null
    const daAbs = last.daMio != null ? Math.abs(last.daMio) : null
    const reinvestitionsquotePct =
      capexAbs != null && last.fcfMio != null && Math.abs(last.fcfMio) >= 1
        ? runde(((capexAbs - (daAbs ?? 0)) / Math.abs(last.fcfMio)) * 100)
        : null
    const fcfJeAktieSerie = hist
      .filter((p) => p.fcfMio != null && p.fcfMio > 0 && p.aktienMio != null && p.aktienMio > 0)
      .map((p) => ({ jahr: p.jahr, val: p.fcfMio! / p.aktienMio! }))
    const zinsMio = zuMio(lastRoh.zins)
    // Zinsdeckung: EBIT / |Zins|. Keine/minimale Zinsen bei ~0 Schulden → sehr hohe Deckung (Filter „≥10“).
    let interestCoverage: number | null = null
    if (last.ebitMio != null && zinsMio != null && Math.abs(zinsMio) > 0.05) {
      interestCoverage = runde(last.ebitMio / Math.abs(zinsMio), 1)
    } else if (
      last.ebitMio != null &&
      last.ebitMio > 0 &&
      (zinsMio == null || Math.abs(zinsMio) <= 0.05) &&
      (debtFuerNd == null || debtFuerNd < 1)
    ) {
      interestCoverage = 999
    }
    const sbcMio = zuMio(lastRoh.sbc)
    const ocfMioNow = zuMio(lastRoh.ocf)
    const sbcOcfPct =
      sbcMio != null && ocfMioNow != null && ocfMioNow > 0
        ? runde((Math.abs(sbcMio) / ocfMioNow) * 100)
        : null
    const iroicPct = iroicAusJahresreihe(hist)
    const roic5yAvgPct = roic5ySchnitt(hist)
    if (zinsMio != null) zinsUsdByCik.set(cik, Math.abs(zinsMio) * 1_000_000)
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
      debtMio: debtFuerNd,
      cashMio: last.cashMio ?? cashFuerNd,
      niMargePct: pct(last.niMio, last.umsatzMio),
      ebitMargePct: pct(last.ebitMio, last.umsatzMio),
      roePct: pct(last.niMio, last.ekMio),
      roicPct: roicPctAusPunkt(last, vor),
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
      iroicPct,
      roic5yAvgPct,
      bruttoMargePct,
      bruttoMargeStabil: bruttoStab.pricingPowerOk,
      reinvestitionsquotePct,
      fcfJeAktieCagr5y: cagr(fcfJeAktieSerie, 5),
      interestCoverage,
      sbcOcfPct,
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
    const histPts = z.hist ?? []
    const eps5 = mittelLetzte(
      histPts.map((h) => h.eps),
      5,
      2,
      true,
    )
    const umsatz5 = mittelLetzte(
      histPts.map((h) => h.umsatzMio),
      5,
      2,
      true,
    )
    const ek5 = mittelLetzte(
      histPts.map((h) => h.ekMio),
      5,
      2,
      true,
    )
    z.kgv5y = runde(kurs != null && eps5 != null && eps5 > 0 ? kurs / eps5 : null)
    z.kuv5y = runde(mcapMio != null && umsatz5 != null && umsatz5 > 0 ? mcapMio / umsatz5 : null)
    z.kbv5y = runde(mcapMio != null && ek5 != null && ek5 > 0 ? mcapMio / ek5 : null)
    z.sektor = q?.sektor ?? null
    z.industrie = q?.industrie ?? null
    const wacc = schaetzeWaccPct({
      beta: q?.beta,
      marketCapUsd: q?.marktkap,
      totalDebtUsd: z.debtMio != null ? z.debtMio * 1_000_000 : null,
      interestExpenseUsd: zinsUsdByCik.get(z.cik) ?? null,
    })
    z.waccPct = wacc != null ? runde(wacc) : null
    z.incrementalValueSpreadPct =
      z.iroicPct != null && z.waccPct != null ? runde(z.iroicPct - z.waccPct) : null
    // hist nur für den Build — nicht im Snapshot speichern (Postgres-Timeout).
    delete z.hist
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

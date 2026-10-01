/**
 * SEC XBRL Frames → Universum aller an Nasdaq/NYSE/CBOE gelisteten Filer.
 * Pro Titel die komplette Kalenderjahr-Reihe ab Frame-Start (XBRL-Ära ~2009).
 * Pacing ≤10 Req/s ist SEC-Vorgabe — wir drosseln und retryen, statt Jahre wegzulassen.
 */

import 'server-only'

import { leseAlsJson } from '@/lib/http/safe-json-response'
import { aktienreiheSplitBereinigt } from '@/lib/portfolio-analyse/fundamentaldaten-format'
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
  cogs?: number
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

/** Mittel der Werte in [endJahr − fenster + 1 … endJahr]; mind. minN. */
function mittelKalenderFenster(
  punkte: Array<{ jahr: number; val: number | null | undefined }>,
  endJahr: number,
  fenster = 5,
  minN = 2,
  nurPositiv = false,
): number | null {
  const von = endJahr - fenster + 1
  const genommen: number[] = []
  for (const p of punkte) {
    if (p.jahr < von || p.jahr > endJahr) continue
    const v = p.val
    if (v == null || !Number.isFinite(v)) continue
    if (nurPositiv && !(v > 0)) continue
    genommen.push(v)
  }
  if (genommen.length < minN) return null
  return genommen.reduce((a, b) => a + b, 0) / genommen.length
}

function median(werte: number[]): number | null {
  if (werte.length === 0) return null
  const s = [...werte].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/**
 * CAGR exakt über fenster Kalenderjahre (Start = Ende − fenster).
 * Keine Lücken-Kompression, kein „irgendein positives Jahr in der Nähe“.
 */
function cagr(
  serie: { jahr: number; val: number }[],
  fenster: number,
  minEndJahr: number,
): number | null {
  if (serie.length < 2) return null
  const last = serie[serie.length - 1]!
  if (last.jahr < minEndJahr || !(last.val > 0)) return null
  const start = serie.find((p) => p.jahr === last.jahr - fenster)
  if (!start || !(start.val > 0)) return null
  return runde((Math.pow(last.val / start.val, 1 / fenster) - 1) * 100)
}

/** Kontinuierliche Jahre vom aktuellen Ende rückwärts. */
function kontigueVomEnde(serie: { jahr: number }[]): { n: number; von: number; bis: number } | null {
  if (serie.length === 0) return null
  const bis = serie[serie.length - 1]!.jahr
  let n = 1
  for (let i = serie.length - 1; i > 0; i--) {
    if (serie[i]!.jahr - serie[i - 1]!.jahr === 1) n++
    else break
  }
  return { n, von: bis - n + 1, bis }
}

/** Verwässerung p.a. aus Folgejahren (nicht Array-Schritten ohne Kalenderjahr). */
function aktienCagrPaare(
  punkte: Array<{ jahr: number; aktienMio?: number | null }>,
  minEndJahr: number,
): number | null {
  const serie = punkte
    .filter((p) => p.aktienMio != null && p.aktienMio > 0)
    .map((p) => ({ jahr: p.jahr, val: p.aktienMio! }))
  if (serie.length < 2) return null
  const clean = aktienreiheSplitBereinigt(serie.map((s) => s.val))
  const mitJahr = serie.map((s, i) => ({ jahr: s.jahr, val: clean[i]! }))
  const last = mitJahr[mitJahr.length - 1]!
  if (last.jahr < minEndJahr) return null
  const deltas: number[] = []
  for (let i = mitJahr.length - 1; i > 0 && deltas.length < 5; i--) {
    const a = mitJahr[i - 1]!
    const b = mitJahr[i]!
    if (b.jahr - a.jahr !== 1 || !(a.val > 0) || !(b.val > 0)) break
    deltas.push(b.val / a.val - 1)
  }
  if (deltas.length < 2) return null
  const geo = deltas.reduce((p, r) => p * (1 + r), 1)
  return runde((Math.pow(geo, 1 / deltas.length) - 1) * 100, 2)
}

function baueDebtMap(parts: {
  ltDebtNc: Map<number, number>
  ltDebtLease: Map<number, number>
  ltDebt: Map<number, number>
  debtCur: Map<number, number>
  ltDebtCur: Map<number, number>
  ltDebtLeaseCur: Map<number, number>
  shortBorrow: Map<number, number>
  commercialPaper: Map<number, number>
  leaseLt: Map<number, number>
  leaseSt: Map<number, number>
  financeLeaseLt: Map<number, number>
  financeLeaseSt: Map<number, number>
}): Map<number, number> {
  const out = new Map<number, number>()
  const ciks = new Set<number>()
  for (const m of Object.values(parts)) for (const cik of m.keys()) ciks.add(cik)
  for (const cik of ciks) {
    const nc = parts.ltDebtNc.get(cik)
    const combined = parts.ltDebtLease.get(cik)
    const plain = parts.ltDebt.get(cik)
    // Combined = LT + Finance-Leases → Finance-Tags nicht nochmal addieren.
    const ltQuelle: 'nc' | 'combined' | 'plain' | 'none' =
      nc != null ? 'nc' : combined != null ? 'combined' : plain != null ? 'plain' : 'none'
    const lt = nc ?? combined ?? plain ?? 0

    let st = 0
    if (parts.debtCur.has(cik)) {
      st = parts.debtCur.get(cik)!
    } else {
      st += parts.shortBorrow.get(cik) ?? 0
      st += parts.commercialPaper.get(cik) ?? 0
      if (ltQuelle === 'combined') {
        st += parts.ltDebtLeaseCur.get(cik) ?? parts.ltDebtCur.get(cik) ?? 0
      } else if (ltQuelle !== 'none') {
        st += parts.ltDebtCur.get(cik) ?? 0
      }
    }

    // Operating-Leases (ASC 842) sind nie im Debt-Tag.
    let lease = (parts.leaseLt.get(cik) ?? 0) + (parts.leaseSt.get(cik) ?? 0)
    if (ltQuelle !== 'combined') {
      lease += parts.financeLeaseLt.get(cik) ?? 0
      if (!parts.debtCur.has(cik)) lease += parts.financeLeaseSt.get(cik) ?? 0
    }

    const sum = lt + st + lease
    if (
      sum !== 0 ||
      ltQuelle !== 'none' ||
      parts.debtCur.has(cik) ||
      parts.leaseLt.has(cik) ||
      parts.leaseSt.has(cik) ||
      parts.financeLeaseLt.has(cik)
    ) {
      out.set(cik, sum)
    }
  }
  return out
}

async function sleepMs(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

/**
 * Ein Frames-Endpoint — bei 429/503/5xx retryen.
 * 404 / hartnäckiges Rate-Limit → leere Map (Jahr/Tag fehlt), Build läuft weiter.
 */
async function ladeFrame(taxonomy: string, tag: string, unit: string, periode: string): Promise<Map<number, number>> {
  const url = `https://data.sec.gov/api/xbrl/frames/${taxonomy}/${tag}/${unit}/${periode}.json`
  const out = new Map<number, number>()
  let warteMs = 400
  for (let versuch = 0; versuch < 12; versuch++) {
    const res = await secFetch(url)
    if (res.status === 404) return out
    if (res.status === 429 || res.status === 503 || res.status >= 500) {
      const ra = res.headers.get('retry-after')
      const ausHeader =
        ra && /^\d+(\.\d+)?$/.test(ra.trim()) ? Math.ceil(Number(ra.trim()) * 1000) : null
      await sleepMs(ausHeader ?? warteMs)
      warteMs = Math.min(20_000, Math.round(warteMs * 1.4))
      continue
    }
    if (!res.ok) {
      // z. B. 400 für nicht existierende Tag/Unit-Kombis in frühen Jahren
      return out
    }
    const json = await leseAlsJson<FrameJson>(res)
    for (const e of json?.data ?? []) {
      if (e.cik == null || e.val == null || !Number.isFinite(e.val)) continue
      const prev = out.get(e.cik)
      if (prev == null || Math.abs(e.val) > Math.abs(prev)) out.set(e.cik, e.val)
    }
    return out
  }
  console.warn(`[screener] SEC Frame nach Retries übersprungen: ${taxonomy}/${tag}/${periode}`)
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

export type ScreenerBuildProgress = {
  phase: 'start' | 'jahr' | 'kennzahlen' | 'kurse' | 'speichern'
  jahr?: number
  vonJahr?: number
  bisJahr?: number
  jahreFertig?: number
  jahreGesamt?: number
  message?: string
}

export async function baueScreenerSnapshot(opts?: {
  onProgress?: (p: ScreenerBuildProgress) => void
  /** Soft-Deadline für SEC-Jahre (Rest für Kennzahlen/Yahoo/Save). Default ~3,5 Min. */
  budgetMs?: number
}): Promise<ScreenerSnapshot> {
  const t0 = Date.now()
  const budgetMs = opts?.budgetMs ?? 210_000
  const bisJahr = await neuestesDauerJahr()
  const ticker = await ladeUsBoersenTicker()
  const perCik = new Map<number, Map<number, JahrRoh>>()
  const jahreGesamt = bisJahr - ERSTES_FRAME_JAHR + 1
  opts?.onProgress?.({
    phase: 'start',
    bisJahr,
    vonJahr: ERSTES_FRAME_JAHR,
    jahreGesamt,
    message: `Lade SEC-Frames CY${bisJahr}…${ERSTES_FRAME_JAHR}`,
  })

  // Neueste Jahre zuerst — bei Zeitdruck bleiben aktuelle CAGRs erhalten.
  let jahreFertig = 0
  let aeltestesGeladen: number | null = null
  for (let jahr = bisJahr; jahr >= ERSTES_FRAME_JAHR; jahr--) {
    if (Date.now() - t0 > budgetMs && jahreFertig >= 6) {
      console.warn(`[screener] Zeitbudget — stoppe bei CY${jahr + 1} (${jahreFertig} Jahre geladen)`)
      opts?.onProgress?.({
        phase: 'jahr',
        jahr,
        jahreFertig,
        jahreGesamt,
        message: `Zeitbudget: Historie ab CY${aeltestesGeladen ?? jahr + 1} (neueste ${jahreFertig} Jahre)`,
      })
      break
    }
    const dauer = `CY${jahr}`
    const stichtag = `CY${jahr}Q4I`
    console.info(`[screener] SEC-Frames ${dauer} …`)
    opts?.onProgress?.({
      phase: 'jahr',
      jahr,
      bisJahr,
      vonJahr: ERSTES_FRAME_JAHR,
      jahreFertig,
      jahreGesamt,
      message: `SEC ${dauer} (${jahreFertig + 1}/${jahreGesamt})`,
    })
    const [
      umsatzRev,
      umsatzSales,
      umsatzAsc,
      umsatzAscTax,
      ebit,
      ebitAlt,
      ni,
      ocf,
      ocfCont,
      capex,
      capexProd,
      capexOther,
      capexImp,
      capexSoft,
      capexSoftDev,
      capexSoftAcq,
      eps,
      ek,
      ekNc,
      assets,
      cogs,
      cogsRev,
      cogsSold,
    ] = await Promise.all([
      ladeFrame('us-gaap', 'Revenues', 'USD', dauer),
      ladeFrame('us-gaap', 'SalesRevenueNet', 'USD', dauer),
      ladeFrame('us-gaap', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'USD', dauer),
      ladeFrame('us-gaap', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'USD', dauer),
      ladeFrame('us-gaap', 'OperatingIncomeLoss', 'USD', dauer),
      ladeFrame('us-gaap', 'ProfitLossFromOperatingActivities', 'USD', dauer),
      ladeFrame('us-gaap', 'NetIncomeLoss', 'USD', dauer),
      ladeFrame('us-gaap', 'NetCashProvidedByUsedInOperatingActivities', 'USD', dauer),
      ladeFrame('us-gaap', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations', 'USD', dauer),
      ladeFrame('us-gaap', 'PaymentsToAcquirePropertyPlantAndEquipment', 'USD', dauer),
      ladeFrame('us-gaap', 'PaymentsToAcquireProductiveAssets', 'USD', dauer),
      ladeFrame('us-gaap', 'PaymentsToAcquireOtherPropertyPlantAndEquipment', 'USD', dauer),
      ladeFrame('us-gaap', 'PaymentsForCapitalImprovements', 'USD', dauer),
      ladeFrame('us-gaap', 'PaymentsForSoftware', 'USD', dauer),
      ladeFrame('us-gaap', 'PaymentsToDevelopSoftware', 'USD', dauer),
      ladeFrame('us-gaap', 'PaymentsToAcquireSoftware', 'USD', dauer),
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
      ladeFrame('us-gaap', 'CostOfGoodsSold', 'USD', dauer),
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
      financeLeaseLt,
      financeLeaseSt,
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
      ladeFrame('us-gaap', 'FinanceLeaseLiabilityNoncurrent', 'USD', stichtag),
      ladeFrame('us-gaap', 'FinanceLeaseLiabilityCurrent', 'USD', stichtag),
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
    const ebitGesamt = mergen(ebit, ebitAlt)
    const capexPpe = mergen(capex, capexProd, capexOther, capexImp)
    const capexSoftware = mergen(capexSoft, capexSoftDev, capexSoftAcq)
    const capexGesamt = addMaps(capexPpe, capexSoftware)
    const ocfGesamt = mergen(ocf, ocfCont)
    const ekGesamt = mergen(ek, ekNc)
    const sharesGesamt = mergen(shares, sharesBasic)
    const debt = baueDebtMap({
      ltDebtNc,
      ltDebtLease,
      ltDebt,
      debtCur,
      ltDebtCur,
      ltDebtLeaseCur,
      shortBorrow,
      commercialPaper,
      leaseLt,
      leaseSt,
      financeLeaseLt,
      financeLeaseSt,
    })
    const cashTeile = addMaps(cash, mergen(sti, stiOther))
    // Größeren Cash+STI-Wert wählen (Combined-Tag vs. Summe der Teile).
    const cashGesamt = new Map(cashSti)
    for (const [cik, val] of cashTeile) {
      const prev = cashGesamt.get(cik)
      if (prev == null || Math.abs(val) > Math.abs(prev)) cashGesamt.set(cik, val)
    }
    const daGesamt = mergen(da, da2, da3)
    const zinsGesamt = mergen(zins, zinsDebt, zinsNonop, zinsAndDebt)
    const sbcGesamt = mergen(sbc, sbc2)
    const cogsGesamt = mergen(cogs, cogsRev, cogsSold)
    // Bruttogewinn: Tag zuerst, sonst Umsatz − COGS
    const gpGesamt = new Map(gp)
    for (const [cik, u] of umsatz) {
      if (gpGesamt.has(cik)) continue
      const c = cogsGesamt.get(cik)
      if (c == null || !(u > 0)) continue
      const brutto = u - Math.abs(c)
      if (Number.isFinite(brutto)) gpGesamt.set(cik, brutto)
    }
    for (const [cik, val] of umsatz) setz(perCik, cik, jahr, 'umsatz', val)
    for (const [cik, val] of ebitGesamt) setz(perCik, cik, jahr, 'ebit', val)
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
    for (const [cik, val] of cogsGesamt) setz(perCik, cik, jahr, 'cogs', val)
    for (const [cik, val] of zinsGesamt) setz(perCik, cik, jahr, 'zins', val)
    for (const [cik, val] of sbcGesamt) setz(perCik, cik, jahr, 'sbc', val)
    jahreFertig++
    aeltestesGeladen = jahr
  }

  opts?.onProgress?.({ phase: 'kennzahlen', message: 'Kennzahlen berechnen…', jahreFertig, jahreGesamt })

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
      // FCF nur mit OCF und CapEx — fehlendes CapEx ≠ 0
      const fcfMio =
        ocfMio == null || capexMio == null
          ? null
          : Math.round((ocfMio - Math.abs(capexMio)) * 10) / 10
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
      // Brutto an bereinigten Umsatz koppeln (sonst GP-Tag auf Brutto-ASC / Netto-Umsatz)
      const h = hist[i]!
      const r = jahreMap.get(h.jahr)!
      const cogsMio = zuMio(r.cogs)
      if (h.umsatzMio != null && cogsMio != null) {
        r.gp = (h.umsatzMio - Math.abs(cogsMio)) * 1_000_000
      } else if (h.umsatzMio != null && r.gp != null && zuMio(r.umsatz) != null && zuMio(r.umsatz)! > 0) {
        const faktor = h.umsatzMio / zuMio(r.umsatz)!
        if (faktor > 0 && faktor < 1.01) r.gp = r.gp * faktor
      }
    }
    const umsatzSerie = hist
      .filter((p) => p.umsatzMio != null && p.umsatzMio > 0)
      .map((p) => ({ jahr: p.jahr, val: p.umsatzMio! }))
    if (umsatzSerie.length === 0) continue
    // Kennzahlen/CAGR immer am aktuellen Ende — veraltete Serien (z. B. nur bis 2013) raus.
    const minEndJahr = bisJahr - 1
    const lastU = umsatzSerie[umsatzSerie.length - 1]!
    if (lastU.jahr < minEndJahr) continue
    const last = hist.find((p) => p.jahr === lastU.jahr)!
    const vor = hist.find((p) => p.jahr === lastU.jahr - 1) ?? null
    const lastRoh = jahreMap.get(last.jahr)!
    const epsSerie = hist.filter((p) => p.eps != null && p.eps > 0).map((p) => ({ jahr: p.jahr, val: p.eps! }))
    const fcfSerie = hist.filter((p) => p.fcfMio != null && p.fcfMio > 0).map((p) => ({ jahr: p.jahr, val: p.fcfMio! }))
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
    const aktienVerwaesserungJaehrlichPct = aktienCagrPaare(hist, minEndJahr)
    // Rule of 40 (FCF-Variante): Wachstum + FCF-Marge
    const ruleOf40 =
      umsatzWachstumPct == null || fcfMargePct == null
        ? null
        : runde(umsatzWachstumPct + fcfMargePct)
    // Brutto auf bereinigtem Umsatz
    const bruttoSerie: number[] = []
    const niMargeLetzte5: number[] = []
    for (let i = 0; i < hist.length; i++) {
      const h = hist[i]!
      const r = jahreMap.get(h.jahr)!
      const m = pct(zuMio(r.gp), h.umsatzMio)
      if (m != null) bruttoSerie.push(m)
      const niM = pct(h.niMio, h.umsatzMio)
      if (niM != null && h.jahr >= lastU.jahr - 4) niMargeLetzte5.push(niM)
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
    // Zinsdeckung: EBIT / |Zins|. Ohne Zinsaufwand → null (kein Fake-999).
    let interestCoverage: number | null = null
    if (last.ebitMio != null && zinsMio != null && Math.abs(zinsMio) > 0.05) {
      interestCoverage = runde(last.ebitMio / Math.abs(zinsMio), 1)
    }
    const sbcMio = zuMio(lastRoh.sbc)
    const ocfMioNow = zuMio(lastRoh.ocf)
    const sbcOcfPct =
      sbcMio != null && ocfMioNow != null && ocfMioNow > 0
        ? runde((Math.abs(sbcMio) / ocfMioNow) * 100)
        : null
    const iroicPct = iroicAusJahresreihe(hist, minEndJahr)
    const roic5yAvgPct = roic5ySchnitt(hist, lastU.jahr)
    if (zinsMio != null) zinsUsdByCik.set(cik, Math.abs(zinsMio) * 1_000_000)
    const track = kontigueVomEnde(umsatzSerie)
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
      umsatzCagr3y: cagr(umsatzSerie, 3, minEndJahr),
      umsatzCagr5y: cagr(umsatzSerie, 5, minEndJahr),
      umsatzCagr10y: cagr(umsatzSerie, 10, minEndJahr),
      epsCagr5y: cagr(epsSerie, 5, minEndJahr),
      fcfCagr5y: cagr(fcfSerie, 5, minEndJahr),
      ruleOf40,
      niMargeMedian: runde(median(niMargeLetzte5)),
      aktienVerwaesserungJaehrlichPct,
      netDebtMio,
      netDebtEbitda,
      iroicPct,
      roic5yAvgPct,
      bruttoMargePct,
      bruttoMargeStabil: bruttoStab.pricingPowerOk,
      reinvestitionsquotePct,
      fcfJeAktieCagr5y: cagr(fcfJeAktieSerie, 5, minEndJahr),
      interestCoverage,
      sbcOcfPct,
      jahreAnzahl: track?.n ?? umsatzSerie.length,
      vonJahr: track?.von ?? umsatzSerie[0]?.jahr ?? null,
      bisJahr: track?.bis ?? lastU.jahr,
      kurs: null,
      marktkapMio: null,
      kgv: null,
      kuv: null,
      kbv: null,
      hist,
    })
  }

  opts?.onProgress?.({ phase: 'kurse', message: 'Yahoo-Kurse & Multiples…', jahreFertig, jahreGesamt })
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
    const endJahr = z.bisJahr ?? histPts.at(-1)?.jahr
    const eps5 =
      endJahr != null
        ? mittelKalenderFenster(
            histPts.map((h) => ({ jahr: h.jahr, val: h.eps })),
            endJahr,
            5,
            2,
            true,
          )
        : null
    const umsatz5 =
      endJahr != null
        ? mittelKalenderFenster(
            histPts.map((h) => ({ jahr: h.jahr, val: h.umsatzMio })),
            endJahr,
            5,
            2,
            true,
          )
        : null
    const ek5 =
      endJahr != null
        ? mittelKalenderFenster(
            histPts.map((h) => ({ jahr: h.jahr, val: h.ekMio })),
            endJahr,
            5,
            2,
            true,
          )
        : null
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

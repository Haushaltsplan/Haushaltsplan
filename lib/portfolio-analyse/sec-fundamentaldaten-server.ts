/**
 * SEC Company Facts → MacrotrendsFundamentalRoh (GuV/Bilanz/CF, 10+ Jahre).
 * Bewertungs-Multiples (KGV/KUV/…) kommen danach aus Yahoo-Kursen, nicht aus SEC.
 */

import 'server-only'

import { leseAlsJson } from '@/lib/http/safe-json-response'
import { FUNDAMENTAL_TTM_KEY, type FundamentalFrequenz, type FundamentalMetrikZeile, type FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { aktienreiheSplitBereinigt, formatFundamentalPeriodeLabel } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import { ergaenzeNettoverschuldungZeilen } from '@/lib/portfolio-analyse/fundamentaldaten-nettoverschuldung-zeilen'
import { cikFuerTicker, padCik, secFetch } from '@/lib/portfolio-analyse/sec-edgar-common-server'
import { UMSATZ_TAG_KETTE, wendeUmsatzGrossVsNetAufTreffer } from '@/lib/portfolio-analyse/sec-umsatz-netto'
import type { MacrotrendsFundamentalRoh, MacrotrendsIdent } from '@/lib/portfolio-analyse/macrotrends-scraper-server'

const CACHE_MS = 24 * 60 * 60 * 1000
const JAHRESFORMULARE = new Set(['10-K', '10-K/A', '20-F', '20-F/A', '40-F', '40-F/A'])
const QUARTALSFORMULARE = new Set(['10-Q', '10-Q/A', '6-K'])

type FactsUnit = {
  start?: string
  end?: string
  val?: number
  fy?: number
  fp?: string
  form?: string
  filed?: string
}

type CompanyFactsJson = {
  facts?: Record<string, Record<string, { units?: Record<string, FactsUnit[]> }>>
}

type SecFeld =
  | 'umsatz'
  | 'bruttogewinn'
  | 'cogs'
  | 'ebit'
  | 'nettogewinn'
  | 'eps'
  | 'rd'
  | 'sga'
  | 'sbc'
  | 'aktien'
  | 'ocf'
  | 'capex'
  | 'da'
  | 'aktienrueckkauf'
  | 'dividenden_gezahlt'
  | 'akquisitionen'
  | 'gesamtvermoegen'
  | 'gesamtverbindlichkeiten'
  | 'eigenkapital'
  | 'langfristigeSchulden'
  | 'kurzfristigeSchulden'
  | 'bargeld'
  | 'forderungen'
  | 'vorraete'
  | 'goodwill'
  | 'intangibles'
  | 'umlaufvermoegen'
  | 'kurzfrist_verbindl'

const STROMFELDER = new Set<SecFeld>([
  'umsatz',
  'bruttogewinn',
  'cogs',
  'ebit',
  'nettogewinn',
  'eps',
  'rd',
  'sga',
  'sbc',
  'aktien',
  'ocf',
  'capex',
  'da',
  'aktienrueckkauf',
  'dividenden_gezahlt',
  'akquisitionen',
])

/** TTM = Summe der letzten 4 Quartale. Aktienzahl ist ein Bestand, nicht addieren. */
const TTM_SUMME = new Set<SecFeld>([
  'umsatz',
  'bruttogewinn',
  'cogs',
  'ebit',
  'nettogewinn',
  'eps',
  'rd',
  'sga',
  'sbc',
  'ocf',
  'capex',
  'da',
  'aktienrueckkauf',
  'dividenden_gezahlt',
  'akquisitionen',
])

/** 10-Q-Cashflow/GuV oft YTD — Quartale per Differenz H1−Q1, 9M−H1, FY−9M. EPS/WAS nicht additiv. */
const YTD_DIFFERENZ = new Set<SecFeld>([
  'umsatz',
  'bruttogewinn',
  'cogs',
  'ebit',
  'nettogewinn',
  'rd',
  'sga',
  'sbc',
  'ocf',
  'capex',
  'da',
  'aktienrueckkauf',
  'dividenden_gezahlt',
  'akquisitionen',
])

const NEGATIV_ERLAUBT = new Set<SecFeld>([
  'ebit',
  'nettogewinn',
  'eps',
  'ocf',
  'capex',
  'sbc',
  'da',
  'aktienrueckkauf',
  'dividenden_gezahlt',
  'akquisitionen',
  'eigenkapital',
])

const ABFLUSS = new Set<SecFeld>(['capex', 'aktienrueckkauf', 'dividenden_gezahlt', 'akquisitionen'])

const TAG_KETTEN: Record<SecFeld, string[]> = {
  umsatz: [...UMSATZ_TAG_KETTE],
  bruttogewinn: ['GrossProfit'],
  cogs: [
    'CostOfGoodsAndServicesSold',
    'CostOfRevenue',
    'CostOfGoodsSold',
    'CostOfGoodsAndServiceExcludingDepreciationDepletionAndAmortization',
  ],
  ebit: ['OperatingIncomeLoss', 'ProfitLossFromOperatingActivities'],
  nettogewinn: ['NetIncomeLoss', 'ProfitLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic'],
  eps: ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted', 'EarningsPerShareBasic'],
  rd: ['ResearchAndDevelopmentExpense', 'ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost'],
  sga: [
    'SellingGeneralAndAdministrativeExpense',
    'SellingAndMarketingExpense',
    'GeneralAndAdministrativeExpense',
  ],
  sbc: [
    'ShareBasedCompensation',
    'AllocatedShareBasedCompensationExpense',
    'SharebasedCompensationArrangementBySharebasedPaymentAwardCompensationCost',
  ],
  aktien: [
    'WeightedAverageNumberOfDilutedSharesOutstanding',
    'WeightedAverageNumberOfShareOutstandingBasicAndDiluted',
    'CommonStockSharesOutstanding',
  ],
  ocf: [
    'NetCashProvidedByUsedInOperatingActivities',
    'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
  ],
  capex: [
    'PaymentsToAcquirePropertyPlantAndEquipment',
    'PaymentsToAcquireProductiveAssets',
    'PaymentsForCapitalImprovements',
    'PurchaseOfPropertyPlantAndEquipment',
  ],
  da: [
    'DepreciationDepletionAndAmortization',
    'DepreciationAmortizationAndAccretionNet',
    'DepreciationAndAmortization',
    'Depreciation',
  ],
  aktienrueckkauf: [
    'PaymentsForRepurchaseOfCommonStock',
    'PaymentsForRepurchaseOfEquity',
    'TreasuryStockValueAcquiredCostMethod',
  ],
  dividenden_gezahlt: [
    'PaymentsOfDividends',
    'PaymentsOfDividendsCommonStock',
    'PaymentsOfOrdinaryDividends',
    'DividendsPaid',
  ],
  akquisitionen: [
    'PaymentsToAcquireBusinessesNetOfCashAcquired',
    'PaymentsToAcquireBusinessesAndInterestInAffiliates',
    'PaymentsToAcquireBusinessesGross',
  ],
  gesamtvermoegen: ['Assets'],
  gesamtverbindlichkeiten: ['Liabilities', 'LiabilitiesAndStockholdersEquity'],
  eigenkapital: [
    'StockholdersEquity',
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
    'EquityAttributableToOwnersOfParent',
    'Equity',
  ],
  langfristigeSchulden: [
    'LongTermDebtNoncurrent',
    'LongTermDebtAndCapitalLeaseObligations',
    'LongTermDebt',
    'LongTermBorrowings',
  ],
  kurzfristigeSchulden: [
    'LongTermDebtCurrent',
    'LongTermDebtAndCapitalLeaseObligationsCurrent',
    'DebtCurrent',
    'ShortTermBorrowings',
    'CommercialPaper',
  ],
  bargeld: [
    'CashAndCashEquivalentsAtCarryingValue',
    'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents',
    'CashAndCashEquivalents',
  ],
  forderungen: [
    'AccountsReceivableNetCurrent',
    'AccountsReceivableNet',
    'ReceivablesNetCurrent',
    'TradeAndOtherCurrentReceivables',
  ],
  vorraete: ['InventoryNet', 'Inventory'],
  goodwill: ['Goodwill'],
  intangibles: [
    'IntangibleAssetsNetExcludingGoodwill',
    'FiniteLivedIntangibleAssetsNet',
    'IndefiniteLivedIntangibleAssetsExcludingGoodwill',
  ],
  umlaufvermoegen: ['AssetsCurrent'],
  kurzfrist_verbindl: ['LiabilitiesCurrent'],
}

type ZeileDef = {
  id: string
  feld?: SecFeld
  label: string
  gruppe: FundamentalMetrikZeile['gruppe']
  einheit: FundamentalMetrikZeile['einheit']
  statement: NonNullable<FundamentalMetrikZeile['macrotrendsStatement']>
  slug?: string
}

const ZEILEN: ZeileDef[] = [
  { id: 'umsatz', feld: 'umsatz', label: 'Umsatz', gruppe: 'finanzdaten', einheit: 'waehrung_usd_mio', statement: 'income-statement', slug: 'revenue' },
  { id: 'bruttogewinn', feld: 'bruttogewinn', label: 'Bruttogewinn', gruppe: 'finanzdaten', einheit: 'waehrung_usd_mio', statement: 'income-statement', slug: 'gross-profit' },
  { id: 'ebitda', label: 'EBITDA', gruppe: 'finanzdaten', einheit: 'waehrung_usd_mio', statement: 'income-statement', slug: 'ebitda' },
  { id: 'ebit', feld: 'ebit', label: 'EBIT', gruppe: 'finanzdaten', einheit: 'waehrung_usd_mio', statement: 'income-statement', slug: 'operating-income' },
  { id: 'nettogewinn', feld: 'nettogewinn', label: 'Nettogewinn', gruppe: 'finanzdaten', einheit: 'waehrung_usd_mio', statement: 'income-statement', slug: 'net-income' },
  { id: 'eps', feld: 'eps', label: 'EPS (verwässert)', gruppe: 'finanzdaten', einheit: 'waehrung_usd_aktie', statement: 'income-statement', slug: 'eps-earnings-per-share-diluted' },
  { id: 'rd', feld: 'rd', label: 'Forschung & Entwicklung (R&D)', gruppe: 'finanzdaten', einheit: 'waehrung_usd_mio', statement: 'income-statement', slug: 'research-development-expenses' },
  { id: 'sga', feld: 'sga', label: 'SG&A (Vertrieb & Verwaltung)', gruppe: 'finanzdaten', einheit: 'waehrung_usd_mio', statement: 'income-statement', slug: 'selling-general-administrative-expenses' },
  { id: 'aktien', feld: 'aktien', label: 'Ausstehende Aktien', gruppe: 'finanzdaten', einheit: 'aktien_mio', statement: 'income-statement', slug: 'shares-outstanding' },
  { id: 'ocf', feld: 'ocf', label: 'Operativer Cashflow', gruppe: 'cashflow', einheit: 'waehrung_usd_mio', statement: 'cash-flow-statement', slug: 'cash-flow-from-operating-activities' },
  { id: 'capex', feld: 'capex', label: 'CapEx (Investitionen)', gruppe: 'cashflow', einheit: 'waehrung_usd_mio', statement: 'cash-flow-statement', slug: 'net-change-in-property-plant-equipment' },
  { id: 'sbc', feld: 'sbc', label: 'Stock-Based Compensation (SBC)', gruppe: 'cashflow', einheit: 'waehrung_usd_mio', statement: 'cash-flow-statement', slug: 'stock-based-compensation' },
  { id: 'da', feld: 'da', label: 'Abschreibungen (D&A)', gruppe: 'cashflow', einheit: 'waehrung_usd_mio', statement: 'cash-flow-statement', slug: 'depreciation-amortization' },
  { id: 'aktienrueckkauf', feld: 'aktienrueckkauf', label: 'Aktienrückkäufe', gruppe: 'cashflow', einheit: 'waehrung_usd_mio', statement: 'cash-flow-statement', slug: 'common-stock-repurchased' },
  { id: 'dividenden_gezahlt', feld: 'dividenden_gezahlt', label: 'Gezahlte Dividenden', gruppe: 'cashflow', einheit: 'waehrung_usd_mio', statement: 'cash-flow-statement', slug: 'common-stock-dividends-paid' },
  { id: 'gesamtvermoegen', feld: 'gesamtvermoegen', label: 'Gesamtvermögen', gruppe: 'bilanz', einheit: 'waehrung_usd_mio', statement: 'balance-sheet', slug: 'total-assets' },
  { id: 'gesamtverbindlichkeiten', feld: 'gesamtverbindlichkeiten', label: 'Gesamtverbindlichkeiten', gruppe: 'bilanz', einheit: 'waehrung_usd_mio', statement: 'balance-sheet', slug: 'total-liabilities' },
  { id: 'eigenkapital', feld: 'eigenkapital', label: 'Eigenkapital', gruppe: 'bilanz', einheit: 'waehrung_usd_mio', statement: 'balance-sheet', slug: 'total-share-holder-equity' },
  { id: 'gesamtverschuldung', label: 'Gesamtverschuldung', gruppe: 'bilanz', einheit: 'waehrung_usd_mio', statement: 'balance-sheet', slug: 'total-debt' },
  { id: 'bargeld', feld: 'bargeld', label: 'Bargeld & Äquivalente', gruppe: 'bilanz', einheit: 'waehrung_usd_mio', statement: 'balance-sheet', slug: 'cash-on-hand' },
  { id: 'forderungen', feld: 'forderungen', label: 'Forderungen (netto)', gruppe: 'bilanz', einheit: 'waehrung_usd_mio', statement: 'balance-sheet', slug: 'receivables-total' },
  { id: 'vorraete', feld: 'vorraete', label: 'Vorräte', gruppe: 'bilanz', einheit: 'waehrung_usd_mio', statement: 'balance-sheet', slug: 'inventory' },
  { id: 'goodwill', feld: 'goodwill', label: 'Goodwill', gruppe: 'bilanz', einheit: 'waehrung_usd_mio', statement: 'balance-sheet', slug: 'goodwill' },
  { id: 'umlaufvermoegen', feld: 'umlaufvermoegen', label: 'Umlaufvermögen', gruppe: 'bilanz', einheit: 'waehrung_usd_mio', statement: 'balance-sheet', slug: 'total-current-assets' },
  { id: 'kurzfrist_verbindl', feld: 'kurzfrist_verbindl', label: 'Kurzfristige Verbindlichkeiten', gruppe: 'bilanz', einheit: 'waehrung_usd_mio', statement: 'balance-sheet', slug: 'total-current-liabilities' },
]

type Treffer = { wert: number; filed: string; periodenEnde: string }

const factsCache = new Map<number, { at: number; data: CompanyFactsJson | null }>()
const paketCache = new Map<string, { at: number; data: MacrotrendsFundamentalRoh | null }>()

function skalieren(feld: SecFeld, roh: number): number {
  if (feld === 'eps') return roh
  if (feld === 'aktien') return Math.abs(roh) >= 1_000_000 ? roh / 1_000_000 : roh
  return roh / 1_000_000
}

function baueJahresLabels(facts: CompanyFactsJson): Map<string, number> {
  const enden: string[] = []
  for (const [namensraum, tags] of Object.entries(facts.facts ?? {})) {
    if (namensraum === 'dei') continue
    for (const tag of Object.values(tags)) {
      for (const [einheit, liste] of Object.entries(tag.units ?? {})) {
        if (!/^[A-Z]{3}$/.test(einheit)) continue
        for (const e of liste ?? []) {
          if (e.fp !== 'FY' || !e.end) continue
          if (!e.form || !JAHRESFORMULARE.has(e.form)) continue
          enden.push(e.end)
        }
      }
    }
  }
  if (enden.length === 0) return new Map()

  const monatsZaehler = new Map<number, number>()
  for (const ende of enden) {
    const monat = Number.parseInt(ende.slice(5, 7), 10)
    if (!Number.isFinite(monat)) continue
    monatsZaehler.set(monat, (monatsZaehler.get(monat) ?? 0) + 1)
  }
  let stichtagMonat = 12
  let max = 0
  for (const [monat, n] of monatsZaehler) {
    if (n > max) {
      max = n
      stichtagMonat = monat
    }
  }

  const passendZumStichtag = (ende: string): boolean => {
    const monat = Number.parseInt(ende.slice(5, 7), 10)
    const tag = Number.parseInt(ende.slice(8, 10), 10)
    if (!Number.isFinite(monat) || !Number.isFinite(tag)) return false
    if (monat === stichtagMonat) return true
    if (monat === (stichtagMonat % 12) + 1 && tag <= 7) return true
    if (monat === ((stichtagMonat + 10) % 12) + 1 && tag >= 24) return true
    return false
  }

  const kandidaten = [...new Set(enden)].filter(passendZumStichtag)
  const besteEnde = new Map<number, string>()
  for (const ende of kandidaten) {
    const jahr = Number.parseInt(ende.slice(0, 4), 10)
    if (!Number.isFinite(jahr)) continue
    const alt = besteEnde.get(jahr)
    if (alt == null || ende > alt) besteEnde.set(jahr, ende)
  }

  const labels = new Map<string, number>()
  for (const [jahr, ende] of besteEnde) labels.set(ende, jahr)
  return labels
}

function ermittleWaehrung(facts: CompanyFactsJson): string {
  const zaehler = new Map<string, number>()
  for (const namespace of Object.values(facts.facts ?? {})) {
    for (const tag of Object.values(namespace)) {
      for (const [unit, liste] of Object.entries(tag.units ?? {})) {
        if (!/^[A-Z]{3}$/.test(unit)) continue
        zaehler.set(unit, (zaehler.get(unit) ?? 0) + (liste?.length ?? 0))
      }
    }
  }
  let beste = 'USD'
  let max = 0
  for (const [unit, n] of zaehler) {
    if (n > max) {
      max = n
      beste = unit
    }
  }
  return beste
}

function einheitenFuerFeld(
  tagObj: { units?: Record<string, FactsUnit[]> } | undefined,
  feld: SecFeld,
  waehrung: string,
): FactsUnit[] {
  const units = tagObj?.units
  if (!units) return []
  if (feld === 'eps') {
    const keys = Object.keys(units).filter((k) => /\/shares/i.test(k))
    const preferred = keys.find((k) => k.toUpperCase().startsWith(`${waehrung}/`)) ?? keys[0]
    return preferred ? (units[preferred] ?? []) : []
  }
  if (feld === 'aktien') {
    if (units.shares?.length) return units.shares
    const keys = Object.keys(units).filter((k) => /share/i.test(k))
    return keys[0] ? (units[keys[0]!] ?? []) : []
  }
  return units[waehrung] ?? []
}

function jahresreihe(
  facts: CompanyFactsJson,
  labels: Map<string, number>,
  waehrung: string,
  feld: SecFeld,
): Map<string, Treffer> {
  const out = new Map<string, Treffer>()
  const strom = STROMFELDER.has(feld)
  const negOk = NEGATIV_ERLAUBT.has(feld)

  for (const tag of TAG_KETTEN[feld]) {
    const perEnde = new Map<string, Treffer>()
    for (const namespace of Object.values(facts.facts ?? {})) {
      const liste = einheitenFuerFeld(namespace[tag], feld, waehrung)
      if (!liste.length) continue
      for (const e of liste) {
        if (!e.end || e.val == null || !Number.isFinite(e.val)) continue
        if (!e.form || !JAHRESFORMULARE.has(e.form)) continue
        if (strom) {
          if (feld === 'aktien' && !e.start) {
            if (e.fp && e.fp !== 'FY') continue
          } else {
            if (!e.start) continue
            const tage = (Date.parse(e.end) - Date.parse(e.start)) / 86_400_000
            if (tage < 330 || tage > 400) continue
          }
        } else if (e.start) {
          continue
        }
        if (labels.get(e.end) == null) continue
        if (!negOk && e.val < 0) continue
        const filed = e.filed ?? e.end
        const alt = perEnde.get(e.end)
        if (!alt || filed > alt.filed) {
          perEnde.set(e.end, { wert: skalieren(feld, e.val), filed, periodenEnde: e.end })
        }
      }
    }
    for (const [ende, treffer] of perEnde) {
      if (!out.has(ende)) out.set(ende, treffer)
    }
  }
  if (feld === 'aktien') wendeAktienSplitsAn(out)
  return out
}

function wendeAktienSplitsAn(reihe: Map<string, Treffer>): void {
  const keys = [...reihe.keys()].sort()
  if (keys.length < 2) return
  const vals = keys.map((k) => reihe.get(k)!.wert)
  const clean = aktienreiheSplitBereinigt(vals)
  for (let i = 0; i < keys.length; i++) {
    const t = reihe.get(keys[i]!)!
    reihe.set(keys[i]!, { ...t, wert: Math.round(clean[i]! * 1000) / 1000 })
  }
}

type Rohfakt = {
  end: string
  start?: string
  val: number
  filed: string
  tage: number | null
  form: string
}

function sammleRohfakten(facts: CompanyFactsJson, waehrung: string, feld: SecFeld): Rohfakt[] {
  const out: Rohfakt[] = []
  const negOk = NEGATIV_ERLAUBT.has(feld)
  const belegt = new Set<string>()
  for (const tag of TAG_KETTEN[feld]) {
    const best = new Map<string, Rohfakt>()
    for (const namespace of Object.values(facts.facts ?? {})) {
      const liste = einheitenFuerFeld(namespace[tag], feld, waehrung)
      if (!liste.length) continue
      for (const e of liste) {
        if (!e.end || e.val == null || !Number.isFinite(e.val)) continue
        if (!e.form || (!JAHRESFORMULARE.has(e.form) && !QUARTALSFORMULARE.has(e.form))) continue
        if (!negOk && e.val < 0) continue
        const tage = e.start ? (Date.parse(e.end) - Date.parse(e.start)) / 86_400_000 : null
        const tageOk = tage != null && Number.isFinite(tage) ? tage : null
        const k = rohPrioKey(e.end, tageOk, e.form)
        const fakt: Rohfakt = {
          end: e.end,
          start: e.start,
          val: e.val,
          filed: e.filed ?? e.end,
          tage: tageOk,
          form: e.form,
        }
        const alt = best.get(k)
        if (!alt || fakt.filed > alt.filed) best.set(k, fakt)
      }
    }
    for (const [k, fakt] of best) {
      if (belegt.has(k)) continue
      belegt.add(k)
      out.push(fakt)
    }
  }
  return out
}

function rohPrioKey(end: string, tage: number | null, form: string): string {
  const fam = form.startsWith('10-K') || form.startsWith('20-F') || form.startsWith('40-F') ? 'fy' : 'q'
  const bucket =
    tage == null ? 'inst' : tage < 140 ? 'q' : tage < 230 ? 'h1' : tage < 310 ? '9m' : 'fy'
  return `${end}|${fam}|${bucket}`
}

function besterRoh(liste: Rohfakt[]): Rohfakt | null {
  if (!liste.length) return null
  return liste.reduce((a, b) => (b.filed > a.filed ? b : a))
}

function setzeRaw(
  ziel: Map<string, { val: number; filed: string }>,
  end: string,
  val: number,
  filed: string,
) {
  if (!Number.isFinite(val)) return
  const alt = ziel.get(end)
  if (!alt || filed > alt.filed) ziel.set(end, { val, filed })
}

function quartalsreihe(facts: CompanyFactsJson, waehrung: string, feld: SecFeld): Map<string, Treffer> {
  const fakten = sammleRohfakten(facts, waehrung, feld)
  const raw = new Map<string, { val: number; filed: string }>()
  const strom = STROMFELDER.has(feld)

  if (feld === 'aktien') {
    for (const f of fakten) {
      if (!QUARTALSFORMULARE.has(f.form)) continue
      if (f.tage != null && f.tage >= 70 && f.tage <= 110) setzeRaw(raw, f.end, f.val, f.filed)
      else if (f.tage == null) setzeRaw(raw, f.end, f.val, f.filed)
    }
  } else {
    for (const f of fakten) {
      if (!QUARTALSFORMULARE.has(f.form)) continue
      if (strom) {
        if (f.tage == null || f.tage < 70 || f.tage > 110) continue
      } else if (f.tage != null) {
        continue
      }
      setzeRaw(raw, f.end, f.val, f.filed)
    }

    if (YTD_DIFFERENZ.has(feld)) {
      const byStart = new Map<string, Rohfakt[]>()
      for (const f of fakten) {
        if (f.tage == null || !f.start) continue
        const arr = byStart.get(f.start) ?? []
        arr.push(f)
        byStart.set(f.start, arr)
      }
      for (const [, liste] of byStart) {
        const q1f = besterRoh(liste.filter((f) => f.tage! >= 70 && f.tage! <= 110))
        const h1f = besterRoh(liste.filter((f) => f.tage! >= 160 && f.tage! <= 200))
        const m9f = besterRoh(liste.filter((f) => f.tage! >= 250 && f.tage! <= 290))
        const fyf = besterRoh(liste.filter((f) => f.tage! >= 330 && f.tage! <= 400))

        const q1 = q1f ? (raw.get(q1f.end)?.val ?? q1f.val) : null
        if (q1f && !raw.has(q1f.end)) setzeRaw(raw, q1f.end, q1f.val, q1f.filed)

        let q2: number | null = h1f ? (raw.get(h1f.end)?.val ?? null) : null
        if (q2 == null && h1f && q1 != null) {
          q2 = h1f.val - q1
          setzeRaw(raw, h1f.end, q2, h1f.filed)
        }

        let q3: number | null = m9f ? (raw.get(m9f.end)?.val ?? null) : null
        if (q3 == null && m9f) {
          if (q1 != null && q2 != null) q3 = m9f.val - q1 - q2
          else if (h1f) q3 = m9f.val - h1f.val
          if (q3 != null) setzeRaw(raw, m9f.end, q3, m9f.filed)
        }

        if (fyf && !raw.has(fyf.end)) {
          let q4: number | null = null
          if (m9f) q4 = fyf.val - m9f.val
          else if (q1 != null && q2 != null && q3 != null) q4 = fyf.val - q1 - q2 - q3
          if (q4 != null) setzeRaw(raw, fyf.end, q4, fyf.filed)
        }
      }
    }
  }

  const out = new Map<string, Treffer>()
  for (const [end, t] of raw) {
    out.set(end, { wert: skalieren(feld, t.val), filed: t.filed, periodenEnde: end })
  }
  if (feld === 'aktien') wendeAktienSplitsAn(out)
  return out
}

function vorzeichen(feld: SecFeld, wert: number): number {
  if (!ABFLUSS.has(feld)) return wert
  return wert <= 0 ? wert : -Math.abs(wert)
}

async function ladeFacts(cik: number): Promise<CompanyFactsJson | null> {
  const hit = factsCache.get(cik)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data
  try {
    const res = await secFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${padCik(cik)}.json`)
    if (!res.ok) {
      factsCache.set(cik, { at: Date.now(), data: null })
      return null
    }
    const facts = (await leseAlsJson<CompanyFactsJson>(res)) ?? null
    factsCache.set(cik, { at: Date.now(), data: facts })
    return facts
  } catch {
    factsCache.set(cik, { at: Date.now(), data: null })
    return null
  }
}

function bauePerioden(isoListe: string[], mitTtm: boolean, frequenz?: FundamentalFrequenz): FundamentalPeriode[] {
  const perioden: FundamentalPeriode[] = isoListe.map((iso) => ({
    iso,
    label: formatFundamentalPeriodeLabel(iso, frequenz),
  }))
  if (mitTtm) perioden.push({ iso: FUNDAMENTAL_TTM_KEY, label: 'TTM', istLtm: true })
  return perioden
}

function werteAusReihe(
  reihe: Map<string, Treffer> | undefined,
  feld: SecFeld | undefined,
  isoListe: string[],
  ttm: number | null,
): Record<string, number | null> {
  const out: Record<string, number | null> = {}
  for (const iso of isoListe) {
    const t = reihe?.get(iso)
    out[iso] = t != null && feld ? vorzeichen(feld, t.wert) : t?.wert ?? null
  }
  if (ttm !== undefined) out[FUNDAMENTAL_TTM_KEY] = ttm
  return out
}

function ttmAusQuartalen(
  reihe: Map<string, Treffer>,
  feld: SecFeld | undefined,
  modus: 'sum' | 'last',
): number | null {
  const sortiert = [...reihe.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  if (sortiert.length === 0) return null
  if (modus !== 'sum') {
    const last = sortiert[sortiert.length - 1]
    return last && feld ? vorzeichen(feld, last[1].wert) : last?.[1].wert ?? null
  }
  const letzte = sortiert.slice(-4)
  if (letzte.length < 4) return null
  const span =
    (Date.parse(letzte[letzte.length - 1]![0]) - Date.parse(letzte[0]![0])) / 86_400_000
  // Vier echte Folgequartale liegen ~9–14 Monate auseinander — nicht vier Q1er über 4 Jahre.
  if (span < 250 || span > 420) return null
  let sum = 0
  for (const [, t] of letzte) sum += feld ? vorzeichen(feld, t.wert) : t.wert
  return sum
}

function ratioPct(a: number | null, b: number | null): number | null {
  if (a == null || b == null || !(b > 0) || !Number.isFinite(a)) return null
  return (a / b) * 100
}

function ratio(a: number | null, b: number | null): number | null {
  if (a == null || b == null || !(b > 0) || !Number.isFinite(a)) return null
  return a / b
}

function zaehle(zeile: FundamentalMetrikZeile | undefined, isoListe: string[]): number {
  if (!zeile) return 0
  return isoListe.filter((iso) => {
    const v = zeile.werte[iso]
    return v != null && Number.isFinite(v)
  }).length
}

export async function ladeSecFundamentaldaten(
  ident: MacrotrendsIdent,
  frequenz: FundamentalFrequenz = 'jahr',
): Promise<MacrotrendsFundamentalRoh | null> {
  const cacheKey = `${ident.ticker}|${frequenz}`
  const hit = paketCache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  const merke = (data: MacrotrendsFundamentalRoh | null) => {
    paketCache.set(cacheKey, { at: Date.now(), data })
    return data
  }

  const cik = await cikFuerTicker(ident.ticker)
  if (!cik) return merke(null)
  const facts = await ladeFacts(cik)
  if (!facts?.facts) return merke(null)

  const waehrung = ermittleWaehrung(facts)
  const quartal = frequenz === 'quartal'
  const labels = quartal ? new Map<string, number>() : baueJahresLabels(facts)
  if (!quartal && labels.size === 0) return merke(null)

  const reihen = new Map<SecFeld, Map<string, Treffer>>()
  for (const feld of Object.keys(TAG_KETTEN) as SecFeld[]) {
    reihen.set(feld, quartal ? quartalsreihe(facts, waehrung, feld) : jahresreihe(facts, labels, waehrung, feld))
  }
  const umsatzReihe = reihen.get('umsatz')
  const ebitReihe = reihen.get('ebit')
  if (!quartal && umsatzReihe && ebitReihe) {
    wendeUmsatzGrossVsNetAufTreffer(umsatzReihe, ebitReihe)
  }

  const isoSet = new Set<string>()
  for (const reihe of reihen.values()) for (const ende of reihe.keys()) isoSet.add(ende)
  const isoListe = [...isoSet].sort().slice(quartal ? -16 : -16)
  if (isoListe.length < (quartal ? 4 : 6)) return merke(null)

  const mitTtm = frequenz === 'jahr'
  const perioden = bauePerioden(isoListe, mitTtm, frequenz)
  const zeilen: FundamentalMetrikZeile[] = []

  for (const def of ZEILEN) {
    if (def.id === 'ebitda' || def.id === 'gesamtverschuldung') continue
    if (!def.feld) continue
    const reihe = reihen.get(def.feld)
    const ttm = mitTtm
      ? ttmAusQuartalen(
          quartalsreihe(facts, waehrung, def.feld),
          def.feld,
          TTM_SUMME.has(def.feld) ? 'sum' : 'last',
        )
      : null
    const werte = werteAusReihe(reihe, def.feld, isoListe, ttm)
    // Additives TTM nicht mit letztem GJ auffüllen — sonst FCF-TTM = GJ und NI-TTM = 4Q.
    if (mitTtm && werte[FUNDAMENTAL_TTM_KEY] == null && !TTM_SUMME.has(def.feld)) {
      const last = [...isoListe].reverse().find((iso) => werte[iso] != null)
      if (last) werte[FUNDAMENTAL_TTM_KEY] = werte[last] ?? null
    }
    zeilen.push({
      id: def.id,
      label: def.label,
      gruppe: def.gruppe,
      einheit: def.einheit,
      werte,
      macrotrendsSlug: def.slug,
      macrotrendsStatement: def.statement,
    })
  }

  const bruttoZeile = zeilen.find((z) => z.id === 'bruttogewinn')
  const umsatzVorab = zeilen.find((z) => z.id === 'umsatz')
  if (bruttoZeile && umsatzVorab) {
    const cogsReihe = reihen.get('cogs')
    for (const iso of [...isoListe, ...(mitTtm ? [FUNDAMENTAL_TTM_KEY] : [])]) {
      if (bruttoZeile.werte[iso] != null) continue
      const u = umsatzVorab.werte[iso]
      const c =
        iso === FUNDAMENTAL_TTM_KEY
          ? ttmAusQuartalen(quartalsreihe(facts, waehrung, 'cogs'), 'cogs', 'sum')
          : cogsReihe?.get(iso)
            ? vorzeichen('cogs', cogsReihe.get(iso)!.wert)
            : null
      if (u != null && c != null) bruttoZeile.werte[iso] = u - Math.abs(c)
    }
  }

  const ebit = zeilen.find((z) => z.id === 'ebit')
  const da = zeilen.find((z) => z.id === 'da')
  const ebitdaWerte: Record<string, number | null> = {}
  for (const iso of [...isoListe, ...(mitTtm ? [FUNDAMENTAL_TTM_KEY] : [])]) {
    const e = ebit?.werte[iso]
    const d = da?.werte[iso]
    ebitdaWerte[iso] = e != null && d != null ? e + Math.abs(d) : e ?? null
  }
  zeilen.splice(2, 0, {
    id: 'ebitda',
    label: 'EBITDA',
    gruppe: 'finanzdaten',
    einheit: 'waehrung_usd_mio',
    werte: ebitdaWerte,
    macrotrendsSlug: 'ebitda',
    macrotrendsStatement: 'income-statement',
  })

  const ltWerte = werteAusReihe(
    reihen.get('langfristigeSchulden'),
    'langfristigeSchulden',
    isoListe,
    mitTtm
      ? ttmAusQuartalen(quartalsreihe(facts, waehrung, 'langfristigeSchulden'), 'langfristigeSchulden', 'last')
      : null,
  )
  const stWerte = werteAusReihe(
    reihen.get('kurzfristigeSchulden'),
    'kurzfristigeSchulden',
    isoListe,
    mitTtm
      ? ttmAusQuartalen(quartalsreihe(facts, waehrung, 'kurzfristigeSchulden'), 'kurzfristigeSchulden', 'last')
      : null,
  )
  const debtWerte: Record<string, number | null> = {}
  for (const iso of [...isoListe, ...(mitTtm ? [FUNDAMENTAL_TTM_KEY] : [])]) {
    const a = ltWerte[iso]
    const b = stWerte[iso]
    if (a == null && b == null) debtWerte[iso] = null
    else debtWerte[iso] = (a ?? 0) + (b ?? 0)
  }
  zeilen.push({
    id: 'gesamtverschuldung',
    label: 'Gesamtverschuldung',
    gruppe: 'bilanz',
    einheit: 'waehrung_usd_mio',
    werte: debtWerte,
    macrotrendsSlug: 'total-debt',
    macrotrendsStatement: 'balance-sheet',
  })

  const ocf = zeilen.find((z) => z.id === 'ocf')
  const capex = zeilen.find((z) => z.id === 'capex')
  if (ocf || capex) {
    const fcf: Record<string, number | null> = {}
    for (const iso of [...isoListe, ...(mitTtm ? [FUNDAMENTAL_TTM_KEY] : [])]) {
      const o = ocf?.werte[iso]
      const c = capex?.werte[iso]
      if (o == null && c == null) fcf[iso] = null
      else fcf[iso] = (o ?? 0) + (c ?? 0)
    }
    zeilen.push({
      id: 'fcf',
      label: 'Free Cashflow (FCF)',
      gruppe: 'cashflow',
      einheit: 'waehrung_usd_mio',
      werte: fcf,
      macrotrendsStatement: 'cash-flow-statement',
    })
  }

  const umsatz = zeilen.find((z) => z.id === 'umsatz')
  const brutto = zeilen.find((z) => z.id === 'bruttogewinn')
  const netto = zeilen.find((z) => z.id === 'nettogewinn')
  const ek = zeilen.find((z) => z.id === 'eigenkapital')
  const assets = zeilen.find((z) => z.id === 'gesamtvermoegen')
  const vorraete = zeilen.find((z) => z.id === 'vorraete')
  const forderungen = zeilen.find((z) => z.id === 'forderungen')
  const verb = zeilen.find((z) => z.id === 'kurzfrist_verbindl')

  const ratioZeile = (
    id: string,
    label: string,
    gruppe: FundamentalMetrikZeile['gruppe'],
    einheit: FundamentalMetrikZeile['einheit'],
    slug: string,
    fn: (iso: string) => number | null,
  ) => {
    const werte: Record<string, number | null> = {}
    for (const iso of [...isoListe, ...(mitTtm ? [FUNDAMENTAL_TTM_KEY] : [])]) werte[iso] = fn(iso)
    zeilen.push({ id, label, gruppe, einheit, werte, macrotrendsSlug: slug, macrotrendsStatement: 'financial-ratios' })
  }

  ratioZeile('bruttomarge', 'Bruttomarge %', 'margen', 'prozent', 'gross-margin', (iso) =>
    ratioPct(brutto?.werte[iso] ?? null, umsatz?.werte[iso] ?? null),
  )
  ratioZeile('ebitda_marge', 'EBITDA-Marge %', 'margen', 'prozent', 'ebitda-margin', (iso) =>
    ratioPct(ebitdaWerte[iso] ?? null, umsatz?.werte[iso] ?? null),
  )
  ratioZeile('ebit_marge', 'EBIT-Marge %', 'margen', 'prozent', 'ebit-margin', (iso) =>
    ratioPct(ebit?.werte[iso] ?? null, umsatz?.werte[iso] ?? null),
  )
  ratioZeile('nettomarge', 'Nettomarge %', 'margen', 'prozent', 'net-profit-margin', (iso) =>
    ratioPct(netto?.werte[iso] ?? null, umsatz?.werte[iso] ?? null),
  )
  ratioZeile('roa', 'Gesamtkapitalrendite (ROA %)', 'rentabilitaet', 'prozent', 'roa', (iso) =>
    ratioPct(netto?.werte[iso] ?? null, assets?.werte[iso] ?? null),
  )
  ratioZeile('roe', 'Eigenkapitalrendite (ROE %)', 'rentabilitaet', 'prozent', 'roe', (iso) =>
    ratioPct(netto?.werte[iso] ?? null, ek?.werte[iso] ?? null),
  )
  ratioZeile('kapitalumschlag', 'Kapitalumschlaghäufigkeit', 'umschlag', 'ratio', 'asset-turnover', (iso) =>
    ratio(umsatz?.werte[iso] ?? null, assets?.werte[iso] ?? null),
  )
  ratioZeile('anlagenumschlag', 'Lagerumschlag', 'umschlag', 'ratio', 'inventory-turnover', (iso) =>
    ratio(umsatz?.werte[iso] ?? null, vorraete?.werte[iso] ?? null),
  )
  ratioZeile('forderungsumschlag', 'Forderungsumschlag', 'umschlag', 'ratio', 'receiveable-turnover', (iso) =>
    ratio(umsatz?.werte[iso] ?? null, forderungen?.werte[iso] ?? null),
  )
  ratioZeile('dso', 'Forderungslaufzeit (DSO, Tage)', 'umschlag', 'zahl', 'days-sales-in-receivables', (iso) => {
    const t = ratio(forderungen?.werte[iso] ?? null, umsatz?.werte[iso] ?? null)
    return t == null ? null : t * 365
  })
  ratioZeile('dio', 'Lagerdauer (DIO, Tage)', 'umschlag', 'zahl', 'days-in-inventory', (iso) => {
    const t = ratio(vorraete?.werte[iso] ?? null, umsatz?.werte[iso] ?? null)
    return t == null ? null : t * 365
  })
  ratioZeile('dpo', 'Verbindlichkeitenlaufzeit (DPO, Tage)', 'umschlag', 'zahl', 'days-payables-outstanding', (iso) => {
    const t = ratio(verb?.werte[iso] ?? null, umsatz?.werte[iso] ?? null)
    return t == null ? null : t * 365
  })

  const capexDa: Record<string, number | null> = {}
  for (const iso of [...isoListe, ...(mitTtm ? [FUNDAMENTAL_TTM_KEY] : [])]) {
    const c = capex?.werte[iso]
    const d = da?.werte[iso]
    capexDa[iso] = c != null && d != null && d !== 0 ? Math.abs(c) / Math.abs(d) : null
  }
  zeilen.push({
    id: 'capex_da_ratio',
    label: 'CapEx / D&A (Wartungs-CapEx-Proxy)',
    gruppe: 'cashflow',
    einheit: 'ratio',
    werte: capexDa,
    macrotrendsStatement: 'cash-flow-statement',
  })

  ergaenzeNettoverschuldungZeilen(perioden, zeilen)

  const umsatzJ = zaehle(umsatz, isoListe)
  const epsJ = zaehle(zeilen.find((z) => z.id === 'eps'), isoListe)
  const ekJ = zaehle(ek, isoListe)
  if (umsatzJ < (quartal ? 4 : 6) || epsJ < (quartal ? 4 : 4) || ekJ < (quartal ? 4 : 4)) {
    console.warn(
      `[sec-fundamental] zu dünn für ${ident.ticker} umsatz=${umsatzJ} eps=${epsJ} ek=${ekJ}`,
    )
    return merke(null)
  }

  return merke({
    ident,
    perioden,
    zeilen,
    beschreibung: null,
    branche: null,
    guvQuelle: 'sec',
    waehrung,
  })
}

export async function baueUmsatzProJahrAusSec(ident: MacrotrendsIdent): Promise<Map<number, number>> {
  const roh = await ladeSecFundamentaldaten(ident, 'jahr')
  const map = new Map<number, number>()
  const umsatz = roh?.zeilen.find((z) => z.id === 'umsatz')
  if (!umsatz) return map
  for (const [iso, v] of Object.entries(umsatz.werte)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || v == null || !(v > 0)) continue
    map.set(parseInt(iso.slice(0, 4), 10), v)
  }
  return map
}

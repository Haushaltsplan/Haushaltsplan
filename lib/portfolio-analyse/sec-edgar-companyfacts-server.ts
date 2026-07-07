/** SEC EDGAR Company Facts — standardisierte XBRL-Kennzahlen (10+ Jahre). */

import 'server-only'

import { leseAlsJson } from '@/lib/http/safe-json-response'
import type { SecKennzahlenHistorie } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { padCik, secFetch } from '@/lib/portfolio-analyse/sec-edgar-common-server'

const CACHE_MS = 24 * 60 * 60 * 1000
/** Cache-Invalidierung bei Logik-Änderungen (Jahr aus period end, nicht fy). */
export const SEC_COMPANYFACTS_CACHE_VERSION = 2
const MIN_JAHRE = 10
const MAX_JAHRE = 16

const cache = new Map<number, { at: number; version: number; data: SecKennzahlenHistorie | null }>()
const jsonCache = new Map<number, { at: number; data: CompanyFactsJson | null }>()

type FactsUnit = {
  end?: string
  val?: number
  fy?: number
  fp?: string
  form?: string
  filed?: string
  accn?: string
}

type CompanyFactsJson = {
  facts?: {
    'us-gaap'?: Record<string, { units?: Record<string, FactsUnit[]> }>
    dei?: Record<string, { units?: Record<string, FactsUnit[]> }>
  }
}

const TAG_KETTEN: Record<
  Exclude<
    keyof SecKennzahlenHistorie,
    'aeltestesJahr' | 'juengstesJahr' | 'anzahlJahre' | 'ebitMargePct' | 'nettoMargePct' | 'rndAnteilPct' | 'capexAnteilPct' | 'fcfMio'
  >,
  string[]
> = {
  umsatzMio: [
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'Revenues',
    'SalesRevenueNet',
    'RevenueFromContractWithCustomerIncludingAssessedTax',
  ],
  nettogewinnMio: ['NetIncomeLoss', 'ProfitLoss'],
  ebitMio: ['OperatingIncomeLoss', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest'],
  rndMio: ['ResearchAndDevelopmentExpense', 'ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost'],
  capexMio: [
    'PaymentsToAcquirePropertyPlantAndEquipment',
    'PaymentsToAcquireProductiveAssets',
    'CapitalExpendituresIncurredButNotYetPaid',
  ],
  ocfMio: ['NetCashProvidedByUsedInOperatingActivities'],
  assetsMio: ['Assets'],
  eigenkapitalMio: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  langfristigeSchuldenMio: ['LongTermDebtNoncurrent', 'LongTermDebt', 'LongTermDebtAndCapitalLeaseObligations'],
  mitarbeiter: ['EntityNumberOfEmployees'],
  goodwillMio: ['Goodwill'],
  abschreibungMio: ['DepreciationDepletionAndAmortization', 'DepreciationAndAmortization'],
  aktienrueckkaufMio: ['PaymentsForRepurchaseOfCommonStock', 'StockRepurchasedDuringPeriodValue'],
}

const CAP_ALLOC_EXTRA_TAGS = {
  dividendenMio: [
    'PaymentsOfDividends',
    'PaymentsOfDividendsCommonStock',
    'PaymentsOfOrdinaryDividends',
    'DividendsPaid',
    'Dividends',
  ],
  mnaMio: [
    'PaymentsToAcquireBusinessesNetOfCashAcquired',
    'PaymentsToAcquireBusinessesAndInterestInAffiliates',
    'BusinessCombinationConsiderationTransferred',
    'PaymentsToAcquireBusinessTwoNetOfCashAcquired',
  ],
} as const

export type SecCapitalAllocationRoh = {
  jahr: number
  periodeLabel: string
  ocfUsd: number | null
  capexUsd: number | null
  dividendUsd: number | null
  buybackUsd: number | null
  mnaUsd: number | null
  revenueUsd: number | null
}

function zuMioUsd(val: number): number {
  const abs = Math.abs(val)
  // > 1 Mrd. → Roh-USD (z. B. AAPL ~3,9e11)
  if (abs >= 1_000_000_000) return Math.round((val / 1_000_000) * 10) / 10
  // 10 Mio.–1 Mrd. → vermutlich Roh-USD
  if (abs >= 10_000_000) return Math.round((val / 1_000_000) * 10) / 10
  // < 10 Mio. → bereits in Mio. USD (z. B. MSFT ~245.000)
  return Math.round(val * 10) / 10
}

/** Geschäftsjahr = Kalenderjahr des Periodenendes (end), nicht SEC-Filing-Feld fy. */
function jahrAusEintrag(e: FactsUnit): number | null {
  const iso = e.end
  if (iso) {
    const y = parseInt(iso.slice(0, 4), 10)
    if (Number.isFinite(y) && y >= 1990 && y <= 2035) return y
  }
  if (e.fy != null && e.fy >= 1990 && e.fy <= 2035) return e.fy
  return null
}

function extrahiereJahresreihe(
  facts: CompanyFactsJson,
  tags: string[],
  opts: { mio?: boolean; nur10k?: boolean; allowNegative?: boolean } = {},
): Map<number, number> {
  const map = new Map<number, { val: number; filed: string }>()
  const namespaces: Array<'us-gaap' | 'dei'> = ['us-gaap', 'dei']

  for (const tag of tags) {
    for (const ns of namespaces) {
      const einheiten = facts.facts?.[ns]?.[tag]?.units
      if (!einheiten) continue
      for (const liste of Object.values(einheiten)) {
        for (const e of liste ?? []) {
          if (opts.nur10k !== false && e.form && e.form !== '10-K') continue
          if (e.fp && e.fp !== 'FY') continue
          const jahr = jahrAusEintrag(e)
          const val = e.val
          if (jahr == null || val == null || !Number.isFinite(val)) continue
          if (
            val < 0 &&
            !opts.allowNegative &&
            tag !== 'NetIncomeLoss' &&
            !tag.includes('Income') &&
            !tag.includes('Loss')
          ) {
            continue
          }

          let norm = opts.allowNegative ? Math.abs(val) : val
          if (opts.mio) {
            norm = zuMioUsd(norm)
          }

          const filed = e.filed ?? e.end ?? ''
          const gerundet = Math.round(norm * 10) / 10
          const prev = map.get(jahr)
          if (
            !prev ||
            filed > prev.filed ||
            (filed === prev.filed && Math.abs(gerundet) > Math.abs(prev.val))
          ) {
            map.set(jahr, { val: gerundet, filed })
          }
        }
      }
    }
    if (map.size >= MIN_JAHRE) break
  }

  return new Map([...map.entries()].map(([j, { val }]) => [j, val]))
}

function berechneQuotient(
  zaehler: Map<number, number>,
  nenner: Map<number, number>,
): Map<number, number> {
  const out = new Map<number, number>()
  for (const [jahr, z] of zaehler) {
    const n = nenner.get(jahr)
    if (n == null || n === 0) continue
    out.set(jahr, Math.round((z / n) * 1000) / 10)
  }
  return out
}

function mapZuArray(map: Map<number, number>): { jahr: number; wert: number }[] {
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(-MAX_JAHRE)
    .map(([jahr, wert]) => ({ jahr, wert }))
}


export async function ladeCompanyFactsJson(cik: number): Promise<CompanyFactsJson | null> {
  const hit = jsonCache.get(cik)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  try {
    const res = await secFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${padCik(cik)}.json`)
    if (!res.ok) {
      jsonCache.set(cik, { at: Date.now(), data: null })
      return null
    }
    const facts = (await leseAlsJson<CompanyFactsJson>(res)) ?? {}
    if (!facts.facts) {
      jsonCache.set(cik, { at: Date.now(), data: null })
      return null
    }
    jsonCache.set(cik, { at: Date.now(), data: facts })
    return facts
  } catch {
    jsonCache.set(cik, { at: Date.now(), data: null })
    return null
  }
}

export async function ladeSecCompanyFacts(cik: number): Promise<SecKennzahlenHistorie | null> {
  const hit = cache.get(cik)
  if (hit && hit.version === SEC_COMPANYFACTS_CACHE_VERSION && Date.now() - hit.at < CACHE_MS) {
    return hit.data
  }

  try {
    const facts = await ladeCompanyFactsJson(cik)
    if (!facts?.facts) {
      cache.set(cik, { at: Date.now(), version: SEC_COMPANYFACTS_CACHE_VERSION, data: null })
      return null
    }

    const umsatz = extrahiereJahresreihe(facts, TAG_KETTEN.umsatzMio, { mio: true })
    const netto = extrahiereJahresreihe(facts, TAG_KETTEN.nettogewinnMio, { mio: true })
    const ebit = extrahiereJahresreihe(facts, TAG_KETTEN.ebitMio, { mio: true })
    const rnd = extrahiereJahresreihe(facts, TAG_KETTEN.rndMio, { mio: true })
    const capex = extrahiereJahresreihe(facts, TAG_KETTEN.capexMio, { mio: true, allowNegative: true })
    const ocf = extrahiereJahresreihe(facts, TAG_KETTEN.ocfMio, { mio: true, allowNegative: true })
    const assets = extrahiereJahresreihe(facts, TAG_KETTEN.assetsMio, { mio: true })
    const ek = extrahiereJahresreihe(facts, TAG_KETTEN.eigenkapitalMio, { mio: true })
    const schuld = extrahiereJahresreihe(facts, TAG_KETTEN.langfristigeSchuldenMio, { mio: true })
    const ma = extrahiereJahresreihe(facts, TAG_KETTEN.mitarbeiter, { mio: false })
    const goodwill = extrahiereJahresreihe(facts, TAG_KETTEN.goodwillMio, { mio: true })
    const da = extrahiereJahresreihe(facts, TAG_KETTEN.abschreibungMio, { mio: true })
    const buyback = extrahiereJahresreihe(facts, TAG_KETTEN.aktienrueckkaufMio, { mio: true, allowNegative: true })

    const rndAnteil = berechneQuotient(rnd, umsatz)
    const capexAnteil = berechneQuotient(capex, umsatz)

    const fcf = new Map<number, number>()
    for (const [jahr, ocfVal] of ocf) {
      const cx = capex.get(jahr)
      if (cx != null) fcf.set(jahr, Math.round((ocfVal - Math.abs(cx)) * 10) / 10)
    }

    const ebitMarge = berechneQuotient(ebit, umsatz)
    const nettoMarge = berechneQuotient(netto, umsatz)

    const alleJahre = new Set<number>()
    for (const m of [umsatz, netto, ebit, rnd, capex, ocf, ma]) {
      for (const j of m.keys()) alleJahre.add(j)
    }
    if (alleJahre.size < 3) {
      cache.set(cik, { at: Date.now(), version: SEC_COMPANYFACTS_CACHE_VERSION, data: null })
      return null
    }

    const jahreSort = [...alleJahre].sort((a, b) => a - b)
    const data: SecKennzahlenHistorie = {
      umsatzMio: mapZuArray(umsatz),
      nettogewinnMio: mapZuArray(netto),
      ebitMio: mapZuArray(ebit),
      ebitMargePct: mapZuArray(ebitMarge),
      nettoMargePct: mapZuArray(nettoMarge),
      rndMio: mapZuArray(rnd),
      rndAnteilPct: mapZuArray(rndAnteil),
      capexMio: mapZuArray(capex),
      capexAnteilPct: mapZuArray(capexAnteil),
      ocfMio: mapZuArray(ocf),
      fcfMio: mapZuArray(fcf),
      assetsMio: mapZuArray(assets),
      eigenkapitalMio: mapZuArray(ek),
      langfristigeSchuldenMio: mapZuArray(schuld),
      mitarbeiter: mapZuArray(ma),
      goodwillMio: mapZuArray(goodwill),
      abschreibungMio: mapZuArray(da),
      aktienrueckkaufMio: mapZuArray(buyback),
      aeltestesJahr: jahreSort[0]!,
      juengstesJahr: jahreSort[jahreSort.length - 1]!,
      anzahlJahre: jahreSort.length,
    }

    cache.set(cik, { at: Date.now(), version: SEC_COMPANYFACTS_CACHE_VERSION, data })
    return data
  } catch {
    cache.set(cik, { at: Date.now(), version: SEC_COMPANYFACTS_CACHE_VERSION, data: null })
    return null
  }
}

function rohUsdAusMio(mio: number | undefined): number | null {
  if (mio == null || !Number.isFinite(mio)) return null
  return Math.round(mio * 1_000_000)
}

/** Letztes GJ — Cashflow-Kennzahlen für Capital-Allocation (SEC Company Facts). */
export async function ladeSecCapitalAllocation(cik: number): Promise<SecCapitalAllocationRoh | null> {
  try {
    const res = await secFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${padCik(cik)}.json`)
    if (!res.ok) return null
    const facts = (await leseAlsJson<CompanyFactsJson>(res)) ?? {}
    if (!facts.facts) return null

    const ocfMap = extrahiereJahresreihe(facts, TAG_KETTEN.ocfMio, { mio: true, allowNegative: true })
    if (ocfMap.size === 0) return null

    const jahr = Math.max(...ocfMap.keys())
    const ocfMio = ocfMap.get(jahr)
    if (ocfMio == null) return null

    const capexMap = extrahiereJahresreihe(facts, TAG_KETTEN.capexMio, { mio: true, allowNegative: true })
    const divMap = extrahiereJahresreihe(facts, [...CAP_ALLOC_EXTRA_TAGS.dividendenMio], { mio: true, allowNegative: true })
    const buyMap = extrahiereJahresreihe(facts, TAG_KETTEN.aktienrueckkaufMio, { mio: true, allowNegative: true })
    const mnaMap = extrahiereJahresreihe(facts, [...CAP_ALLOC_EXTRA_TAGS.mnaMio], { mio: true, allowNegative: true })
    const umsatzMap = extrahiereJahresreihe(facts, TAG_KETTEN.umsatzMio, { mio: true })

    return {
      jahr,
      periodeLabel: `GJ ${jahr} (SEC 10-K)`,
      ocfUsd: rohUsdAusMio(ocfMio),
      capexUsd: rohUsdAusMio(capexMap.get(jahr)),
      dividendUsd: rohUsdAusMio(divMap.get(jahr)),
      buybackUsd: rohUsdAusMio(buyMap.get(jahr)),
      mnaUsd: rohUsdAusMio(mnaMap.get(jahr)),
      revenueUsd: rohUsdAusMio(umsatzMap.get(jahr)),
    }
  } catch {
    return null
  }
}

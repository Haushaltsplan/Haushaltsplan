/** SEC EDGAR Company Facts — standardisierte XBRL-Kennzahlen (10+ Jahre). */

import 'server-only'

import { leseAlsJson } from '@/lib/http/safe-json-response'
import type { SecKennzahlenHistorie } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { padCik, secFetch } from '@/lib/portfolio-analyse/sec-edgar-common-server'

const CACHE_MS = 24 * 60 * 60 * 1000
const MIN_JAHRE = 10
const MAX_JAHRE = 16

const cache = new Map<number, { at: number; data: SecKennzahlenHistorie | null }>()

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

function zuMioUsd(val: number): number {
  const abs = Math.abs(val)
  // > 1 Mrd. → Roh-USD (z. B. AAPL ~3,9e11)
  if (abs >= 1_000_000_000) return Math.round((val / 1_000_000) * 10) / 10
  // 10 Mio.–1 Mrd. → vermutlich Roh-USD
  if (abs >= 10_000_000) return Math.round((val / 1_000_000) * 10) / 10
  // < 10 Mio. → bereits in Mio. USD (z. B. MSFT ~245.000)
  return Math.round(val * 10) / 10
}

function jahrAusEintrag(e: FactsUnit): number | null {
  if (e.fy != null && e.fy >= 1990 && e.fy <= 2035) return e.fy
  const iso = e.end
  if (!iso) return null
  const y = parseInt(iso.slice(0, 4), 10)
  return Number.isFinite(y) ? y : null
}

function extrahiereJahresreihe(
  facts: CompanyFactsJson,
  tags: string[],
  opts: { mio?: boolean; nur10k?: boolean } = {},
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
          if (val < 0 && tag !== 'NetIncomeLoss' && !tag.includes('Income') && !tag.includes('Loss')) continue

          let norm = val
          if (opts.mio) {
            norm = zuMioUsd(val)
          }

          const filed = e.filed ?? e.end ?? ''
          const prev = map.get(jahr)
          if (!prev || filed > prev.filed) map.set(jahr, { val: Math.round(norm * 10) / 10, filed })
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


export async function ladeSecCompanyFacts(cik: number): Promise<SecKennzahlenHistorie | null> {
  const hit = cache.get(cik)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  try {
    const res = await secFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${padCik(cik)}.json`)
    if (!res.ok) {
      cache.set(cik, { at: Date.now(), data: null })
      return null
    }
    const facts = (await leseAlsJson<CompanyFactsJson>(res)) ?? {}
    if (!facts.facts) {
      cache.set(cik, { at: Date.now(), data: null })
      return null
    }

    const umsatz = extrahiereJahresreihe(facts, TAG_KETTEN.umsatzMio, { mio: true })
    const netto = extrahiereJahresreihe(facts, TAG_KETTEN.nettogewinnMio, { mio: true })
    const ebit = extrahiereJahresreihe(facts, TAG_KETTEN.ebitMio, { mio: true })
    const rnd = extrahiereJahresreihe(facts, TAG_KETTEN.rndMio, { mio: true })
    const capex = extrahiereJahresreihe(facts, TAG_KETTEN.capexMio, { mio: true })
    const ocf = extrahiereJahresreihe(facts, TAG_KETTEN.ocfMio, { mio: true })
    const assets = extrahiereJahresreihe(facts, TAG_KETTEN.assetsMio, { mio: true })
    const ek = extrahiereJahresreihe(facts, TAG_KETTEN.eigenkapitalMio, { mio: true })
    const schuld = extrahiereJahresreihe(facts, TAG_KETTEN.langfristigeSchuldenMio, { mio: true })
    const ma = extrahiereJahresreihe(facts, TAG_KETTEN.mitarbeiter, { mio: false })
    const goodwill = extrahiereJahresreihe(facts, TAG_KETTEN.goodwillMio, { mio: true })
    const da = extrahiereJahresreihe(facts, TAG_KETTEN.abschreibungMio, { mio: true })
    const buyback = extrahiereJahresreihe(facts, TAG_KETTEN.aktienrueckkaufMio, { mio: true })

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
      cache.set(cik, { at: Date.now(), data: null })
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

    cache.set(cik, { at: Date.now(), data })
    return data
  } catch {
    cache.set(cik, { at: Date.now(), data: null })
    return null
  }
}

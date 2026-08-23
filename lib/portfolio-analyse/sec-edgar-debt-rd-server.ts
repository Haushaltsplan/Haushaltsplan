/**
 * SEC XBRL — Schulden-Fälligkeitsprofil & F&E-Aktivierung.
 */

import 'server-only'

import { ladeCompanyFactsJson } from '@/lib/portfolio-analyse/sec-edgar-companyfacts-server'
import { cikFuerTicker } from '@/lib/portfolio-analyse/sec-edgar-common-server'

export type DebtMaturityProfil = {
  due12mMio: number | null
  dueYear2Mio: number | null
  dueYear3Mio: number | null
  dueYear4Mio: number | null
  dueYear5Mio: number | null
  dueAfter5yMio: number | null
  /** Summe fällig in 24 Monaten (Jahr 1+2). */
  due24mMio: number | null
  /** Anteil der Gesamtverschuldung, der in 24 Monaten refinanziert werden muss (%). */
  refiAnteil24mPct: number | null
  gesamtSchuldenMio: number | null
  jahr: number | null
  quelle: 'sec_xbrl' | 'eu_urd' | 'marketscreener'
}

export type RdKapitalisierung = {
  /** Aktivierte Software/F&E (Bilanz, Mio.). */
  kapitalisiertMio: number | null
  /** F&E-Aufwand GuV (Mio.). */
  aufwandMio: number | null
  /**
   * Aktivierungsquote % = kapitalisiert / (kapitalisiert + Aufwand).
   * Hoch = Gewinne kosmetisch gestützt.
   */
  aktivierungsquotePct: number | null
  jahr: number | null
  quelle: 'sec_xbrl' | 'eu_urd' | 'marketscreener'
}

type FactsUnit = {
  end?: string
  val?: number
  fy?: number
  fp?: string
  form?: string
  filed?: string
}

type CompanyFactsJson = {
  facts?: {
    'us-gaap'?: Record<string, { units?: Record<string, FactsUnit[]> }>
  }
}

function jahrAus(e: FactsUnit): number | null {
  if (e.end) {
    const y = parseInt(e.end.slice(0, 4), 10)
    if (y >= 1990 && y <= 2035) return y
  }
  if (e.fy != null && e.fy >= 1990 && e.fy <= 2035) return e.fy
  return null
}

function zuMio(val: number): number {
  // SEC Company Facts: Roh-USD → Mio.
  return Math.round((val / 1_000_000) * 10) / 10
}

/**
 * Erster Tag in der Kette mit FY-Wert (Priorität), nicht „neuester über alle Tags“
 * (sonst gewinnt oft DebtInstrumentCarryingAmount ≪ LongTermDebt).
 */
function ersterTagWert(
  facts: CompanyFactsJson,
  tags: string[],
): { wertMio: number; jahr: number } | null {
  for (const tag of tags) {
    const units = facts.facts?.['us-gaap']?.[tag]?.units
    if (!units) continue
    let best: { wertMio: number; jahr: number; filed: string } | null = null
    for (const liste of Object.values(units)) {
      for (const e of liste ?? []) {
        if (e.form && e.form !== '10-K' && e.form !== '20-F') continue
        if (e.fp && e.fp !== 'FY') continue
        const jahr = jahrAus(e)
        const val = e.val
        if (jahr == null || val == null || !Number.isFinite(val)) continue
        const wertMio = zuMio(Math.abs(val))
        if (wertMio < 0.1) continue
        const filed = e.filed ?? e.end ?? ''
        if (!best || jahr > best.jahr || (jahr === best.jahr && filed > best.filed)) {
          best = { wertMio, jahr, filed }
        }
      }
    }
    if (best) return { wertMio: best.wertMio, jahr: best.jahr }
  }
  return null
}

const MATURITY_TAGS = {
  y1: [
    'LongTermDebtMaturitiesRepaymentsOfPrincipalInNextTwelveMonths',
    'LongTermDebtMaturitiesRepaymentsOfPrincipalInYearOne',
    'LongTermDebtCurrent',
    'LongTermDebtAndCapitalLeaseObligationsCurrent',
  ],
  y2: [
    'LongTermDebtMaturitiesRepaymentsOfPrincipalInYearTwo',
    'LongTermDebtMaturitiesRepaymentsOfPrincipalInRollingYearTwo',
  ],
  y3: [
    'LongTermDebtMaturitiesRepaymentsOfPrincipalInYearThree',
    'LongTermDebtMaturitiesRepaymentsOfPrincipalInRollingYearThree',
  ],
  y4: [
    'LongTermDebtMaturitiesRepaymentsOfPrincipalInYearFour',
    'LongTermDebtMaturitiesRepaymentsOfPrincipalInRollingYearFour',
  ],
  y5: [
    'LongTermDebtMaturitiesRepaymentsOfPrincipalInYearFive',
    'LongTermDebtMaturitiesRepaymentsOfPrincipalInRollingYearFive',
  ],
  after: [
    'LongTermDebtMaturitiesRepaymentsOfPrincipalAfterYearFive',
    'LongTermDebtMaturitiesRepaymentsOfPrincipalInRollingAfterYearFive',
  ],
  total: [
    'LongTermDebt',
    'LongTermDebtAndCapitalLeaseObligations',
    'LongTermDebtNoncurrent',
    // DebtInstrumentCarryingAmount absichtlich nicht — oft Einzelinstrument ≪ Gesamtverschuldung
  ],
} as const

const RD_CAP_TAGS = [
  // Nur echte F&E-Aktiva — NICHT Capitalized Software (SaaS/NOW → Fake 99 %-Quote)
  'ResearchAndDevelopmentAssetNet',
  'CapitalizedResearchAndDevelopment',
  'DeferredResearchAndDevelopmentCosts',
]

const RD_EXP_TAGS = [
  'ResearchAndDevelopmentExpense',
  'ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost',
]

export async function ladeDebtMaturityProfil(ticker: string): Promise<DebtMaturityProfil | null> {
  const cik = await cikFuerTicker(ticker)
  if (!cik) return null
  const facts = await ladeCompanyFactsJson(cik)
  if (!facts) return null

  const y1 = ersterTagWert(facts, [...MATURITY_TAGS.y1])
  const y2 = ersterTagWert(facts, [...MATURITY_TAGS.y2])
  const y3 = ersterTagWert(facts, [...MATURITY_TAGS.y3])
  const y4 = ersterTagWert(facts, [...MATURITY_TAGS.y4])
  const y5 = ersterTagWert(facts, [...MATURITY_TAGS.y5])
  const after = ersterTagWert(facts, [...MATURITY_TAGS.after])
  const total = ersterTagWert(facts, [...MATURITY_TAGS.total])

  if (!y1 && !y2 && !total) return null

  const due12 = y1?.wertMio ?? null
  const dueY2 = y2?.wertMio ?? null
  const due24 =
    due12 != null || dueY2 != null
      ? Math.round(((due12 ?? 0) + (dueY2 ?? 0)) * 10) / 10
      : null

  let gesamt = total?.wertMio ?? null
  const bucketSum =
    (due12 ?? 0) +
    (dueY2 ?? 0) +
    (y3?.wertMio ?? 0) +
    (y4?.wertMio ?? 0) +
    (y5?.wertMio ?? 0) +
    (after?.wertMio ?? 0)
  if (gesamt == null && bucketSum > 0) {
    gesamt = Math.round(bucketSum * 10) / 10
  }
  // Sanity: Gesamt muss mind. die Fälligkeits-Buckets decken
  if (gesamt != null && bucketSum > gesamt * 1.15) {
    gesamt = Math.round(bucketSum * 10) / 10
  }

  let refiAnteil24mPct =
    due24 != null && gesamt != null && gesamt > 0
      ? Math.round((due24 / gesamt) * 1000) / 10
      : null
  // >100 % ist Datenfehler (Einheiten-Mix) — lieber null als 22900 %
  if (refiAnteil24mPct != null && refiAnteil24mPct > 100) refiAnteil24mPct = null

  const jahre = [y1, y2, y3, y4, y5, after, total]
    .map((x) => x?.jahr ?? null)
    .filter((j): j is number => j != null)

  return {
    due12mMio: due12,
    dueYear2Mio: dueY2,
    dueYear3Mio: y3?.wertMio ?? null,
    dueYear4Mio: y4?.wertMio ?? null,
    dueYear5Mio: y5?.wertMio ?? null,
    dueAfter5yMio: after?.wertMio ?? null,
    due24mMio: due24,
    refiAnteil24mPct,
    gesamtSchuldenMio: gesamt,
    jahr: jahre.length ? Math.max(...jahre) : null,
    quelle: 'sec_xbrl',
  }
}

export async function ladeRdKapitalisierung(ticker: string): Promise<RdKapitalisierung | null> {
  const cik = await cikFuerTicker(ticker)
  if (!cik) return null
  const facts = await ladeCompanyFactsJson(cik)
  if (!facts) return null

  const cap = ersterTagWert(facts, RD_CAP_TAGS)
  const exp = ersterTagWert(facts, RD_EXP_TAGS)
  if (!cap && !exp) return null

  const kapitalisiertMio = cap?.wertMio ?? null
  const aufwandMio = exp?.wertMio ?? null
  let aktivierungsquotePct: number | null = null
  if (kapitalisiertMio != null && aufwandMio != null && kapitalisiertMio + aufwandMio > 0) {
    aktivierungsquotePct =
      Math.round((kapitalisiertMio / (kapitalisiertMio + aufwandMio)) * 1000) / 10
    // Unplausible XBRL-Mischung (z. B. Software-Cap vs. R&D) verwerfen
    if (aktivierungsquotePct > 80) aktivierungsquotePct = null
  } else if (kapitalisiertMio != null && kapitalisiertMio > 0 && aufwandMio == null) {
    aktivierungsquotePct = null
  }

  return {
    kapitalisiertMio,
    aufwandMio,
    aktivierungsquotePct,
    jahr: cap?.jahr ?? exp?.jahr ?? null,
    quelle: 'sec_xbrl',
  }
}

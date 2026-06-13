import type { FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { FUNDAMENTAL_TTM_KEY } from '@/lib/portfolio-analyse/fundamentaldaten-types'

const RISIKOFREIER_ZINS = 0.045
const MARKTPRAEMIE = 0.055
const DEFAULT_STEUERSATZ = 0.21

/** Jahre für Incremental ROIC (Investment-Mantra / Research-Prompts). */
export const INCREMENTAL_ROIC_JAHRE = 3

export function letzterVerfuegbarerWert(
  zeile: FundamentalMetrikZeile | undefined,
  perioden: FundamentalPeriode[] | undefined,
): number | null {
  if (!zeile) return null
  const ttm = zeile.werte[FUNDAMENTAL_TTM_KEY]
  if (ttm != null && Number.isFinite(ttm)) return ttm

  const keys = perioden?.filter((p) => !p.istLtm && !p.istSchaetzung).map((p) => p.iso) ?? []
  for (let i = keys.length - 1; i >= 0; i--) {
    const v = zeile.werte[keys[i]!]
    if (v != null && Number.isFinite(v)) return v
  }

  for (const v of Object.values(zeile.werte)) {
    if (v != null && Number.isFinite(v)) return v
  }
  return null
}

export function historischeWerteAusZeile(
  zeile: FundamentalMetrikZeile | undefined,
  perioden: FundamentalPeriode[] | undefined,
): number[] {
  const keys = perioden?.filter((p) => !p.istLtm && !p.istSchaetzung).map((p) => p.iso) ?? []
  return keys.map((k) => zeile?.werte[k]).filter((v): v is number => v != null && Number.isFinite(v))
}

export function effektiverSteuersatz(
  pretaxUsd: number | null | undefined,
  taxUsd: number | null | undefined,
): number {
  if (pretaxUsd != null && pretaxUsd > 0 && taxUsd != null && taxUsd >= 0) {
    return Math.min(0.5, Math.max(0, taxUsd / pretaxUsd))
  }
  return DEFAULT_STEUERSATZ
}

export function nopatUsd(
  operatingIncomeUsd: number | null | undefined,
  pretaxUsd?: number | null,
  taxUsd?: number | null,
): number | null {
  if (operatingIncomeUsd == null || !Number.isFinite(operatingIncomeUsd)) return null
  const t = effektiverSteuersatz(pretaxUsd ?? null, taxUsd ?? null)
  return operatingIncomeUsd * (1 - t)
}

export function investedCapitalUsd(
  debtUsd: number | null | undefined,
  equityUsd: number | null | undefined,
  cashUsd?: number | null,
): number | null {
  if (debtUsd == null || equityUsd == null) return null
  const ic = debtUsd + equityUsd - (cashUsd ?? 0)
  return ic > 0 ? ic : null
}

export function roicPctAusNopat(nopatUsd: number | null, icUsd: number | null): number | null {
  if (nopatUsd == null || icUsd == null || icUsd <= 0) return null
  return (nopatUsd / icUsd) * 100
}

export function schaetzeWaccPct(opts: {
  beta?: number | null
  marketCapUsd?: number | null
  totalDebtUsd?: number | null
  interestExpenseUsd?: number | null
  pretaxIncomeUsd?: number | null
  taxProvisionUsd?: number | null
}): number | null {
  const beta = opts.beta ?? 1
  const costEquityPct = (RISIKOFREIER_ZINS + beta * MARKTPRAEMIE) * 100

  const debt = opts.totalDebtUsd ?? 0
  const equity = opts.marketCapUsd ?? 0
  const total = debt + equity
  if (total <= 0) return costEquityPct

  const wE = equity / total
  const wD = debt / total

  let costDebtPct = 5
  if (debt > 0 && opts.interestExpenseUsd != null && opts.interestExpenseUsd > 0) {
    costDebtPct = (opts.interestExpenseUsd / debt) * 100
  }

  const t = effektiverSteuersatz(opts.pretaxIncomeUsd ?? null, opts.taxProvisionUsd ?? null)
  return wE * costEquityPct + wD * costDebtPct * (1 - t)
}

export type YahooJahresSnapshot = {
  datum: string
  operatingIncomeUsd: number | null
  pretaxIncomeUsd: number | null
  taxProvisionUsd: number | null
  totalDebtUsd: number | null
  stockholdersEquityUsd: number | null
  netIncomeUsd: number | null
  capitalExpenditureUsd: number | null
  changeInWorkingCapitalUsd: number | null
  purchaseOfBusinessUsd: number | null
}

export type IncrementalRoicErgebnis = {
  pct: number
  deltaNopatUsd: number
  reinvestitionUsd: number
  vonJahr: string
  bisJahr: string
  investJahre: number
}

/** ROIIC = Δ NOPAT / Δ Investiertes Kapital (YoY). */
export type RoiicErgebnis = {
  pct: number
  deltaNopatUsd: number
  deltaIcUsd: number
  vonJahr: string
  bisJahr: string
  quelle: 'stockanalysis' | 'macrotrends'
}

export function investedCapitalAnlageUndWcUsd(
  ppAndEUsd: number | null | undefined,
  currentAssetsUsd: number | null | undefined,
  currentLiabilitiesUsd: number | null | undefined,
): number | null {
  if (
    ppAndEUsd == null ||
    currentAssetsUsd == null ||
    currentLiabilitiesUsd == null ||
    !Number.isFinite(ppAndEUsd) ||
    !Number.isFinite(currentAssetsUsd) ||
    !Number.isFinite(currentLiabilitiesUsd)
  ) {
    return null
  }
  return ppAndEUsd + (currentAssetsUsd - currentLiabilitiesUsd)
}

export function berechneRoiicYoY(
  nopatAelterUsd: number | null,
  nopatJuengerUsd: number | null,
  icAelterUsd: number | null,
  icJuengerUsd: number | null,
  vonJahr: string,
  bisJahr: string,
  quelle: RoiicErgebnis['quelle'],
): RoiicErgebnis | null {
  if (nopatAelterUsd == null || nopatJuengerUsd == null || icAelterUsd == null || icJuengerUsd == null) {
    return null
  }
  const deltaNopat = nopatJuengerUsd - nopatAelterUsd
  const deltaIc = icJuengerUsd - icAelterUsd
  if (!Number.isFinite(deltaIc) || Math.abs(deltaIc) < 1_000_000) return null

  return {
    pct: (deltaNopat / deltaIc) * 100,
    deltaNopatUsd: deltaNopat,
    deltaIcUsd: deltaIc,
    vonJahr,
    bisJahr,
    quelle,
  }
}

/** Fallback: IC aus ROIC-Identität (IC = NOPAT / ROIC), wenn keine Bilanz verfügbar. */
export function berechneRoiicAusMacrotrendsZeilen(
  perioden: FundamentalPeriode[] | undefined,
  ebitZeile: FundamentalMetrikZeile | undefined,
  roiZeile: FundamentalMetrikZeile | undefined,
): RoiicErgebnis | null {
  const fyKeys = perioden?.filter((p) => !p.istLtm && !p.istSchaetzung).map((p) => p.iso) ?? []
  if (fyKeys.length < 2) return null

  const priorKey = fyKeys[fyKeys.length - 2]!
  const latestKey = fyKeys[fyKeys.length - 1]!

  const ebitPriorMio = ebitZeile?.werte[priorKey]
  const ebitLatestMio = ebitZeile?.werte[latestKey]
  const roicPrior = roiZeile?.werte[priorKey]
  const roicLatest = roiZeile?.werte[latestKey]

  if (
    ebitPriorMio == null ||
    ebitLatestMio == null ||
    roicPrior == null ||
    roicLatest == null ||
    roicPrior === 0 ||
    roicLatest === 0
  ) {
    return null
  }

  const nopatPrior = nopatUsd(ebitPriorMio * 1_000_000)
  const nopatLatest = nopatUsd(ebitLatestMio * 1_000_000)
  const icPrior = nopatPrior != null ? nopatPrior / (roicPrior / 100) : null
  const icLatest = nopatLatest != null ? nopatLatest / (roicLatest / 100) : null

  return berechneRoiicYoY(
    nopatPrior,
    nopatLatest,
    icPrior,
    icLatest,
    priorKey.slice(0, 4),
    latestKey.slice(0, 4),
    'macrotrends',
  )
}

/**
 * Cash-Reinvestition eines Geschäftsjahres (Yahoo CF-Vorzeichen):
 * CapEx + gebundenes Working Capital + Akquisitionen.
 */
export function jaehrlicheReinvestitionUsd(jahr: YahooJahresSnapshot): number {
  const capex = jahr.capitalExpenditureUsd != null ? Math.abs(jahr.capitalExpenditureUsd) : 0
  const wc =
    jahr.changeInWorkingCapitalUsd != null && jahr.changeInWorkingCapitalUsd < 0
      ? Math.abs(jahr.changeInWorkingCapitalUsd)
      : 0
  const mna =
    jahr.purchaseOfBusinessUsd != null && jahr.purchaseOfBusinessUsd < 0
      ? Math.abs(jahr.purchaseOfBusinessUsd)
      : 0
  return capex + wc + mna
}

/**
 * Incremental ROIC = ΔNOPAT über N Jahre / Summe der Reinvestitionen in denselben N Jahren.
 * Nicht Δ(Debt+Equity) — das verfälscht durch Buybacks, Dividenden und Bilanz-Umklassierungen.
 */
export function berechneIncrementalRoicPct(
  historie: readonly YahooJahresSnapshot[],
  jahre: number = INCREMENTAL_ROIC_JAHRE,
): IncrementalRoicErgebnis | null {
  const sortiert = [...historie].filter((j) => j.datum).sort((a, b) => a.datum.localeCompare(b.datum))
  if (sortiert.length < jahre + 1) return null

  const start = sortiert[sortiert.length - 1 - jahre]!
  const ende = sortiert[sortiert.length - 1]!

  const nopatStart = nopatUsd(start.operatingIncomeUsd, start.pretaxIncomeUsd, start.taxProvisionUsd)
  const nopatEnde = nopatUsd(ende.operatingIncomeUsd, ende.pretaxIncomeUsd, ende.taxProvisionUsd)
  if (nopatStart == null || nopatEnde == null) return null

  const deltaNopat = nopatEnde - nopatStart
  const investJahre = sortiert.slice(-jahre)
  const reinvestition = investJahre.reduce((sum, j) => sum + jaehrlicheReinvestitionUsd(j), 0)

  if (reinvestition < 1_000_000) return null

  return {
    pct: (deltaNopat / reinvestition) * 100,
    deltaNopatUsd: deltaNopat,
    reinvestitionUsd: reinvestition,
    vonJahr: start.datum.slice(0, 4),
    bisJahr: ende.datum.slice(0, 4),
    investJahre: jahre,
  }
}

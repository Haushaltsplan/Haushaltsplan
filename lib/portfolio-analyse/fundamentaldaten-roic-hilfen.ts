import type { FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { FUNDAMENTAL_TTM_KEY } from '@/lib/portfolio-analyse/fundamentaldaten-types'

const RISIKOFREIER_ZINS = 0.045
const MARKTPRAEMIE = 0.055
const DEFAULT_STEUERSATZ = 0.21

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
}

export function berechneIncrementalRoicPct(
  aelter: YahooJahresSnapshot | null,
  juenger: YahooJahresSnapshot | null,
): number | null {
  if (!aelter || !juenger) return null

  const nopatAlt = nopatUsd(aelter.operatingIncomeUsd, aelter.pretaxIncomeUsd, aelter.taxProvisionUsd)
  const nopatNeu = nopatUsd(juenger.operatingIncomeUsd, juenger.pretaxIncomeUsd, juenger.taxProvisionUsd)
  const icAlt = investedCapitalUsd(aelter.totalDebtUsd, aelter.stockholdersEquityUsd)
  const icNeu = investedCapitalUsd(juenger.totalDebtUsd, juenger.stockholdersEquityUsd)

  if (nopatAlt == null || nopatNeu == null || icAlt == null || icNeu == null) return null

  const deltaNopat = nopatNeu - nopatAlt
  const deltaIc = icNeu - icAlt
  if (Math.abs(deltaIc) < 1_000_000) return null

  return (deltaNopat / deltaIc) * 100
}

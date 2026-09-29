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

/**
 * Zähler und Nenner derselben Periode (TTM nur wenn beide da, sonst letztes GJ).
 * Verhindert z. B. TTM-FCF aus 4×Q1-YTD geteilt durch echtes TTM-Nettogewinn.
 */
export function werteGleicherStichtag(
  zaehler: FundamentalMetrikZeile | undefined,
  nenner: FundamentalMetrikZeile | undefined,
  perioden: FundamentalPeriode[] | undefined,
): { zaehler: number; nenner: number; iso: string } | null {
  if (!zaehler || !nenner) return null
  const hist = perioden?.filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung).map((p) => p.iso) ?? []
  const keys = [FUNDAMENTAL_TTM_KEY, ...[...hist].reverse()]
  for (const iso of keys) {
    const z = zaehler.werte[iso]
    const n = nenner.werte[iso]
    if (z == null || n == null || !Number.isFinite(z) || !Number.isFinite(n) || !(n > 0)) continue
    return { zaehler: z, nenner: n, iso }
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

/** Yahoo-Jahressnapshot für Mantra-Finanzdaten (WACC, Schulden). */
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
  operatingCashFlowUsd: number | null
  depreciationAmortizationUsd: number | null
  goodwillUsd: number | null
  cashAndEquivalentsUsd: number | null
}

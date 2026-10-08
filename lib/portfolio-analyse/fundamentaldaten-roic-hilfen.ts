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

  const keys = historischeJahresKeys(perioden)
  for (let i = keys.length - 1; i >= 0; i--) {
    const v = zeile.werte[keys[i]!]
    if (v != null && Number.isFinite(v)) return v
  }
  // Fallback: irgendein Hist-Wert (auch Kalender-Duplikat), falls FY-Key ohne Wert
  const rohKeys = perioden?.filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung).map((p) => p.iso) ?? []
  for (let i = rohKeys.length - 1; i >= 0; i--) {
    const v = zeile.werte[rohKeys[i]!]
    if (v != null && Number.isFinite(v)) return v
  }

  for (const v of Object.values(zeile.werte)) {
    if (v != null && Number.isFinite(v)) return v
  }
  return null
}

/** Median-Abstand der Hist-ISOs — ~90 Tage ⇒ Quartalspaket. */
export function istQuartalsPerioden(perioden: FundamentalPeriode[] | undefined): boolean {
  const keys = perioden
    ?.filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung && /^\d{4}-\d{2}-\d{2}$/.test(p.iso))
    .map((p) => p.iso)
    .sort()
  if (!keys || keys.length < 3) return false
  // FY+Kalender-Duplikate (z. B. 30.09. + 31.12.) haben oft ~90-Tage-Lücken,
  // sind aber keine echte Quartalsserie — mind. 3 verschiedene Monate nötig.
  const monate = new Set(keys.map((k) => k.slice(5, 7)))
  if (monate.size < 3) return false
  const gaps: number[] = []
  for (let i = 1; i < keys.length; i++) {
    gaps.push((Date.parse(keys[i]!) - Date.parse(keys[i - 1]!)) / 86_400_000)
  }
  gaps.sort((a, b) => a - b)
  const med = gaps[Math.floor(gaps.length / 2)]!
  return med >= 60 && med <= 130
}

/**
 * Eine Hist-ISO pro Kalenderjahr für CAGR/Trends.
 * Sonst verdoppeln FY-Ende + Kalenderjahr (Visa 30.09. + 31.12.) die Punkte und
 * drücken 3J-CAGR auf ~⅓ des echten Wachstums.
 */
export function historischeJahresKeys(perioden: FundamentalPeriode[] | undefined): string[] {
  const kandidaten = (perioden ?? [])
    .filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung && /^\d{4}-\d{2}-\d{2}$/.test(p.iso))
    .map((p) => p.iso)
    .sort()
  if (kandidaten.length === 0) return []

  const monatCount = new Map<string, number>()
  for (const iso of kandidaten) {
    const md = iso.slice(5)
    monatCount.set(md, (monatCount.get(md) ?? 0) + 1)
  }
  let dominantMd = kandidaten[kandidaten.length - 1]!.slice(5)
  let bestN = 0
  for (const [md, n] of monatCount) {
    if (n > bestN) {
      bestN = n
      dominantMd = md
    }
  }
  const dominantShare = bestN / kandidaten.length
  const monate = new Set([...monatCount.keys()].map((md) => md.slice(0, 2)))
  // Echte Quartale (mehrere Monate, kein dominantes FY) unverändert lassen.
  const jährlich =
    monate.size <= 2 || dominantShare >= 0.4 || !istQuartalsPerioden(perioden)

  if (!jährlich) return kandidaten

  const byYear = new Map<number, string>()
  for (const iso of kandidaten) {
    const y = Number(iso.slice(0, 4))
    const md = iso.slice(5)
    const prev = byYear.get(y)
    if (!prev) {
      byYear.set(y, iso)
      continue
    }
    const prevMd = prev.slice(5)
    if (md === dominantMd && prevMd !== dominantMd) byYear.set(y, iso)
  }
  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, iso]) => iso)
}

/**
 * Flow-Kennzahl für „LTM“-Key-Metrics:
 * TTM-Spalte, sonst Summe der letzten 4 Folgequartale, sonst letzter Einzelwert (Jahresmodus).
 */
export function ttmOderLetzterFlow(
  zeile: FundamentalMetrikZeile | undefined,
  perioden: FundamentalPeriode[] | undefined,
): number | null {
  if (!zeile) return null
  const ttm = zeile.werte[FUNDAMENTAL_TTM_KEY]
  if (ttm != null && Number.isFinite(ttm)) return ttm

  const keys =
    perioden
      ?.filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung && /^\d{4}-\d{2}-\d{2}$/.test(p.iso))
      .map((p) => p.iso)
      .sort() ?? []
  if (keys.length >= 4 && istQuartalsPerioden(perioden)) {
    const letzte = keys.slice(-4)
    for (let i = 1; i < letzte.length; i++) {
      const gap =
        (Date.parse(letzte[i]!) - Date.parse(letzte[i - 1]!)) / 86_400_000
      if (gap < 60 || gap > 130) return letzterVerfuegbarerWert(zeile, perioden)
    }
    let sum = 0
    for (const k of letzte) {
      const v = zeile.werte[k]
      if (v == null || !Number.isFinite(v)) return letzterVerfuegbarerWert(zeile, perioden)
      sum += v
    }
    return sum
  }
  return letzterVerfuegbarerWert(zeile, perioden)
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
  if (!zeile) return []
  const kandidaten = (perioden ?? [])
    .filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung && /^\d{4}-\d{2}-\d{2}$/.test(p.iso))
    .map((p) => p.iso)
    .sort()

  // Echte Quartalsserie: alle Punkte behalten (CAGR nutzt dann t vs t−12).
  if (istQuartalsPerioden(perioden)) {
    return kandidaten
      .map((k) => zeile.werte[k])
      .filter((v): v is number => v != null && Number.isFinite(v))
  }

  // Pro Jahr: Preferenz dominantes FY-Ende, sonst anderer Stichtag mit Wert (EPS oft nur 31.12.).
  const monatCount = new Map<string, number>()
  for (const iso of kandidaten) {
    const md = iso.slice(5)
    monatCount.set(md, (monatCount.get(md) ?? 0) + 1)
  }
  let dominantMd = '12-31'
  let bestN = 0
  for (const [md, n] of monatCount) {
    if (n > bestN) {
      bestN = n
      dominantMd = md
    }
  }

  const byYear = new Map<number, { iso: string; wert: number }>()
  for (const iso of kandidaten) {
    const v = zeile.werte[iso]
    if (v == null || !Number.isFinite(v)) continue
    const y = Number(iso.slice(0, 4))
    const md = iso.slice(5)
    const prev = byYear.get(y)
    if (!prev) {
      byYear.set(y, { iso, wert: v })
      continue
    }
    if (md === dominantMd && prev.iso.slice(5) !== dominantMd) {
      byYear.set(y, { iso, wert: v })
    }
  }
  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, x]) => x.wert)
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
  // Ohne firmenspezifisches Beta keinen Einheits-WACC (~10 % bei β=1) vortäuschen.
  const beta = opts.beta
  if (beta == null || !Number.isFinite(beta) || beta <= 0) return null

  const costEquityPct = (RISIKOFREIER_ZINS + beta * MARKTPRAEMIE) * 100

  const debt = opts.totalDebtUsd ?? 0
  const equity = opts.marketCapUsd ?? 0
  const total = debt + equity
  if (total <= 0) return Math.round(costEquityPct * 100) / 100

  const wE = equity / total
  const wD = debt / total

  let costDebtPct: number | null = null
  if (debt > 0 && opts.interestExpenseUsd != null && opts.interestExpenseUsd > 0) {
    costDebtPct = (opts.interestExpenseUsd / debt) * 100
  } else if (debt <= 0) {
    costDebtPct = 0
  } else {
    // Schulden ohne Zinsaufwand: leichter Spread über rf, nicht pauschal 5 % für alle.
    costDebtPct = (RISIKOFREIER_ZINS + 0.015) * 100
  }

  const t = effektiverSteuersatz(opts.pretaxIncomeUsd ?? null, opts.taxProvisionUsd ?? null)
  return Math.round((wE * costEquityPct + wD * costDebtPct * (1 - t)) * 100) / 100
}

/** iROIC − WACC; Fallback über implizites WACC aus ROIC−Spread (Cache-Read ohne Yahoo/iROIC-Kontext). */
export function berechneIncrementalValueSpread(opts: {
  incrementalRoicPct: number | null | undefined
  wacc: number | null | undefined
  roicAnzeige: number | null | undefined
  valueSpread: number | null | undefined
  /** Bei NOPAT-Rückgang ist iROIC=0 kein sinnvoller Spread-Input. */
  incrementalRoicRegime?: string | null
}): number | null {
  const regime = opts.incrementalRoicRegime
  if (regime === 'schrumpfend' || regime === 'unzureichend') return null
  const roiic = opts.incrementalRoicPct
  if (roiic == null || !Number.isFinite(roiic)) return null
  // 0 % iROIC ohne Regime-Kontext: oft Cache-Platzhalter, kein echter Spread.
  if (roiic === 0) return null
  if (opts.wacc != null && Number.isFinite(opts.wacc)) return roiic - opts.wacc
  const roic = opts.roicAnzeige
  const spread = opts.valueSpread
  if (roic != null && spread != null && Number.isFinite(roic) && Number.isFinite(spread)) {
    return roiic - (roic - spread)
  }
  return null
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

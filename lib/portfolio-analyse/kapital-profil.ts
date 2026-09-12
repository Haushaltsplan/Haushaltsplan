/**
 * Kapital-Profil — welche Kennzahl für welches Geschäftsmodell gilt.
 *
 * Keine Ticker-Hardcodes. Erkennung aus Bilanz/GuV/Branche.
 * Nicht anwendbar = raus aus dem Score-Nenner (weder Fail noch Bonus).
 * Jedes Profil hat Ersatzmaße, keinen Freifahrtschein.
 */

export type KapitalProfil =
  | 'capital_return'
  | 'asset_heavy'
  | 'software'
  | 'platform'
  | 'float_finance'
  | 'quality_default'

export type KapitalProfilKonfidenz = 'hoch' | 'mittel' | 'niedrig'

export type KapitalProfilErkennung = {
  profil: KapitalProfil
  konfidenz: KapitalProfilKonfidenz
  gruende: string[]
  flags: {
    mandaCompounder: boolean
    wachstum: boolean
  }
}

export type KapitalProfilInput = {
  stockholdersEquityUsd?: number | null
  roePct?: number | null
  roicPct?: number | null
  fcfConversionPct?: number | null
  fcfMargePct?: number | null
  capexSalesPct?: number | null
  assetTurnover?: number | null
  nrrPct?: number | null
  bruttoMargePct?: number | null
  revGrowthPct?: number | null
  sbcFcfRatio?: number | null
  sbcVsFcfPct?: number | null
  aktienSinkend?: boolean | null
  incrementalRoicRegime?: 'normal' | 'kapitalleicht' | 'schrumpfend' | 'unzureichend' | null
  goodwillAnteilPct?: number | null
  interestCoverage?: number | null
  netDebtEbitda?: number | null
  industrie?: string | null
  sektor?: string | null
  branche?: string | null
  istWachstumsfirma?: boolean
}

export const KAPITAL_PROFIL_LABEL: Record<KapitalProfil, string> = {
  capital_return: 'Kapitalrückgabe',
  asset_heavy: 'Kapitalintensiv',
  software: 'Software / Abo',
  platform: 'Plattform / Netzwerk',
  float_finance: 'Float / Versicherung',
  quality_default: 'Quality-Standard',
}

export const KAPITAL_PROFIL_HINWEIS: Record<KapitalProfil, string> = {
  capital_return:
    'Buch-EK/ROE sind durch Rückkäufe verzerrt. Qualität über FCF-Conversion und Zinsdeckung, nicht über Eigenkapitalrendite.',
  asset_heavy:
    'Hohes CapEx gehört zum Modell. ROIC gegen WACC, nicht gegen die 15-%-Software-Hürde. Leverage über Tragfähigkeit, nicht 2×-EBITDA.',
  software:
    'GAAP-Gewinn und Dilution sind Strategie. NRR / Rule of 40 und FCF-Marge zählen mehr als klassischer ROIC.',
  platform:
    'Asset-light Netzwerk: LTV/CAC und NRR sind oft nicht berichtet. FCF-Maschine und Skalenmarge sind der Maßstab.',
  float_finance:
    'Float ist keine Industrie-Verschuldung. ROE und Underwriting zählen; Net Debt/EBITDA ist hier kein Fail.',
  quality_default: 'Universelles Quality-Dashboard — alle Standard-Kennzahlen gelten.',
}

function text(...teile: Array<string | null | undefined>): string {
  return teile.filter((t): t is string => Boolean(t && t.trim())).join(' ')
}

export function istFloatFinanceBranche(roh: string | null | undefined): boolean {
  const t = (roh ?? '').trim()
  if (!t) return false
  return /insurance|insurer|versicher|reinsurance|rückversich|healthcare plans?|health plans?|managed health|krankenversich|underwriting|property.?casualty|schadenversich|life insurance|lebensversich/i.test(
    t,
  )
}

export function istAssetHeavyBranche(roh: string | null | undefined): boolean {
  const t = (roh ?? '').trim()
  if (!t) return false
  return /railroad|eisenbahn|railways?|waste|abfall|trucking|spedition|freight|industrial gases?|industriegas|building materials?|baustoff|specialty chemicals?|chemie|logistik|marine shipping|pipeline/i.test(
    t,
  )
}

function sbcQuote(input: KapitalProfilInput): number | null {
  if (input.sbcVsFcfPct != null && Number.isFinite(input.sbcVsFcfPct)) return input.sbcVsFcfPct
  if (input.sbcFcfRatio != null && Number.isFinite(input.sbcFcfRatio)) {
    return input.sbcFcfRatio <= 2 ? input.sbcFcfRatio * 100 : input.sbcFcfRatio
  }
  return null
}

function fcfStark(input: KapitalProfilInput): boolean {
  const conv = input.fcfConversionPct
  const marge = input.fcfMargePct
  return (conv != null && conv >= 80) || (marge != null && marge >= 12)
}

/** ROE/ROIC-Nenner ist ökonomisch unbrauchbar (negatives EK oder Extremwert). */
export function istBuchRenditeUnbrauchbar(input: KapitalProfilInput): boolean {
  if (input.stockholdersEquityUsd != null && input.stockholdersEquityUsd <= 0) return true
  if (input.roePct != null && Math.abs(input.roePct) >= 80 && fcfStark(input)) return true
  if (input.roicPct != null && Math.abs(input.roicPct) >= 80 && fcfStark(input)) return true
  return false
}

export function erkenneKapitalProfil(input: KapitalProfilInput): KapitalProfilErkennung {
  const gruende: string[] = []
  const flags = {
    mandaCompounder: (input.goodwillAnteilPct ?? 0) >= 35,
    wachstum: Boolean(input.istWachstumsfirma),
  }
  const branche = text(input.industrie, input.branche, input.sektor)
  const sbc = sbcQuote(input)

  if (istFloatFinanceBranche(branche)) {
    gruende.push('Branche/Industrie ist Versicherung oder Healthcare-Plan — Float-Modell.')
    return { profil: 'float_finance', konfidenz: 'hoch', gruende, flags }
  }

  if (input.nrrPct != null && Number.isFinite(input.nrrPct)) {
    gruende.push(`NRR ${input.nrrPct.toFixed(0)} % — Abo-/SaaS-Reporting.`)
    return { profil: 'software', konfidenz: 'hoch', gruende, flags }
  }

  const softwareProxy =
    (input.bruttoMargePct ?? 0) >= 60 &&
    (Boolean(input.istWachstumsfirma) || (input.revGrowthPct ?? 0) > 12) &&
    (sbc != null && sbc >= 8)
  if (softwareProxy) {
    gruende.push('Hohe Bruttomarge, Wachstum und SBC — Software-Stückkostenökonomie.')
    return { profil: 'software', konfidenz: 'mittel', gruende, flags }
  }

  if (istBuchRenditeUnbrauchbar(input)) {
    if (input.stockholdersEquityUsd != null && input.stockholdersEquityUsd <= 0) {
      gruende.push('Negatives Buch-Eigenkapital — ROE ist kein Renditemaß.')
    } else {
      gruende.push('Extreme Buchrendite bei starkem FCF — Nenner durch Kapitalrückgabe verzerrt.')
    }
    if (input.aktienSinkend) gruende.push('Sinkende Aktienanzahl bestätigt Rückgabe-Strategie.')
    return { profil: 'capital_return', konfidenz: 'hoch', gruende, flags }
  }

  const capex = input.capexSalesPct
  const roic = input.roicPct
  const assetHeavyZahlen =
    capex != null &&
    capex >= 8 &&
    roic != null &&
    roic < 20 &&
    ((input.assetTurnover != null && input.assetTurnover < 1.3) || istAssetHeavyBranche(branche))
  if (assetHeavyZahlen || (istAssetHeavyBranche(branche) && capex != null && capex >= 6 && (roic == null || roic < 22))) {
    gruende.push(
      capex != null
        ? `CapEx/Umsatz ${capex.toFixed(1)} % — physische Reinvestition ist das Modell.`
        : 'Branche ist kapitalintensiv (Bahn, Abfall, Gase, Chemie).',
    )
    return {
      profil: 'asset_heavy',
      konfidenz: istAssetHeavyBranche(branche) ? 'hoch' : 'mittel',
      gruende,
      flags,
    }
  }

  const platformZahlen =
    capex != null &&
    capex < 4 &&
    roic != null &&
    roic >= 25 &&
    input.nrrPct == null &&
    !input.istWachstumsfirma
  if (platformZahlen) {
    gruende.push(`Asset-light (CapEx ${capex!.toFixed(1)} %) bei ROIC ${roic!.toFixed(0)} % — Netzwerk-/Plattform-Ökonomie.`)
    return { profil: 'platform', konfidenz: 'mittel', gruende, flags }
  }

  gruende.push('Kein abweichendes Kapital-System erkannt — Standard-Quality-Dashboard.')
  return { profil: 'quality_default', konfidenz: 'niedrig', gruende, flags }
}

/** Net-Debt/EBITDA-Schwellen: ab wann Struktur-Malus greift. */
export function netDebtEbitdaMalus(
  nd: number,
  profil: KapitalProfil,
  interestCoverage: number | null,
): number {
  if (profil === 'float_finance') return 0
  if (profil === 'capital_return') {
    if (interestCoverage != null && interestCoverage < 4) return -3
    if (nd > 5) return -2
    if (nd > 4) return -1
    return 0
  }
  if (profil === 'asset_heavy') {
    if (nd > 5) return -4
    if (nd > 4) return -2
    if (nd < 1.5) return 1
    return 0
  }
  if (nd > 3.5) return -4
  if (nd > 2.5) return -2
  if (nd < 0.8) return 1
  return 0
}

export function netDebtEbitdaOk(nd: number | null, profil: KapitalProfil, coverage: number | null): boolean | null {
  if (profil === 'float_finance') return null
  if (nd == null && coverage == null) return null
  if (profil === 'capital_return') {
    if (coverage != null) return coverage >= 6
    if (nd != null) return nd <= 4.5
    return null
  }
  if (profil === 'asset_heavy') {
    if (coverage != null && coverage >= 5) return true
    if (nd != null) return nd < 3.5
    return null
  }
  if (nd != null) return nd < 2
  return null
}

export function fcfConversionSchwelle(profil: KapitalProfil): number {
  if (profil === 'asset_heavy' || profil === 'float_finance') return 70
  return 90
}

export function fcfMargeSchwelle(profil: KapitalProfil): { erfuellt: number; qualitativ: number } {
  if (profil === 'asset_heavy') return { erfuellt: 8, qualitativ: 5 }
  if (profil === 'software') return { erfuellt: 10, qualitativ: 4 }
  return { erfuellt: 12, qualitativ: 5 }
}

export function roicHuerdePct(profil: KapitalProfil): number {
  if (profil === 'asset_heavy') return 10
  if (profil === 'software') return 12
  return 15
}

export function verwässerungMaxPct(profil: KapitalProfil): number {
  return profil === 'software' ? 4 : 2
}

export function sbcFcfMalus(sbcVsFcfPct: number, profil: KapitalProfil): number {
  if (profil === 'software') {
    if (sbcVsFcfPct >= 45) return -2
    if (sbcVsFcfPct >= 28) return -1
    return 0
  }
  if (sbcVsFcfPct >= 28) return -2
  if (sbcVsFcfPct >= 16) return -1
  return 0
}

export function kapitalProfilKurz(erkennung: KapitalProfilErkennung | null | undefined): string {
  if (!erkennung) return KAPITAL_PROFIL_LABEL.quality_default
  return KAPITAL_PROFIL_LABEL[erkennung.profil]
}

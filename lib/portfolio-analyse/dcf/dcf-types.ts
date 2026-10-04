/** Alle Wachstums-/Zinssätze in Prozentpunkten (8 = 8 %), sofern nicht anders vermerkt. */

export type DcfTerminalMethode = 'gordon' | 'exit_multiple'

export type DcfSzenarioId = 'bear' | 'base' | 'bull'

export type DcfWaccBaustein = {
  beta: number | null
  riskFreePct: number
  equityRiskPremiumPct: number
  costEquityPct: number | null
  costDebtPct: number | null
  taxRatePct: number
  equityWeight: number | null
  debtWeight: number | null
  waccPct: number | null
}

/** Aus Fundamentaldaten abgeleitete Marktdaten / Defaults. */
export type DcfPaketInputs = {
  ticker: string
  name: string
  symbolYahoo: string | null
  fcf0Usd: number | null
  fcf0Quelle: 'ttm' | 'gj' | null
  gStartPct: number
  gStartQuelle: 'schaetzung' | 'cagr5' | 'fallback'
  gTerminalPct: number
  jahre: number
  wacc: DcfWaccBaustein
  sharesOutstanding: number | null
  shareCagrPct: number
  netDebtUsd: number | null
  kursUsd: number | null
  currency: string
}

export type DcfAnnahmen = {
  fcf0Usd: number
  jahre: number
  gStartPct: number
  gTerminalPct: number
  fade: boolean
  waccPct: number
  terminalMethode: DcfTerminalMethode
  exitMultiple: number
  netDebtUsd: number
  minoritiesUsd: number
  sharesOutstanding: number
  shareCagrPct: number
  mosPct: number
  kursUsd: number | null
}

export type DcfJahresZeile = {
  jahr: number
  wachstumPct: number
  fcfUsd: number
  pvFcfUsd: number
}

export type DcfErgebnis = {
  ok: true
  jahre: DcfJahresZeile[]
  summePvFcfUsd: number
  terminalValueUsd: number
  pvTerminalUsd: number
  enterpriseValueUsd: number
  equityValueUsd: number
  sharesEnd: number
  fairValuePerShare: number
  buyPricePerShare: number
  upsidePct: number | null
  tvAnteilPct: number
  annahmen: DcfAnnahmen
}

export type DcfFehler = {
  ok: false
  fehler: string
  annahmen: DcfAnnahmen
}

export type DcfResult = DcfErgebnis | DcfFehler

export type DcfSensitivitaetsZelle = {
  waccPct: number
  yPct: number
  fairValuePerShare: number | null
  upsidePct: number | null
  fehler: string | null
}

export type DcfSensitivitaetsMatrix = {
  waccAchse: number[]
  yAchse: number[]
  /** yAchse = gTerminal oder Exit-Multiple je nach Methode */
  yIstExitMultiple: boolean
  zellen: DcfSensitivitaetsZelle[][]
}

/**
 * Momentum Trader — Typen.
 *
 * Kurzfristige, faktenbasierte Setups (Earnings-Gap, IPO-Fade, …).
 * Getrennt vom Nachkauf-Radar — andere Playbooks, andere Regeln.
 */

/** Playbook-Typen (erweiterbar). */
export type MomentumPlaybook =
  | 'earnings_gap_fade'
  | 'earnings_momentum'
  | 'ipo_fade'

/** Long / Short / kein Trade. */
export type MomentumRichtung = 'long' | 'short'

/** Setup-Ampel aus der Regel-Engine. */
export type MomentumAmpel = 'gruen' | 'gelb' | 'rot' | 'grau'

/** BMO = before market open, AMC = after market close. */
export type MomentumEarningsZeit = 'bmo' | 'amc' | 'dmh' | 'unknown'

export type MomentumGuidanceFlag = 'raise' | 'lower' | 'inline' | 'unknown'

/** Tägliche OHLCV-Kerze. */
export type MomentumBarDaily = {
  symbol: string
  handelstag: string
  open: number
  high: number
  low: number
  close: number
  adjClose: number | null
  volume: number
}

/** Anstehender Earnings-Termin. */
export type MomentumEarningsKalenderEintrag = {
  symbol: string
  earningsDate: string
  timeBmoAmc: MomentumEarningsZeit
  epsEstimate: number | null
  revenueEstimate: number | null
  quarter: number | null
  year: number | null
}

/** Vergangenes Earnings-Event mit Kursreaktion. */
export type MomentumEarningsEvent = {
  symbol: string
  earningsDate: string
  timeBmoAmc: MomentumEarningsZeit
  epsEstimate: number | null
  epsActual: number | null
  revenueEstimate: number | null
  revenueActual: number | null
  surpriseEpsPct: number | null
  surpriseRevPct: number | null
  guidanceFlag: MomentumGuidanceFlag
  pricePrevClose: number | null
  openGap: number | null
  closeDay1: number | null
  gapPct: number | null
  rvol: number | null
}

/** Täglicher Markt-Regime-Snapshot. */
export type MomentumMarketRegime = {
  handelstag: string
  spyClose: number | null
  spyMa20: number | null
  spyAbove20Ma: boolean | null
  vixClose: number | null
  vixChangePct: number | null
}

/** Ergebnis der Regel-Engine (Stufe A). */
export type MomentumScanEintrag = {
  scanDate: string
  symbol: string
  playbook: MomentumPlaybook
  score: number
  ampel: MomentumAmpel
  gatesPassed: string[]
  gatesFailed: string[]
  indikatoren: Record<string, number | string | boolean | null>
}

/** Trade-Journal-Eintrag. */
export type MomentumTrade = {
  id: string
  symbol: string
  playbook: MomentumPlaybook
  direction: MomentumRichtung
  entryDate: string
  entryPrice: number
  stopPrice: number | null
  targetPrice: number | null
  exitDate: string | null
  exitPrice: number | null
  riskEur: number
  pnlEur: number | null
  ruleCompliance: boolean
  notizen: string | null
  erstelltAm: string
}

/** Persönliche Watchlist — nur diese Titel werden geladen/gescrapt. */
export type MomentumWatchlistEintrag = {
  isin: string
  name: string
  symbolYahoo: string | null
  symbolCandidates: string[]
  hinzugefuegtAm: string
  earningsSyncAm: string | null
}

/** Status-Übersicht für die UI (Datenfundament). */
export type MomentumDatenStatus = {
  watchlistAnzahl: number
  watchlistMax: number
  barsAnzahl: number
  barsNeuesterTag: string | null
  earningsKalenderAnzahl: number
  earningsEventsAnzahl: number
  regimeNeuesterTag: string | null
  scanAnzahl: number
  tradesAnzahl: number
  supabaseKonfiguriert: boolean
}

/** Antwort des Earnings-Sync-Endpunkts. */
export type MomentumEarningsSyncErgebnis = {
  ok: boolean
  watchlistGroesse: number
  termineGeschrieben: number
  fehler: string[]
}

/** Antwort des Bars-Sync-Endpunkts. */
export type MomentumBarsSyncErgebnis = {
  ok: boolean
  symbole: number
  kerzenGeschrieben: number
  vonDatum: string
  bisDatum: string
  fehler: string | null
}

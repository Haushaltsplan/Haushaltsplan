/**
 * Momentum Trader — Typen.
 *
 * Kurzfristige, faktenbasierte Setups (Earnings-Gap, IPO-Fade, …).
 * Getrennt vom Nachkauf-Radar — andere Playbooks, andere Regeln.
 */

/** Playbook-Typen (erweiterbar). */
export type MomentumPlaybook =
  | 'earnings_gap_fade'
  | 'earnings_vorlauf'
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

/** Hard Gates aus Markt-Regime. */
export type MomentumRegimeGates = {
  longBias: boolean
  shortBias: boolean
  gatesPassed: string[]
  gatesFailed: string[]
  regime: MomentumMarketRegime
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
  ipoDatum: string | null
  ipoSyncAm: string | null
  notiz: string | null
}

/** Kompakte Gap-Historie für die Watchlist-UI. */
export type MomentumGapEventKurz = {
  datum: string
  gapPct: number | null
  rvol: number | null
  surpriseEpsPct: number | null
  timeBmoAmc: MomentumEarningsZeit
}

export type MomentumKalenderEintrag = {
  symbol: string
  name: string
  isin: string
  earningsDate: string
  timeBmoAmc: MomentumEarningsZeit
  zeitLabel: string
  tageBis: number
  medianGapPct: number | null
}

export type MomentumEarningsKalenderMonat = {
  von: string
  bis: string
  tage: Array<{ datum: string; eintraege: MomentumKalenderEintrag[] }>
  gesamt: number
}

export type MomentumScoreVerlaufPunkt = {
  datum: string
  score: number
  ampel: MomentumAmpel
  playbook: MomentumPlaybook
}

export type MomentumWatchlistEintragAngereichert = MomentumWatchlistEintrag & {
  naechstesEarnings: {
    datum: string
    timeBmoAmc: MomentumEarningsZeit
    zeitLabel: string
    tageBis: number | null
  } | null
  medianGapPct: number | null
  earningsEventsAnzahl: number
  letzteGapEvents: MomentumGapEventKurz[]
}

/** Scan-Paket inkl. Regime. */
export type MomentumScanPaket = {
  scanDate: string
  regime: MomentumRegimeGates | null
  ergebnisse: MomentumScanEintrag[]
}

/** Externe Datenquelle (Scraper/API). */
export type MomentumDatenquelle = {
  id: string
  name: string
  typ: 'scraper' | 'api'
  aktiv: boolean
  nutzen: string
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
  regime: MomentumMarketRegime | null
  scanAnzahl: number
  tradesAnzahl: number
  supabaseKonfiguriert: boolean
  datenquellen: MomentumDatenquelle[]
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

/** Komplette Sync-Pipeline. */
export type MomentumFullSyncErgebnis = {
  ok: boolean
  schritte: string[]
  fehler: string[]
  scan: MomentumScanPaket | null
}

/** Performance-Kennzahlen pro Playbook. */
export type MomentumPerformancePlaybook = {
  trades: number
  geschlossen: number
  pnlEur: number
  winRatePct: number | null
}

/** Journal-Performance (regelbasiert). */
export type MomentumPerformance = {
  tradesGesamt: number
  tradesGeschlossen: number
  tradesOffen: number
  winRatePct: number | null
  profitFactor: number | null
  pnlGesamtEur: number
  pnlDurchschnittEur: number | null
  ruleCompliancePct: number | null
  nachPlaybook: Record<MomentumPlaybook, MomentumPerformancePlaybook>
}

/** UI-Hinweis (Earnings, offene Trades, veraltete Daten). */
export type MomentumErinnerung = {
  typ:
    | 'earnings_heute'
    | 'earnings_morgen'
    | 'earnings_bald'
    | 'trade_offen'
    | 'daten_veraltet'
    | 'scan_verfuegbar'
  schwere: 'info' | 'warnung' | 'aktion'
  text: string
  symbol?: string
}

/** Handlungsempfehlung pro Titel. */
export type MomentumHandlungAktion =
  | 'beobachten'
  | 'vorbereiten'
  | 'trade_pruefen'
  | 'sync'
  | 'halten'

export type MomentumHandlungPosition = {
  symbol: string
  name: string
  aktion: MomentumHandlungAktion
  prioritaet: number
  text: string
}

/** Regelbasierte Empfehlung — was jetzt tun (auch ohne Trade-Setup). */
export type MomentumHandlungsempfehlung = {
  generiertAm: string
  zusammenfassung: string
  regimeText: string
  longBias: boolean
  shortBias: boolean
  datenHinweise: string[]
  positionen: MomentumHandlungPosition[]
  tradeSetups: MomentumScanEintrag[]
  hatAktivesTradeSetup: boolean
}

/** Trade aus Scan vorbereiten. */
export type MomentumTradeAnlegenInput = {
  symbol: string
  playbook: MomentumPlaybook
  direction: MomentumRichtung
  entryDate: string
  entryPrice: number
  stopPrice?: number | null
  targetPrice?: number | null
  riskEur?: number
  notizen?: string | null
}

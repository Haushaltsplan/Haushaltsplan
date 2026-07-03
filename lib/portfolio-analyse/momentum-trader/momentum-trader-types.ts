/**
 * Momentum Trader — Typen.
 *
 * Always-On Watchlist-Scanner: Earnings, Gap, Trend, Volumen.
 * Getrennt vom Nachkauf-Radar — andere Playbooks, andere Regeln.
 */

/** Playbook-Typen (erweiterbar). */
export type MomentumPlaybook =
  | 'earnings_gap_fade'
  | 'earnings_vorlauf'
  | 'earnings_pre_event'
  | 'earnings_pre_run'
  | 'earnings_momentum'
  | 'ipo_fade'
  | 'gap_fade'
  | 'gap_and_go'
  | 'volume_spike_breakout'
  | 'trend_pullback'
  | 'trend_breakout'
  | 'relative_strength_leader'
  | 'oversold_bounce'
  | 'overbought_fade'
  | 'range_fade'
  | 'sector_rotation_long'
  | 'market_regime_long'
  | 'market_regime_short'
  | 'news_gap'
  | 'analyst_upgrade'
  | 'earnings_post_run'
  | 'guidance_shock'
  | 'revenue_beat_divergence'
  | 'insider_cluster'
  | 'short_squeeze_setup'
  | 'nr7_breakout'
  | 'inside_day_breakout'
  | 'failed_breakout'
  | 'relative_weakness_fade'
  | 'capitulation_bounce'
  | 'ma_cross_momentum'
  | 'trend_exhaustion'
  | 'sector_laggard_catchup'
  | 'vix_spike_fade'

/** News-Katalysator (Google RSS). */
export type MomentumNewsSentiment = 'bullish' | 'bearish' | 'neutral'

export type MomentumNewsKatalysator = {
  symbol: string
  headline: string
  href: string
  veroeffentlichtAm: string
  sentiment: MomentumNewsSentiment
  tageAlt: number
}

/** Analyst-Rating-Änderung (MarketBeat). */
export type MomentumAnalystAktion = 'upgrade' | 'downgrade' | 'initiate' | 'reiterate' | 'target'

export type MomentumAnalystRating = {
  symbol: string
  datum: string
  aktion: MomentumAnalystAktion
  firma: string | null
  ratingAlt: string | null
  ratingNeu: string | null
  zielpreisAlt: number | null
  zielpreisNeu: number | null
}

/** SEC Form 4 Kauf via OpenInsider. */
export type MomentumInsiderKauf = {
  symbol: string
  tradeDate: string
  filingDate: string
  insiderName: string
  title: string | null
  tradeType: 'purchase' | 'sale'
  valueUsd: number | null
  qty: number | null
  price: number | null
}

/** Mehrere Insider-Käufe in kurzem Fenster. */
export type MomentumInsiderCluster = {
  symbol: string
  fensterTage: number
  kaufAnzahl: number
  insiderAnzahl: number
  gesamtWertUsd: number | null
  letzterKauf: string
  kauefe: MomentumInsiderKauf[]
}

/** Technischer Snapshot pro Symbol (für tägliche Playbooks). */
export type MomentumTechSnapshot = {
  symbol: string
  scanDate: string
  handelstag: string
  close: number
  open: number
  high: number
  low: number
  gapPct: number | null
  rvol: number | null
  atr: number | null
  atrPct: number | null
  ma20: number | null
  ma50: number | null
  rsi14: number | null
  bbUpper: number | null
  bbLower: number | null
  high20d: number | null
  high52w: number | null
  low20d: number | null
  distHigh52wPct: number | null
  return20dPct: number | null
  rsVsSpy20d: number | null
  rsVsSector20d: number | null
  uptrend: boolean
  downtrend: boolean
  aboveMa20: boolean
  range20dPct: number | null
  distRangeLowPct: number | null
  distRangeHighPct: number | null
  shortFloatPct: number | null
}

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
  /** S&P 5-Tage-Performance (%). */
  spyReturn5dPct: number | null
}

/** Hard Gates aus Markt-Regime. */
export type MomentumRegimeGates = {
  longBias: boolean
  shortBias: boolean
  gatesPassed: string[]
  gatesFailed: string[]
  regime: MomentumMarketRegime
}

/** Erweiterter Scan-Kontext (Breadth, Sektor-Trends). */
export type MomentumRegimeKontext = {
  spyReturn5dPct: number | null
  watchlistBreadthPct: number | null
  /** Sektor-ETF → 5-Tage-Return (%). */
  sectorReturn5d: Record<string, number>
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
  /** Scan-Datum des Ausgangs-Signals (wenn aus Scan erfasst). */
  scanDate?: string | null
  signalErfolgPct?: number | null
  ausScan?: boolean
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
  surpriseRevPct?: number | null
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
  datenqualitaet: MomentumDatenqualitaet
  liveKurs: MomentumLiveKurs | null
}

/** Live-/Extended-Hours-Kurs (Yahoo quoteSummary). */
export type MomentumLiveKurs = {
  preis: number
  quelle: 'regular' | 'pre' | 'post'
  marketState: string | null
  gapVsPrevClosePct: number | null
  aktualisiertAm: string
}

export type MomentumDatenqualitaetCheck = {
  id: string
  label: string
  ok: boolean
  detail: string
}

export type MomentumDatenqualitaet = {
  score: number
  status: 'gut' | 'teilweise' | 'schwach' | 'pre_ipo'
  checks: MomentumDatenqualitaetCheck[]
  empfehlung: string | null
}

/** Ergebnis Einzel-Ticker-Sync. */
export type MomentumTickerSyncErgebnis = {
  ok: boolean
  schritte: string[]
  fehler: string[]
  eintrag: MomentumWatchlistEintragAngereichert | null
}

/** Scan-Paket inkl. Regime. */
export type MomentumScanPaket = {
  scanDate: string
  regime: MomentumRegimeGates | null
  ergebnisse: MomentumScanEintrag[]
  playbookStats?: MomentumPlaybookStatsPaket | null
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
    | 'pre_event_aktiv'
    | 'trade_offen'
    | 'daten_veraltet'
    | 'scan_verfuegbar'
    | 'top_signal'
  schwere: 'info' | 'warnung' | 'aktion'
  text: string
  symbol?: string
}

/** Pre-Event-Signal vs. Post-Earnings-Trade-Setup (Scan-Verlauf). */
export type MomentumKatalysatorTrackingEintrag = {
  symbol: string
  earningsDate: string
  preEventScore: number | null
  preEventAmpel: MomentumAmpel | null
  postTradeSetup: boolean
  postPlaybook: MomentumPlaybook | null
  postAmpel: MomentumAmpel | null
  gapPct: number | null
  treffer: boolean
}

export type MomentumKatalysatorTracking = {
  fensterTage: number
  /** Earnings mit Pre-Event-Signal (gelb, Score ≥45) in den 14 Tagen davor */
  katalysatoren: number
  /** Davon mit Gap-Fade/Momentum-Setup innerhalb 0–3 Tage nach Earnings */
  mitTradeSetup: number
  trefferquotePct: number | null
  eintraege: MomentumKatalysatorTrackingEintrag[]
}

/** Forward-Outcome eines archivierten Top-Signals. */
export type MomentumTopSignalOutcome = 'win' | 'loss' | 'timeout' | 'pending'

export type MomentumTopSignalEintrag = {
  symbol: string
  playbook: MomentumPlaybook
  scanDate: string
  direction: MomentumRichtung
  score: number
  ampel: MomentumAmpel
  erfolgPct: number
  entryPrice: number
  stopPrice: number
  targetPrice: number
  outcome: MomentumTopSignalOutcome
  /** Trade aus Journal zu diesem Signal erfasst */
  imJournal: boolean
  journalPnlEur: number | null
  journalGeschlossen: boolean
}

export type MomentumTopSignalPlaybookStat = {
  signale: number
  gewinne: number
  trefferPct: number | null
}

/** Top-Signal-Tracking: Vorhersage vs. tatsächlicher Kursverlauf + Journal-Vergleich. */
export type MomentumTopSignalTracking = {
  fensterTage: number
  signaleGesamt: number
  ausgewertet: number
  ausstehend: number
  gewinne: number
  verluste: number
  timeouts: number
  trefferquotePct: number | null
  avgVorhersagePct: number | null
  kalibrierungsDeltaPct: number | null
  journalSignale: number
  journalGeschlossen: number
  journalWinRatePct: number | null
  journalPnlEur: number | null
  nachPlaybook: Partial<Record<MomentumPlaybook, MomentumTopSignalPlaybookStat>>
  eintraege: MomentumTopSignalEintrag[]
}

/** Backtest-Ergebnis pro Playbook (global oder pro Symbol). */
export type MomentumPlaybookStat = {
  playbook: MomentumPlaybook
  /** leer = aggregiert über alle Watchlist-Titel */
  symbol: string
  wins: number
  losses: number
  timeouts: number
  sampleSize: number
  trefferPct: number | null
  fensterTage: number
  berechnetAm: string
}

export type MomentumPlaybookStatsPaket = {
  stats: MomentumPlaybookStat[]
  berechnetAm: string | null
  fensterTage: number
}

/** Suchtreffer für Momentum-Watchlist (Börse + Pre-IPO). */
export type MomentumWatchlistSuchTreffer = {
  symbol: string
  name: string
  exchange: string | null
  istPreIpo: boolean
  ipoDatumVorschlag: string | null
  notiz: string | null
}

export type MomentumWatchlistAufloesung = {
  isin: string
  name: string
  symbolYahoo: string | null
  symbolCandidates: string[]
  istPreIpo: boolean
  ipoDatum: string | null
  notiz: string | null
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

/** Long/Short-Empfehlung mit datenbasierter Wahrscheinlichkeit. */
export type MomentumHandlungssignal = {
  symbol: string
  richtung: MomentumRichtung | 'warten'
  wahrscheinlichkeitPct: number
  playbook: MomentumPlaybook
  /** Jetzt handeln oder erst nach Earnings */
  phase: 'jetzt' | 'vor_earnings' | 'nach_earnings'
  istAktiv: boolean
  prioritaet: number
  kurztext: string
  /** Eine Zeile — was du jetzt konkret tun sollst */
  aktionJetzt: string
  detailText: string
  risikoHinweis: string
  timing: string
  /** Kurz-Checkliste vor dem Trade */
  checkliste: string[]
  warnungen: string[]
  fakten: string[]
  alternativen: Array<{
    richtung: MomentumRichtung | 'warten'
    wahrscheinlichkeitPct: number
    label: string
  }>
  /** Konkrete Levels: Entry, Stop, Hebel, Schritt-für-Schritt */
  plan: MomentumHandlungsplan | null
  /** 0–100: EV-basierter Planungs-Score */
  planungsScore: number
  planungsLabel: string
  planungsErwartungEur: number | null
}

/** CFD/Aktie — konkrete Ausführungsempfehlung. */
export type MomentumHandlungsschrittPhase = 'jetzt' | 'nach_event' | 'trigger' | 'risiko'

export type MomentumHandlungsschritt = {
  nr: number
  phase: MomentumHandlungsschrittPhase
  titel: string
  detail?: string
}

export type MomentumHandlungsplan = {
  modus: 'aktiv' | 'vorbereitung'
  instrumentLabel: string
  richtung: MomentumRichtung
  entryPreis: number
  entryHinweis: string
  stopLoss: number
  takeProfit: number
  stopAbstandPct: number
  zielAbstandPct: number
  riskEur: number
  hebelEmpfohlen: number
  marginEur: number
  exposureEur: number
  stueckzahl: number | null
  gewinnZielEur: number
  triggerBedingungen: string[]
  /** Strukturierte Schritt-für-Schritt-Anleitung */
  schritte: MomentumHandlungsschritt[]
  /** Was du bewusst nicht tun sollst */
  nichtTun: string[]
  /** Wann genau handeln (BMO/AMC/Pre-Run) */
  zeitfenster: string | null
  schritteJetzt: string[]
  schritteNachEarnings: string[]
  exitBis: string | null
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
  topSignal: MomentumHandlungssignal | null
  signale: MomentumHandlungssignal[]
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

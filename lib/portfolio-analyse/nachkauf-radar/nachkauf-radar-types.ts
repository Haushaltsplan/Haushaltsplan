/**
 * Nachkauf-Radar — Typen.
 *
 * Stufe A: monatlicher Scan (Flash, regelbasiert + kurze KI-Begründung).
 * Stufe B: Deep Research (Pro, ausführliche Memo) für Top-Kandidaten.
 */

/** Nachkauf-Ampel pro Depot-Titel. */
export type NachkaufAmpel =
  | 'gruen'   // Quality intakt, Bewertung attraktiv → Nachkauf prüfen
  | 'gelb'    // Interessant, aber Abstriche bei Quality oder Bewertung
  | 'rot'     // Sell-Trigger aktiv oder operative Qualität beschädigt
  | 'teuer'   // Quality intakt, aber Bewertung zu hoch → diesen Monat sparen
  | 'grau'    // Zu wenig Daten für Bewertung

/** Detaillierte Score-Zerlegung (rein regelbasiert, kein LLM). */
export type NachkaufScoreDetail = {
  /** Mantra-Qualitäts-Score (0–50). */
  mantraScore: number
  /** Personalisierte Bewertung vs. eigene Kaufzone/Median (0–35). */
  bewertungsScore: number
  /** Sell-Trigger-Abzug (0, -10 oder -25). */
  sellTriggerPenalty: number
  /** Gesamt (0–100, kann durch Penalty unter 0 sinken → auf 0 geclamped). */
  gesamt: number
  /**
   * Bewertungs-Bonus/Malus aus historischem Vergleich (–10 bis +10).
   * Positiv = günstiger als historischer Median / Perzentil.
   */
  historischerBewertungsBonus: number
  /** Beat/Miss, CapAlloc, Struktur, Insider (Summe der Teilpunkte). */
  datenSignaleDelta: number
  /** Operative Dynamik: Earnings, CapAlloc, Wachstum (0–12). */
  momentumPunkte: number
  /** Bilanz & Risiko: Schulden, CapEx, Short, Qualität 2–7 (–12 bis +6). */
  strukturPunkte: number
  /**
   * Lesbare Zerlegung der Struktur-Punkte (persistiert in score_detail JSON).
   * Fehlt bei älteren Scans → UI fällt auf datenSignale zurück.
   */
  strukturSignale?: import('./nachkauf-struktur-aufschluesselung').StrukturSignalZeile[]
  /** Qualitäts-Titel mit Rücksetzer (0–3, früher bis 5 — Drawdown nicht doppelt belohnen). */
  drawdownBonus: number
  /** Insider-Käufe Form 4 / OpenInsider (0–4). */
  insiderPunkte: number
  /** Kaufzonen-Trigger aktiv (+5). */
  kauftriggerBonus: number
  /** Markt-Regime SPY/VIX (–3 bis +4). */
  regimeDelta: number
  /** Earnings in 0–5 Tagen (–3 bis –1). */
  earningsMalus: number
  /** Bear-Case aus Deep Research (–12 bis 0). */
  deepResearchMalus: number
  /** Depot-Klumpenrisiko ≥15 % (–6 bis –8). */
  klumpenMalus: number
  /** Sektor-Überkonzentration unter Grün-Kandidaten (–4 bis 0). */
  sektorMalus: number
  /** Backtest-Kalibrierung aus Performance-Tracking (–3 bis +2). */
  scoreKalibrierung: number
  /**
   * Qualitäts-Achse Q (0–100): Mantra + Sell + DR/SEC.
   * Alias für Ranking/UI — geometrisches Modell.
   */
  qualitaetsRang: number
  /**
   * Timing-Achse T (0–100): Bewertung × Hist-Feintuning × Struktur-Multiplikator.
   */
  timingRang: number
  /** Geometrischer Kern √(Q·T), primäres Ranking-Maß. */
  kombiniertRang: number
  /** Gate G1: Mantra ≥ 38, kein Sell-Warn. */
  gateG1?: boolean
  /** Gate G2: Trigger oder echte Unterbewertung. */
  gateG2?: boolean
  /** Gate G3: Premium>0 ∧ DD<12% ∧ kein Trigger → Teuer. */
  gateG3Teuer?: boolean
  /** Struktur-Multiplikator auf T (1.02 / 0.90 / 0.75). */
  strukturMultiplikator?: number
  /** Segment-Datenqualität für Struktur-Gate. */
  segmentDatenQualitaet?: 'validiert' | 'nur_ms' | 'keine'
  /** Wie vollständig die Entscheidungsdaten sind (0–100 %). */
  datenVollstaendigkeitPct: number
}

/** Bewertungssignale, die für Score und Anzeige verwendet werden. */
export type NachkaufBewertungsSignale = {
  /** FCF-Rendite (FCF / Market Cap * 100). null = keine Daten. */
  fcfYieldPct: number | null
  /** NTM-KGV (Forward P/E). null = keine Daten. */
  forwardPe: number | null
  /**
   * Abstand vom 52-Wochen-Hoch in Prozent (positiver Wert = Drawdown).
   */
  drawdown52wPct: number | null
  /**
   * Premium/Discount gegenüber dem eigenen historischen Median-KGV.
   * Negativ = günstiger als historisch, positiv = teurer.
   * null = kein historischer Median verfügbar.
   */
  premiumDiscountPct: number | null
  /** Aktuelles KGV als Perzentil der eigenen 5J-Historie (0=günstig … 100=teuer). */
  pePerzentil5y?: number | null
  /** Aktuelles KGV als Perzentil der eigenen 10J-Historie. */
  pePerzentil10y?: number | null
  /** Automatisch berechneter 5J-Median-KGV (Macrotrends). */
  historischerMedianPe?: number | null
  /**
   * Historischer Median-FCF-Yield (Macrotrends oder Whitelist-Fallback).
   * Für Vergleich im UI: FCF-Yield aktuell vs. Median.
   */
  historischerMedianFcfYield?: number | null
  /** Quelle der historischen Mediane. */
  historischQuelle?: 'macrotrends' | 'whitelist' | null
  /** EPS-Beat-Rate letzte ~8 Quartale (%). */
  epsBeatRatePct?: number | null
  /** Capital-Allocation-Score (0–100). */
  capitalAllocationScorePct?: number | null
  /** Net Debt / EBITDA (LTM). */
  netDebtEbitda?: number | null
  /** Net Debt / Free Cashflow (LTM). */
  netDebtFcf?: number | null
  /** PEG-Ratio (Forward P/E ÷ EPS-Wachstum). */
  pegRatio?: number | null
  /** Short Float % (Finviz, US). */
  shortFloatPct?: number | null
  /** NTM / FY EV / EBITDA. */
  ntmEvEbitda?: number | null
  /** NTM / FY EV / Umsatz. */
  ntmEvRev?: number | null
  /** 5J-Median EV/EBITDA (Macrotrends-Rekonstruktion). */
  historischerMedianEvEbitda?: number | null
  /** 5J-Median EV/Umsatz. */
  historischerMedianEvRev?: number | null
  /** Aktuelles EV/EBITDA als Perzentil der 5J-Historie (0=günstig … 100=teuer). */
  evEbitdaPerzentil5y?: number | null
  /** Aktuelles EV/EBITDA als Perzentil der 10J-Historie. */
  evEbitdaPerzentil10y?: number | null
  /** Aktuelles EV/Umsatz als Perzentil der 5J-Historie. */
  evRevPerzentil5y?: number | null
  /** Datenabdeckung für Entscheidung (0–100 %). */
  datenVollstaendigkeitPct?: number | null
}

/** Ein historischer Score-Datenpunkt für die Sparkline. */
export type ScoreVerlaufPunkt = {
  datum: string   // ISO-Datum (YYYY-MM-DD)
  score: number
  ampel: NachkaufAmpel
}

/** Insider-Transaktion (Form 4, nur Käufe). */
export type InsiderKauf = {
  datum: string
  name: string
  titel: string
  anteile: number
  wertUsd: number
}

/** Kaufhistorie aus portfolio_analyse_buchung. */
export type Kaufhistorie = {
  letzterKaufAm: string | null
  anzahlKaeufe: number
  durchschnittskaufpreisEur: number | null
  /** Anzahl Tage seit dem letzten Kauf. null = noch nie gekauft. */
  tageSeitletztemKauf: number | null
}

/** Kategorie eines Verkaufs-/Trim-Faktors (emotionslos, datenbasiert). */
export type TrimSignalKategorie =
  | 'klumpenrisiko'
  | 'qualitaet'
  | 'bewertung_hype'
  | 'score_verfall'
  | 'struktur'
  | 'insider'

export type TrimSignalAktion = 'teilverkauf' | 'vollverkauf' | 'ueberpruefen'
export type TrimSignalDringlichkeit = 'hoch' | 'mittel' | 'niedrig'

/** Einzelner, nachvollziehbarer Verkaufsgrund. */
export type TrimFaktor = {
  kategorie: TrimSignalKategorie
  text: string
  /** Gewicht 1–3 für Prioritätsberechnung. */
  gewicht: number
}

/**
 * Verkaufs-/Trim-Signal: regelbasiert aus Depot-Gewicht, Score, Qualität, Bewertung.
 */
export type TrimSignal = {
  /** Legacy-Kompatibilität für UI-Filter. */
  typ: 'trim' | 'ueberpruefen'
  aktion: TrimSignalAktion
  dringlichkeit: TrimSignalDringlichkeit
  /** Empfohlener Verkaufsanteil der Position in % (null = nur prüfen). */
  verkaufAnteilPct: number | null
  /** Ziel-Depotgewicht nach Trim in %. */
  zielDepotGewichtPct: number | null
  faktoren: TrimFaktor[]
  /** Zusammengefasste Begründung für UI und KI. */
  grund: string
  /** 0–100 für Sortierung der Verkaufsempfehlungen. */
  prioritaet: number
}

/** Regelbasierte Verkaufsempfehlung (Stufe C). */
export type VerkaufPosten = {
  ticker: string
  name: string
  verkaufAnteilPct: number
  begruendung: string
  dringlichkeit: TrimSignalDringlichkeit
  faktoren: string[]
}

/** Ein Eintrag im Scan-Ergebnis (ein Depot-Titel). */
export type NachkaufScanEintrag = {
  ticker: string
  isin: string
  name: string
  ampel: NachkaufAmpel
  score: number
  scoreDetail: NachkaufScoreDetail
  bewertung: NachkaufBewertungsSignale
  mantraAmpel: string | null
  mantraScorePct: number | null
  sellTriggerOk: boolean
  /** Kurzbegründung vom Flash-LLM (2–3 Sätze). */
  kiBegruendung: string | null
  /** ISO-Zeitstempel des letzten Scans. */
  gescannt_am: string
  /** Deep-Research-Memo, falls bereits erstellt. */
  tiefenAnalyse: NachkaufDeepResearch | null
  /**
   * Aktueller Anteil dieser Position am Depot-Marktwert (0–100 %).
   * Dynamisch berechnet — nicht in der DB gespeichert.
   */
  depotGewichtPct: number | null
  /** true wenn depotGewichtPct >= 15 % (Klumpenrisiko). */
  klumpenrisiko: boolean
  /**
   * true wenn eine manuelle Kaufzone aus der Whitelist ausgelöst wurde
   * (z. B. Forward P/E < 22× oder FCF-Rendite > 3,5 %).
   */
  kaufTriggerAusgeloest: boolean
  /** Beschreibung des ausgelösten Triggers (für UI-Tooltip). */
  kaufTriggerText: string | null
  /**
   * Historischer Score-Verlauf (letzte 12 Monate).
   * Dynamisch geladen — nicht in der Haupt-DB-Zeile.
   */
  scoreVerlauf: ScoreVerlaufPunkt[]
  /**
   * Insider-Käufe der letzten 90 Tage (SEC Form 4, OpenInsider, EU Dealings).
   */
  insiderKaeufe: InsiderKauf[]
  /** Zusatzdaten für UI (Beat/Miss, Schätzungen, CapAlloc). */
  datenSignale?: import('./nachkauf-zusatz-signale-server').NachkaufZusatzSignale | null
  /** Kaufhistorie aus portfolio_analyse_buchung. Dynamisch geladen. */
  kaufhistorie?: Kaufhistorie
  /** Freitext-Notiz des Nutzers. Dynamisch geladen. */
  notiz?: string
  /** Verkaufs-/Trim-Signal. Dynamisch berechnet. */
  trimSignal?: TrimSignal
  /** Disziplin-Hinweis (frischer Kauf, fallender Score) — ohne Score-Änderung. */
  disziplinHinweis?: string | null
}

/** Sparplan-Allokation für einen einzelnen Titel. */
export type SparplanPosten = {
  ticker: string
  name: string
  betragEur: number
  begruendung: string
}

/** Monatliche Gesamt-Empfehlung des Radars. */
export type MonatsEmpfehlung =
  | {
      typ: 'nachkauf'
      tickers: string[]
      text: string
      /** Konkrete EUR-Aufteilung des Sparplans (Summe = 500 €). */
      sparplanAllokation: SparplanPosten[]
    }
  | { typ: 'sparen'; text: string }
  | { typ: 'beobachten'; text: string }

/** Rückgabeobjekt des Scan-Endpunkts. */
export type NachkaufScanPaket = {
  ok: boolean
  ergebnisse: NachkaufScanEintrag[]
  monatsEmpfehlung: MonatsEmpfehlung
  gescannt_am: string
  gesamtAnzahl: number
  gescannt: number
  ausstehend: number
  /** Noch zu scannen in diesem Lauf (Chunking). */
  verbleibend?: number
  /** Scan wurde wegen Zeitlimit/Chunk vorzeitig beendet. */
  teilscan?: boolean
  fehler?: string | null
}

/** Anfrage an den Scan-Endpunkt. */
export type NachkaufScanAnfrage = {
  ticker?: string | null
  erzwingen?: boolean
  /** Wenn gesetzt, wird nur diese ISIN neu gescannt (Einzel-Rescan). */
  nurEinenTicker?: string
  /** Fehlende Titel scannen, bereits vorhandene überspringen. */
  nurFehlende?: boolean
  /** Für Cron: erzwinge false ist default, nurFehlende true. */
  erzwinge?: boolean
  /** Startindex in der zu scannenden Liste (Chunking). */
  offset?: number
  /** Max. Titel pro API-Aufruf (Vercel-Timeout-Schutz). */
  maxProAufruf?: number
  /** Server bricht ab, wenn Budget überschritten (ms). */
  zeitBudgetMs?: number
  /** Kein Ranking/Insider-Anreichern am Ende des Chunks (nur Orchestrierung, Daten bleiben voll). */
  leicht?: boolean
  /** Scan abschließen: Kaufhistorie-Cache + volle Anreicherung. */
  abschliessen?: boolean
}

/** Deep-Research-Memo für einen Titel (Stufe B). */
export type NachkaufDeepResearch = {
  ticker: string
  isin: string
  memo: string
  erstellt_am: string
}

/** Anfrage an den Deep-Research-Endpunkt. */
export type NachkaufDeepResearchAnfrage = {
  ticker: string
  isin?: string | null
  name?: string | null
}

/** Rückgabe des Ergebnis-Endpunkts (GET). */
export type NachkaufErgebnissePaket = {
  ok: boolean
  ergebnisse: NachkaufScanEintrag[]
  gescannt_am: string | null
  monatsEmpfehlung: MonatsEmpfehlung | null
  gesamtAnzahl?: number
  ausstehend?: number
}

/** Ein gespeichertes Empfehlungs-Tracking (Forward-Performance). */
export type NachkaufTrackingEintrag = {
  monat: string
  ticker: string
  name: string
  empfohlenBetragEur: number
  score: number
  kaufTrigger: boolean
  empfohlenAm: string
  kursUsd: number | null
  rendite6mPct: number | null
  rendite12mPct: number | null
  spyRendite6mPct: number | null
  spyRendite12mPct: number | null
  alpha6mPct: number | null
  alpha12mPct: number | null
  status: 'offen' | '6m' | '12m' | 'voll'
}

export type NachkaufScoreBucketStat = {
  bucket: string
  anzahl: number
  avgAlpha6mPct: number | null
}

export type NachkaufPerformanceUebersicht = {
  anzahlEmpfehlungen: number
  ausgewertet6m: number
  ausgewertet12m: number
  avgRendite6mPct: number | null
  avgAlpha6mPct: number | null
  avgRendite12mPct: number | null
  avgAlpha12mPct: number | null
  trefferquote6mPct: number | null
  scoreBucketsEmpfehlung: NachkaufScoreBucketStat[]
  scoreBucketsSignal: NachkaufScoreBucketStat[]
  eintraege: NachkaufTrackingEintrag[]
}

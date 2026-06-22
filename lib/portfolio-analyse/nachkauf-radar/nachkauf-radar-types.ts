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
  /** Mantra-Qualitäts-Score (0–60). */
  mantraScore: number
  /** Bewertungs-Score aus FCF-Yield + Forward-KGV (0–40). */
  bewertungsScore: number
  /** Sell-Trigger-Abzug (0, -10 oder -25). */
  sellTriggerPenalty: number
  /** Gesamt (0–100, kann durch Penalty unter 0 sinken → auf 0 geclamped). */
  gesamt: number
  /**
   * Bewertungs-Bonus/Malus aus historischem Vergleich (–10 bis +10).
   * Positiv = günstiger als historischer Median.
   */
  historischerBewertungsBonus: number
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
   * null = kein historischer Median in der Whitelist hinterlegt.
   */
  premiumDiscountPct: number | null
  /**
   * Historischer Median-FCF-Yield aus der Whitelist.
   * Für Vergleich im UI: FCF-Yield aktuell vs. Median.
   */
  historischerMedianFcfYield?: number | null
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

/**
 * Verkaufs-/Trim-Signal: wird ausgelöst wenn Position zu groß oder Score stark gesunken.
 */
export type TrimSignal = {
  typ: 'trim' | 'ueberpruefen'
  grund: string
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
   * Insider-Käufe der letzten 90 Tage (SEC EDGAR Form 4).
   * Nur für US-Positionen. Dynamisch geladen.
   */
  insiderKaeufe: InsiderKauf[]
  /** Kaufhistorie aus portfolio_analyse_buchung. Dynamisch geladen. */
  kaufhistorie?: Kaufhistorie
  /** Freitext-Notiz des Nutzers. Dynamisch geladen. */
  notiz?: string
  /** Verkaufs-/Trim-Signal. Dynamisch berechnet. */
  trimSignal?: TrimSignal
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

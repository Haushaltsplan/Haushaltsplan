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
}

/** Bewertungssignale, die für Score und Anzeige verwendet werden. */
export type NachkaufBewertungsSignale = {
  /** FCF-Rendite (FCF / Market Cap * 100). null = keine Daten. */
  fcfYieldPct: number | null
  /** NTM-KGV (Forward P/E). null = keine Daten. */
  forwardPe: number | null
  /**
   * Abstand vom 52-Wochen-Hoch in Prozent (positiver Wert = Drawdown).
   * Proxy: (52w_hoch – 52w_tief) / 52w_hoch * 100.
   */
  drawdown52wPct: number | null
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
   * Wird dynamisch aus dem neuesten Portfolio-Snapshot berechnet — nicht in der DB gespeichert.
   * null = kein Snapshot vorhanden oder Position nicht im Depot.
   */
  depotGewichtPct: number | null
  /**
   * true wenn depotGewichtPct >= 15 % (Klumpenrisiko-Warnung).
   * Nachkauf trotzdem möglich, aber explizit begründet.
   */
  klumpenrisiko: boolean
}

/** Monatliche Gesamt-Empfehlung des Radars. */
export type MonatsEmpfehlung =
  | { typ: 'nachkauf'; tickers: string[]; text: string }
  | { typ: 'sparen'; text: string }
  | { typ: 'beobachten'; text: string }

/** Rückgabeobjekt des Scan-Endpunkts. */
export type NachkaufScanPaket = {
  ok: boolean
  ergebnisse: NachkaufScanEintrag[]
  monatsEmpfehlung: MonatsEmpfehlung
  gescannt_am: string
  /** Anzahl aller Positionen in der Whitelist. */
  gesamtAnzahl: number
  /** Anzahl tatsächlich gescannter Positionen in diesem Lauf. */
  gescannt: number
  /** Noch nicht gescannte Positionen (z. B. nach Timeout). */
  ausstehend: number
  fehler?: string | null
}

/** Anfrage an den Scan-Endpunkt. */
export type NachkaufScanAnfrage = {
  /** Nur diesen Ticker scannen (für Test/Einzelscan). Fehlt → alle Depot-Titel. */
  ticker?: string | null
  /** Scan erzwingen, auch wenn Cache noch frisch ist. */
  erzwingen?: boolean
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

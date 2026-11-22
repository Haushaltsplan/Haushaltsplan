/** Long-Form-Aktienanalyse: Projektzustand, Faktenblatt, Skript, Stimme. Client und Server. */

export const LONGFORM_INVEST_USD = 10_000

/** Fester Aufbau jedes Videos. Die Reihenfolge ändert sich nie. */
export const LONGFORM_ABSCHNITTE = [
  'hook',
  'chart10k',
  'geschaeft',
  'burggraben',
  'inhaber',
  'zahlen',
  'bewertung',
  'risiken',
  'scorecard',
  'fazit',
] as const
export type LongformAbschnittId = (typeof LONGFORM_ABSCHNITTE)[number]

/** Test = Anfang des späteren Videos: Hook, Chart, Geschäft, Moat. Dieselben Bilder, nichts dazwischengeschoben. */
export const LONGFORM_AKTIVE_ABSCHNITTE: LongformAbschnittId[] = ['hook', 'chart10k', 'geschaeft', 'burggraben']

export const LONGFORM_ABSCHNITT_TITEL: Record<LongformAbschnittId, string> = {
  hook: 'Hook',
  chart10k: '10 years, $10,000',
  geschaeft: 'How they make money',
  burggraben: 'The moat',
  inhaber: 'Who owns it',
  zahlen: 'The numbers',
  bewertung: 'Valuation',
  risiken: 'What could go wrong',
  scorecard: 'Scorecard',
  fazit: 'Would I buy?',
}

export type LongformEinheit = 'usd' | 'pct' | 'pp' | 'x' | 'jahre' | 'score' | 'zahl' | 'text'

export type LongformFakt = {
  /** Stabile Kennung, z. B. „k10.endwert“. Das Skript verweist nur hierauf. */
  id: string
  label: string
  wert: number | null
  /** Englisch formatiert, so wie es im Video stehen darf. */
  text: string
  einheit: LongformEinheit
  /** ISO-Datum: Exportdatum oder Kursdatum. */
  stichtag: string
  /** Pfad bzw. Herkunft, für die Faktenblatt-Ansicht. */
  quelle: string
}

export type LongformChartPunkt = {
  d: string
  /** Total Return (Dividenden reinvestiert). */
  aktie: number
  /** Nur Kurs / Close, ohne Dividenden-Reinvest. */
  kursOhneDiv: number | null
  spy: number | null
  /** Sektor-ETF Total Return, falls bekannt. */
  sektor: number | null
}

export type LongformChart10k = {
  startDatum: string
  endDatum: string
  /** Wert eines 10.000-$-Investments, wöchentlich, Dividenden reinvestiert. */
  punkte: LongformChartPunkt[]
  /** Nur Kurs, ohne Dividenden — für den Dividendenanteil. */
  endwertNurKurs: number
  endwertGesamt: number
  endwertSpy: number | null
  endwertSektor: number | null
  /** Yahoo-Ticker des Sektor-ETFs (z. B. XLK), null wenn unbekannt/fehlend. */
  sektorEtf: string | null
  drawdown: { hochDatum: string; tiefDatum: string; pct: number } | null
  /** Handelswährung; die Rechnung läuft immer in USD. */
  waehrung: string
  jahre: number
}

export type LongformMoatPfeiler = { id: string; label: string; score: number; begruendung: string; risiko: string }

export type LongformMoat = {
  pfeiler: LongformMoatPfeiler[]
  score: number
  urteil: string
  geschaeftsmodell: string
  zerstoerung: string[]
}

export type LongformScorecardBalken = { label: string; wertText: string; position: number | null }

export type LongformScorecardSpalte = { titel: string; score: number | null; balken: LongformScorecardBalken[] }

export type LongformSegmentEintrag = {
  name: string
  anteilPct: number
  /** Operative Marge in Prozent, null wenn der 10-K sie nicht ausweist. */
  margePct: number | null
  /** Umsatzwachstum zum Vorjahr in Prozent, null ohne Vorjahr. */
  wachstumPct: number | null
}

export type LongformSegmente = {
  art: 'produkt' | 'geo'
  jahr: number | null
  eintraege: LongformSegmentEintrag[]
}

export type LongformJahresreiheId = 'umsatz' | 'marge' | 'gewinn' | 'fcf'

export type LongformJahresreihe = {
  id: LongformJahresreiheId
  label: string
  einheit: 'usd' | 'pct'
  punkte: { jahr: number; wert: number }[]
}

export type LongformQuelle = {
  id: string
  name: string
  art: 'pdf' | 'bild' | 'text'
  /** Storage-Pfad im Bucket youtube-longform. */
  pfad: string
  mime: string
}

export type LongformFaktenblatt = {
  ticker: string
  firmenname: string
  isin: string | null
  symbolYahoo: string | null
  sektor: string | null
  branche: string | null
  beschreibung: string | null
  website: string | null
  exportDatum: string
  kursDatum: string | null
  fakten: LongformFakt[]
  chart: LongformChart10k | null
  moat: LongformMoat | null
  burggraben: LongformScorecardSpalte | null
  segmente: LongformSegmente | null
  /** Jahresreihen aus dem 10-K. Leer, wenn der Export sie nicht hat. */
  reihen: LongformJahresreihe[]
  logoUrl: string | null
  /** true/false aus dem Cloud-Depot, null = unbekannt. */
  imDepot: boolean | null
  hinweise: string[]
}

export const LONGFORM_HOOK_TYPEN = [
  'zahl_schock',
  'gegen_konsens',
  'produkt_alltag',
  'gruender_story',
  'schlechtester_tag',
  'mythos_fakt',
  'rivalen_vergleich',
  'offene_frage',
] as const
export type LongformHookTyp = (typeof LONGFORM_HOOK_TYPEN)[number]

export type LongformHookVorschlag = {
  typ: LongformHookTyp
  leitfrage: string
  /** 2–4 Sätze, gesprochen. */
  saetze: { text: string; faktIds: string[] }[]
  /** Warum dieser Winkel zu den Daten passt, für dich im Studio. */
  begruendung: string
}

export const LONGFORM_SZENEN = [
  'hook_zahl',
  'hook_frage',
  'hook_bild',
  'chart_linie',
  'chart_endwert',
  'chart_drawdown',
  'chart_vergleich',
  'moat_geschaeft',
  'moat_pfeiler',
  'moat_scorecard',
  'moat_finanzen',
  'moat_segmente',
  'zahl_reihe',
  'bild',
  'titel_karte',
  'abo_karte',
  'disclaimer',
  'schluss',
] as const
export type LongformSzenenTyp = (typeof LONGFORM_SZENEN)[number]

export type LongformVisual = {
  szene: LongformSzenenTyp
  /** Worauf die Kamera zielt, z. B. Pfeiler-ID oder „endwert“. */
  fokus?: string | null
  /** Wort im Satz, bei dem Zahl/Zoom einsetzt. */
  betonung?: string | null
  /** Englischer Suchbegriff für Fotos, nur bei szene „bild“ oder „hook_bild“. */
  bildWunsch?: string | null
}

export type LongformPruefHinweis = {
  art: 'zahl_ohne_fakt' | 'fakt_unbekannt' | 'floskel' | 'wiederholung' | 'behauptung' | 'sprache'
  text: string
}

export type LongformSatz = {
  id: string
  text: string
  faktIds: string[]
  visual: LongformVisual
  hinweise?: LongformPruefHinweis[]
}

export type LongformAbschnitt = { id: LongformAbschnittId; titel: string; saetze: LongformSatz[] }

export type LongformSkript = {
  leitfrage: string
  hookTyp: LongformHookTyp
  abschnitte: LongformAbschnitt[]
  /** Kernformulierungen für den Wiederholungscheck späterer Videos. */
  kernphrasen: string[]
}

export type LongformStimmeEinstellungen = {
  stability: number
  similarity: number
  style: number
  speed: number
}

/**
 * Long-Form-Defaults für Eleven v4 (nur Stability/Similarity wirken).
 * style/speed bleiben im Typ für ältere Takes, werden an v4 nicht gesendet.
 */
export const LONGFORM_STIMME_STANDARD: LongformStimmeEinstellungen = {
  stability: 0.35,
  similarity: 0.8,
  style: 0,
  speed: 1,
}

export type LongformWort = { text: string; startMs: number; endMs: number }

export type LongformTake = {
  id: string
  pfad: string
  /** Signierte URL, nur zur Laufzeit befüllt. */
  url?: string
  dauerMs: number
  woerter: LongformWort[]
  /** Fingerprint aus Text + Einstellungen: gleicher Fingerprint = kein neuer Aufruf. */
  fp: string
  erstellt: string
}

export type LongformSatzStimme = {
  aktiv: string | null
  takes: LongformTake[]
  /** Überschreibt die globalen Einstellungen für genau diesen Satz. */
  einstellungen?: LongformStimmeEinstellungen | null
}

export type LongformBild = {
  id: string
  quelle: 'upload' | 'wikimedia' | 'openverse' | 'pixabay'
  art: 'foto' | 'video'
  pfad: string
  url?: string
  breite: number | null
  hoehe: number | null
  /** Für die Videobeschreibung. Leer bei eigenen Uploads. */
  credit: string | null
  suchbegriff: string
}

export type LongformBildKandidat = Omit<LongformBild, 'pfad' | 'id'> & {
  /** Vorschau zur Auswahl; wird erst bei Bestätigung heruntergeladen. */
  vorschauUrl: string
  originalUrl: string
  /** 0–10 aus der KI-Bildprüfung, null = nicht geprüft. */
  eignung: number | null
  eignungGrund: string | null
}

export type LongformVarianten = {
  hookSzene: 'hook_zahl' | 'hook_frage' | 'hook_bild'
  chartStil: 'linie_flaeche' | 'linie_schlank'
  moatLayout: 'karten' | 'balken'
  aboPosition: number
  aboText: string
  akzent: string
  kameraSeed: number
}

export type LongformProjektZustand = {
  version: 1
  thema: string
  faktenblatt: LongformFaktenblatt
  quellen: LongformQuelle[]
  hooks: LongformHookVorschlag[] | null
  gewaehlterHook: number | null
  skript: LongformSkript | null
  stimme: {
    global: LongformStimmeEinstellungen
    saetze: Record<string, LongformSatzStimme>
  }
  bilder: Record<string, LongformBild | null>
  varianten: LongformVarianten
  musik: { aktiv: boolean; pegel: number }
  denkstufe: 'low' | 'medium' | 'high'
  /** null = noch nicht gewählt. true = investiert, false = nicht investiert. */
  investiert: boolean | null
}

export type LongformProjektKurz = {
  id: string
  ticker: string
  firmenname: string
  titel: string | null
  aktualisiertAm: string
}

export type LongformProjekt = LongformProjektKurz & { zustand: LongformProjektZustand }

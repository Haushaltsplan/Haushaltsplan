/**
 * Kanonische Kapitalbasis-Serie — eine Jahresreihe je Titel, aus der ROIC und ROIIC
 * berechnet werden.
 *
 * Warum eine eigene Schicht: vorher zog jede Kennzahl ihre Rohdaten selbst aus einer
 * einzelnen Quelle („Quelle gewinnt komplett"). Fiel ein Feld dort aus, war die Kennzahl
 * weg. Hier wird **feldweise** gemergt und die Herkunft mitgeführt, damit Lücken
 * geschlossen und Abweichungen nachvollziehbar bleiben.
 */

export type KapitalbasisQuelle =
  | 'sec_xbrl'
  | 'yahoo'
  | 'stockanalysis'
  | 'macrotrends'
  | 'nasdaq'
  | 'abgeleitet'

/** Reihenfolge = Vertrauensrang. Kleinerer Index gewinnt beim Merge. */
export const KAPITALBASIS_QUELLEN_RANG: KapitalbasisQuelle[] = [
  'sec_xbrl',
  'yahoo',
  'stockanalysis',
  'nasdaq',
  'macrotrends',
  'abgeleitet',
]

/** Alle Rohfelder, die feldweise gemergt werden (abgeleitete Werte stehen separat). */
export type KapitalbasisRohfeld =
  // GuV
  | 'umsatzMio'
  | 'ebitMio'
  | 'pretaxMio'
  | 'steuerMio'
  | 'nettogewinnMio'
  | 'zinsaufwandMio'
  // Bilanz — Kapitalseite
  | 'eigenkapitalParentMio'
  | 'eigenkapitalInklMinderheitenMio'
  | 'minderheitenMio'
  | 'rueckkaufbareMinderheitenMio'
  | 'langfristigeSchuldenMio'
  | 'kurzfristigeSchuldenMio'
  | 'leasingverbindlichkeitenMio'
  // Bilanz — Aktivseite
  | 'bargeldMio'
  | 'kurzfristigeAnlagenMio'
  | 'goodwillMio'
  | 'intangiblesMio'
  | 'gesamtvermoegenMio'
  | 'umlaufvermoegenMio'
  | 'kurzfristigeVerbindlichkeitenMio'
  // Cashflow
  | 'ocfMio'
  | 'capexMio'
  | 'softwareCapexMio'
  | 'daMio'
  | 'akquisitionenMio'
  | 'aktienrueckkaufMio'
  | 'dividendenMio'

export type KapitalbasisJahr = {
  jahr: number
  /** ISO-Datum des Geschäftsjahresendes, falls die Quelle es liefert. */
  periodenEnde: string | null

  // ── Rohfelder (Mio. in Berichtswährung) ────────────────────────────────────
  umsatzMio: number | null
  ebitMio: number | null
  pretaxMio: number | null
  steuerMio: number | null
  nettogewinnMio: number | null
  zinsaufwandMio: number | null

  eigenkapitalParentMio: number | null
  eigenkapitalInklMinderheitenMio: number | null
  minderheitenMio: number | null
  rueckkaufbareMinderheitenMio: number | null
  langfristigeSchuldenMio: number | null
  kurzfristigeSchuldenMio: number | null
  leasingverbindlichkeitenMio: number | null

  bargeldMio: number | null
  kurzfristigeAnlagenMio: number | null
  goodwillMio: number | null
  intangiblesMio: number | null
  gesamtvermoegenMio: number | null
  umlaufvermoegenMio: number | null
  kurzfristigeVerbindlichkeitenMio: number | null

  ocfMio: number | null
  capexMio: number | null
  softwareCapexMio: number | null
  daMio: number | null
  akquisitionenMio: number | null
  aktienrueckkaufMio: number | null
  dividendenMio: number | null

  /** Herkunft je Rohfeld — für Audit und Lücken-Report. */
  quellen: Partial<Record<KapitalbasisRohfeld, KapitalbasisQuelle>>
}

/**
 * Abgeleitete Kapitalgrößen. Getrennt gehalten, damit die Rohdaten unverändert
 * auditierbar bleiben und Definitionsänderungen keinen Re-Scrape erzwingen.
 */
export type KapitalbasisAbleitung = {
  jahr: number
  /** Effektiver Steuersatz (0–1) nach Normalisierung. */
  steuersatz: number
  /** Wurde der Steuersatz durch Median/Default ersetzt statt aus pretax/tax gerechnet? */
  steuersatzErsetzt: boolean
  nopatMio: number | null
  /**
   * Investiertes Kapital = Eigenkapital inkl. Minderheiten + Gesamtschulden.
   * **Ohne Cash-Abzug** — das ist die Definition, die den Referenzwerten entspricht
   * (SPGI 2025: IC 49.240, ROIC 10,2 %). Netto-Variante siehe `icNettoMio`.
   */
  icMio: number | null
  /** IC abzüglich Bargeld und kurzfristiger Anlagen (Damodaran-Konvention). */
  icNettoMio: number | null
  /** IC abzüglich Goodwill und Intangibles — Kapital ohne M&A-Aufschläge. */
  icTangibleMio: number | null
  /**
   * IC abzüglich Goodwill, Intangibles **und** Liquidität — Nenner für ROIIC.
   *
   * Bei einer Veränderungsgröße verzerrt gehortetes Cash das Ergebnis: jeder nicht
   * ausgeschüttete Gewinn erhöht die Kapitalbasis, ohne Rendite zu erzeugen. Hermès kam so
   * auf einen ΔIC von 9.929 Mio. über drei Jahre, überwiegend angesammelte Liquidität,
   * und damit auf 10 % statt eines Werts, der die Reinvestition abbildet.
   */
  icTangibleNettoMio: number | null
  /** Working Capital (Umlaufvermögen − kurzfristige Verbindlichkeiten). */
  workingCapitalMio: number | null
  /** Brutto-Reinvestition des Jahres ohne M&A: CapEx + kapitalisierte Software. */
  bruttoReinvestMio: number | null
  roicPct: number | null
  roicTangiblePct: number | null
}

export type KapitalbasisSerie = {
  symbol: string
  isin: string | null
  /** ISO-Währung der Berichtszahlen (SEC 20-F liefert z. B. EUR). */
  waehrung: string
  jahre: KapitalbasisJahr[]
  ableitungen: KapitalbasisAbleitung[]
  /** Welche Quellen haben überhaupt beigetragen. */
  beitragendeQuellen: KapitalbasisQuelle[]
  /** Wegen abweichender Skala oder Währung verworfen — nicht stillschweigend gemischt. */
  verworfeneQuellen: KapitalbasisQuelle[]
  /** Rohfelder ohne einen einzigen Wert — Basis für den Abdeckungs-Report. */
  fehlendeFelder: KapitalbasisRohfeld[]
}

export const KAPITALBASIS_ROHFELDER: KapitalbasisRohfeld[] = [
  'umsatzMio',
  'ebitMio',
  'pretaxMio',
  'steuerMio',
  'nettogewinnMio',
  'zinsaufwandMio',
  'eigenkapitalParentMio',
  'eigenkapitalInklMinderheitenMio',
  'minderheitenMio',
  'rueckkaufbareMinderheitenMio',
  'langfristigeSchuldenMio',
  'kurzfristigeSchuldenMio',
  'leasingverbindlichkeitenMio',
  'bargeldMio',
  'kurzfristigeAnlagenMio',
  'goodwillMio',
  'intangiblesMio',
  'gesamtvermoegenMio',
  'umlaufvermoegenMio',
  'kurzfristigeVerbindlichkeitenMio',
  'ocfMio',
  'capexMio',
  'softwareCapexMio',
  'daMio',
  'akquisitionenMio',
  'aktienrueckkaufMio',
  'dividendenMio',
]

/** Felder, ohne die weder ROIC noch ROIIC sinnvoll berechenbar sind. */
export const KAPITALBASIS_PFLICHTFELDER: KapitalbasisRohfeld[] = [
  'ebitMio',
  'eigenkapitalParentMio',
  'langfristigeSchuldenMio',
]

export function leeresKapitalbasisJahr(jahr: number, periodenEnde: string | null = null): KapitalbasisJahr {
  return {
    jahr,
    periodenEnde,
    umsatzMio: null,
    ebitMio: null,
    pretaxMio: null,
    steuerMio: null,
    nettogewinnMio: null,
    zinsaufwandMio: null,
    eigenkapitalParentMio: null,
    eigenkapitalInklMinderheitenMio: null,
    minderheitenMio: null,
    rueckkaufbareMinderheitenMio: null,
    langfristigeSchuldenMio: null,
    kurzfristigeSchuldenMio: null,
    leasingverbindlichkeitenMio: null,
    bargeldMio: null,
    kurzfristigeAnlagenMio: null,
    goodwillMio: null,
    intangiblesMio: null,
    gesamtvermoegenMio: null,
    umlaufvermoegenMio: null,
    kurzfristigeVerbindlichkeitenMio: null,
    ocfMio: null,
    capexMio: null,
    softwareCapexMio: null,
    daMio: null,
    akquisitionenMio: null,
    aktienrueckkaufMio: null,
    dividendenMio: null,
    quellen: {},
  }
}

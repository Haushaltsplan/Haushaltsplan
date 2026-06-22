/**
 * Nachkauf-Radar — Whitelist der Depot-Positionen.
 *
 * Pro Position:
 *  - historischerMedianPe: 5-Jahres-Median-Forward-KGV (research-basiert)
 *    → ermöglicht relativen Bewertungsvergleich statt absoluter Schwellen
 *  - kaufTrigger: optionale Bedingungen, bei denen ein klares Kauf-Signal gemeldet wird
 *  - cik: SEC EDGAR CIK (nur US-Unternehmen) für Insider-Käufe via Form 4
 */

export type KaufTrigger = {
  /** Kaufen wenn Forward P/E UNTER diesem Wert. */
  peMax?: number
  /** Kaufen wenn FCF-Rendite ÜBER diesem Wert (%). */
  fcfYieldMin?: number
  /** Freitext-Beschreibung der Kaufzone. */
  notiz?: string
}

/**
 * Sektor-Klassifikation für Konzentrations-Analyse.
 * Orientiert sich an GICS (Global Industry Classification Standard).
 */
export type WhitelistSektor =
  | 'Technologie'
  | 'Healthcare'
  | 'Finanzwesen'
  | 'Industrie'
  | 'Konsumgüter'
  | 'Materialien'
  | 'Versorgung'
  | 'Kommunikation'

export type WhitelistPosition = {
  isin: string
  name: string
  /** Sektor für Konzentrations-Analyse. */
  sektor?: WhitelistSektor
  /**
   * 5-Jahres-Median des Forward-KGV (NTM P/E).
   * Basis für relative Bewertung: günstiger als historisch = Bonus im Score.
   * Quelle: eigene Recherche / Macrotrends historische Daten.
   */
  historischerMedianPe?: number
  /**
   * 5-Jahres-Median der FCF-Rendite (%).
   * Für Unternehmen bei denen die FCF-Rendite der bessere Bewertungsmaßstab ist.
   */
  historischerMedianFcfYield?: number
  /** Optionaler Kauf-Trigger: bei welcher Bewertung würde ich aktiv nachkaufen? */
  kaufTrigger?: KaufTrigger
  /**
   * SEC EDGAR Central Index Key (CIK) — nur US-Unternehmen.
   * Wird für Form 4 Insider-Käufe benötigt.
   * Format: 10-stellig mit führenden Nullen (z. B. '0001652044').
   */
  cik?: string
}

export const NACHKAUF_RADAR_WHITELIST: WhitelistPosition[] = [
  {
    isin: 'US02079K1079',
    name: 'Alphabet C',
    sektor: 'Kommunikation',
    historischerMedianPe: 22,
    historischerMedianFcfYield: 4.5,
    kaufTrigger: { peMax: 18, fcfYieldMin: 4.5, notiz: 'Alphabet handelt selten unter 20× — unter 18× ist ein klares Fenster.' },
    cik: '0001652044',
  },
  {
    isin: 'US57636Q1040',
    name: 'Mastercard',
    sektor: 'Finanzwesen',
    historischerMedianPe: 37,
    historischerMedianFcfYield: 2.5,
    kaufTrigger: { peMax: 30, notiz: 'Unter 30× NTM P/E historisch attraktive Einstiege (2020, 2022).' },
    cik: '0001141391',
  },
  {
    isin: 'US78409V1044',
    name: 'S&P Global',
    sektor: 'Finanzwesen',
    historischerMedianPe: 32,
    historischerMedianFcfYield: 2.8,
    kaufTrigger: { peMax: 26, notiz: 'S&P Global unter 26× = Markt ignoriert strukturelle Pricing-Power.' },
    cik: '0000064040',
  },
  {
    isin: 'FR0000052292',
    name: 'Hermès',
    sektor: 'Konsumgüter',
    historischerMedianPe: 52,
    kaufTrigger: { peMax: 42, notiz: 'Hermès unter 42× war historisch (2022) der seltenste und beste Einstieg.' },
  },
  {
    isin: 'NL0010273215',
    name: 'ASML Holding',
    sektor: 'Technologie',
    historischerMedianPe: 36,
    kaufTrigger: { peMax: 28, notiz: 'ASML unter 28× P/E: Monopol im EUV-Bereich wird unterbewertet.' },
  },
  {
    isin: 'US91324P1021',
    name: 'UnitedHealth',
    sektor: 'Healthcare',
    historischerMedianPe: 20,
    historischerMedianFcfYield: 4.0,
    kaufTrigger: { peMax: 16, fcfYieldMin: 5.0, notiz: 'UNH unter 16× = regulatorischer Überreaktions-Discount.' },
    cik: '0000731766',
  },
  {
    isin: 'US5949181045',
    name: 'Microsoft',
    sektor: 'Technologie',
    historischerMedianPe: 33,
    historischerMedianFcfYield: 2.8,
    kaufTrigger: { peMax: 27, notiz: 'Microsoft unter 27× historisch selten — Cloud-Wachstum wird dann falsch bewertet.' },
    cik: '0000789019',
  },
  {
    isin: 'US8835561023',
    name: 'Thermo Fisher Scientific',
    sektor: 'Healthcare',
    historischerMedianPe: 28,
    historischerMedianFcfYield: 3.0,
    kaufTrigger: { peMax: 22, notiz: 'TMO unter 22× nach zyklischem Post-COVID-Dip = Langfrist-Einstieg.' },
    cik: '0000097476',
  },
  {
    isin: 'US55354G1004',
    name: 'MSCI',
    sektor: 'Finanzwesen',
    historischerMedianPe: 42,
    historischerMedianFcfYield: 2.2,
    kaufTrigger: { peMax: 34, notiz: 'MSCI unter 34×: Indexbusiness mit strukturellen Gebühren wird zu stark diskontiert.' },
    cik: '0001408198',
  },
  {
    isin: 'US92826C8394',
    name: 'Visa',
    sektor: 'Finanzwesen',
    historischerMedianPe: 33,
    historischerMedianFcfYield: 2.8,
    kaufTrigger: { peMax: 26, notiz: 'Visa unter 26× — regulatorische Panik-Situation (wie 2023).' },
    cik: '0001403161',
  },
  {
    isin: 'US7611521078',
    name: 'ResMed',
    sektor: 'Healthcare',
    historischerMedianPe: 30,
    historischerMedianFcfYield: 3.2,
    kaufTrigger: { peMax: 22, fcfYieldMin: 3.5, notiz: 'RMD unter 22× nach GLP-1-Überreaktion: langfristige CPAP-Nachfrage intakt.' },
    cik: '0000943819',
  },
  {
    isin: 'US6795801009',
    name: 'Old Dominion Freight Line',
    sektor: 'Industrie',
    historischerMedianPe: 28,
    historischerMedianFcfYield: 3.5,
    kaufTrigger: { peMax: 22, notiz: 'ODFL unter 22× bei zyklischem Frachtabschwung = strukturelle Stärke ignoriert.' },
    cik: '0000878927',
  },
  {
    isin: 'US94106L1098',
    name: 'Waste Management',
    sektor: 'Industrie',
    historischerMedianPe: 28,
    historischerMedianFcfYield: 3.2,
    kaufTrigger: { peMax: 23, notiz: 'WM unter 23×: inflationsgeschützte Preismacht mit Recycling-Upside.' },
    cik: '0000823768',
  },
  {
    isin: 'US98978V1035',
    name: 'Zoetis',
    sektor: 'Healthcare',
    historischerMedianPe: 38,
    historischerMedianFcfYield: 2.5,
    kaufTrigger: { peMax: 30, notiz: 'ZTS unter 30× — Tierheilkunde hat 5 % strukturelles Wachstum unabhängig von Konjunktur.' },
    cik: '0001555280',
  },
  {
    isin: 'US9078181081',
    name: 'Union Pacific',
    sektor: 'Industrie',
    historischerMedianPe: 22,
    historischerMedianFcfYield: 4.0,
    kaufTrigger: { peMax: 18, fcfYieldMin: 4.5, notiz: 'UNP unter 18×: Railway-Duopol mit Preissetzungsmacht wird zyklisch abgestraft.' },
    cik: '0000100885',
  },
  {
    isin: 'US5801351017',
    name: "McDonald's",
    sektor: 'Konsumgüter',
    historischerMedianPe: 25,
    historischerMedianFcfYield: 3.8,
    kaufTrigger: { peMax: 20, fcfYieldMin: 4.5, notiz: "MCD unter 20×: Franchise-Modell generiert 95 % FCF-Marge unabhängig von Konjunktur." },
    cik: '0000063908',
  },
  {
    isin: 'US81762P1021',
    name: 'ServiceNow',
    sektor: 'Technologie',
    historischerMedianPe: 58,
    kaufTrigger: { peMax: 45, notiz: 'NOW unter 45×: Workflow-Monopol im Enterprise-Segment — Preiserhöhungen ohne Abwanderung.' },
    cik: '0001373715',
  },
  {
    isin: 'US0576652004',
    name: 'Balchem',
    sektor: 'Materialien',
    historischerMedianPe: 40,
    historischerMedianFcfYield: 2.5,
    kaufTrigger: { peMax: 32, notiz: 'BCPC unter 32×: Nischenchemie mit hohen Wechselkosten im Lebensmittel-/Pharmabereich.' },
    cik: '0000009626',
  },
  {
    isin: 'IE000S9YS762',
    name: 'Linde',
    sektor: 'Materialien',
    historischerMedianPe: 27,
    historischerMedianFcfYield: 3.5,
    kaufTrigger: { peMax: 22, notiz: 'Linde unter 22×: Industriegase-Oligopol mit 20+ Jahre Vertragslaufzeiten.' },
    cik: '0001707092',
  },
  {
    isin: 'CH1175448666',
    name: 'Straumann Holding',
    sektor: 'Healthcare',
    historischerMedianPe: 55,
    kaufTrigger: { peMax: 40, notiz: 'Straumann unter 40×: Dentalimplantat-Marktführer mit wiederkehrenden Verbrauchsmaterialien.' },
  },
  {
    isin: 'US23804L1035',
    name: 'Datadog',
    sektor: 'Technologie',
    historischerMedianPe: 70,
    kaufTrigger: { peMax: 50, notiz: 'DDOG unter 50× (NTM): Observability wird Mission-Critical — NRR > 115 % als Qualitätsanker.' },
    cik: '0001561894',
  },
  {
    isin: 'GB0004052071',
    name: 'Halma',
    sektor: 'Industrie',
    historischerMedianPe: 35,
    kaufTrigger: { peMax: 28, notiz: 'Halma unter 28×: Sicherheits-Nischen-Konglomerat mit Decentralized M&A-Modell.' },
  },
  {
    isin: 'US4370761029',
    name: 'The Home Depot',
    sektor: 'Konsumgüter',
    historischerMedianPe: 24,
    historischerMedianFcfYield: 3.5,
    kaufTrigger: { peMax: 19, fcfYieldMin: 4.5, notiz: 'HD unter 19×: strukturell Duopol im US-Heimwerkermarkt, profitiert von Aging Housing Stock.' },
    cik: '0000354950',
  },
  {
    isin: 'CH0418792922',
    name: 'Sika',
    sektor: 'Materialien',
    historischerMedianPe: 35,
    kaufTrigger: { peMax: 27, notiz: 'Sika unter 27×: Bauchemiemarktführer mit lokalen Produktionsvorteilen — strukturell wächst Bauindustrie.' },
  },
  {
    isin: 'US49714P1084',
    name: 'Kinsale Capital',
    sektor: 'Finanzwesen',
    historischerMedianPe: 22,
    historischerMedianFcfYield: 4.5,
    kaufTrigger: { peMax: 18, notiz: 'KNSL unter 18× — Surplus-Lines-Versicherer mit bestem Combined Ratio in der Branche.' },
    cik: '0001679273',
  },
  {
    isin: 'US3841091040',
    name: 'Graco',
    sektor: 'Industrie',
    historischerMedianPe: 28,
    historischerMedianFcfYield: 3.5,
    kaufTrigger: { peMax: 22, notiz: 'GGG unter 22×: Fluid-Handling-Nische, 50+ % Marktanteil, zyklischer Drawdown = Einstieg.' },
    cik: '0000850693',
  },
  {
    isin: 'US9224751084',
    name: 'Veeva Systems',
    sektor: 'Healthcare',
    historischerMedianPe: 40,
    kaufTrigger: { peMax: 32, notiz: 'VEEV unter 32×: Life-Science-Cloud mit faktischem Monopol — FDA-Daten = unersetzbar.' },
    cik: '0001393052',
  },
  {
    isin: 'CA01626P1484',
    name: 'Alimentation Couche-Tard',
    sektor: 'Konsumgüter',
    historischerMedianPe: 22,
    historischerMedianFcfYield: 4.5,
    kaufTrigger: { peMax: 17, notiz: 'ATD unter 17× — bester M&A-Operator im Convenience-Retail, wächst durch Akquisitionen.' },
  },
  {
    isin: 'US0404132054',
    name: 'Arista Networks',
    sektor: 'Technologie',
    historischerMedianPe: 45,
    kaufTrigger: { peMax: 35, notiz: 'ANET unter 35×: Cloud-Networking-Marktführer, profitiert direkt von AI-Datacenter-Boom.' },
    cik: '0001313925',
  },
  {
    isin: 'US7757111049',
    name: 'Rollins',
    sektor: 'Industrie',
    historischerMedianPe: 50,
    historischerMedianFcfYield: 2.0,
    kaufTrigger: { peMax: 38, notiz: 'ROL unter 38×: Schädlingsbekämpfung ist recession-proof und wird regulatorisch komplexer.' },
    cik: '0000085408',
  },
  {
    isin: 'NL0000395903',
    name: 'Wolters Kluwer',
    sektor: 'Technologie',
    historischerMedianPe: 30,
    kaufTrigger: { peMax: 24, notiz: 'WKL unter 24×: Legal/Compliance-SaaS mit 85 % wiederkehrenden Umsätzen.' },
  },
  {
    isin: 'US1729081059',
    name: 'Cintas',
    sektor: 'Industrie',
    historischerMedianPe: 40,
    historischerMedianFcfYield: 2.5,
    kaufTrigger: { peMax: 32, notiz: 'CTAS unter 32×: Arbeitskleidung als Mission-Critical Service mit 98 % Retention Rate.' },
    cik: '0000723254',
  },
]

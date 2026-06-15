export type MantraZeile = {
  kategorie: string
  kennzahl: string
  zielwert: string
  funktion: string
  /** Formel / Definition aus dem Framework (optional). */
  definition?: string
}

export type MoatPfeiler = {
  id: string
  titel: string
  beschreibung: string
  killerFrage: string
}

export type SellTrigger = {
  id: string
  titel: string
  beschreibung: string
}

/** Abschnitt 1 — Psychologischer Anker (Quality Investing Framework). */
export const QUALITY_INVESTING_ANKER =
  'Wir erwerben keine Aktien, sondern Miteigentum an den produktivsten ökonomischen Systemen der Welt — unabhängig davon, ob sich deren Exzellenz bereits in etablierten Buchgewinnen zeigt oder noch in der aggressiven Skalierung unantastbarer Monopolstrukturen begraben liegt. Der langfristige Wertzuwachs folgt untrennbar der Entwicklung der realen Cash-Renditen auf das investierte Kapital und der Stärke der zugrundeliegenden Stückkostenökonomie, niemals den kurzfristigen, erratischen Preisschwankungen des Marktes. Vermögensbildung ist das Resultat ungestörten Zinseszinskapitals; die wichtigste und schwierigste Handlung nach dem Kauf ist das bewusste Unterlassen von Aktivität bei operativer Intaktheit. Wer die Marktführer von heute und morgen besitzt, delegiert die Kapitalallokation an die fähigsten Manager und lässt die Zeit kompromisslos für sich arbeiten.'

export const QUALITY_INVESTING_FRAMEWORK_TITEL = 'Quality Investing Framework'
export const QUALITY_INVESTING_FRAMEWORK_UNTERTITEL =
  'Strategisches Anlage-Mantra & branchenunabhängiges Analyse-System'

/** Abschnitt 2 — Quantitatives Dashboard (dynamische Kriterien). */
export const INVESTMENT_MANTRA: readonly MantraZeile[] = [
  {
    kategorie: 'Rentabilität',
    kennzahl: 'ROIC',
    definition:
      'Return on Invested Capital (Macrotrends ROI) — Kapitalrendite auf investiertes Kapital.',
    zielwert: '>15 % (10 J.) oder steigende Kurve',
    funktion:
      'Konstant hoch (>15 %) über 10 Jahre — oder bei jungen Plattformen eine steile Aufwärtskurve, die binnen 5 Jahren die Gewinnschwelle durchbricht. Zeigt die reale Rendite auf investiertes Kapital.',
  },
  {
    kategorie: 'Unit Economics',
    kennzahl: 'LTV-to-CAC',
    definition: 'LTV ÷ CAC = Deckungsbeitrag pro Kunde × Lebensdauer ÷ Kundenakquisitionskosten.',
    zielwert: '>4× (3 Jahre)',
    funktion:
      'Frühindikator für zukünftigen ROIC. Exzellente Stückkosten beweisen, dass temporäre Unprofitabilität hochrentable Reinvestition ist. Bruttomarge auf Kohortenbasis stabil oder expandierend.',
  },
  {
    kategorie: 'Skalierung',
    kennzahl: 'Margen-Struktur & Skaleneffekte',
    definition:
      'Inkrementelle operative Marge = Δ Operative Marge ÷ Δ Umsatz. SG&A-Quote (SG&A ÷ Umsatz) degressiv.',
    zielwert: 'Inkrementelle Op.-Marge >20 %',
    funktion:
      'Bei Umsatzwachstum muss jeder zusätzliche Euro profitabler sein. Ob physische Dichte oder digitale Distribution: Skaleneffekte müssen sichtbar sein.',
  },
  {
    kategorie: 'Cashflow',
    kennzahl: 'FCF-Konvertierung & Rule of 40',
    definition:
      'Etabliert: FCF ÷ Nettogewinn. Wachstum: Umsatzwachstum + FCF-Marge (Rule of 40).',
    zielwert: 'FCF/NI >90 % oder Rule of 40 >40 %',
    funktion:
      'Schützt junge Firmen vor falscher Abstrafung: Unprofitabel ist erlaubt bei hohem Wachstum — nicht langsam wachsen und unprofitabel sein.',
  },
  {
    kategorie: 'Sicherheit',
    kennzahl: 'Verschuldung & Verwässerung',
    definition:
      'Net Debt ÷ EBITDA und jährliche Verwässerung durch Aktienoptionen (SBC) am Share Count.',
    zielwert: 'Net Debt/EBITDA <2× · SBC-Verwässerung <2 % p.a.',
    funktion:
      'Qualitätsunternehmen brauchen keine hohe Hebelung. Junge Tech-Firmen verwässern oft über Mitarbeiteraktien — idealerweise durch Buybacks neutralisiert.',
  },
]

/** Abschnitt 3 — Branchenübergreifender Moat-Check (qualitativ). */
export const MOAT_CHECK: readonly MoatPfeiler[] = [
  {
    id: 'preissetzungsmacht',
    titel: 'Immaterielle Preissetzungsmacht (Mission-Critical)',
    beschreibung:
      'Das Produkt nimmt einen nominal geringen Teil der Gesamtkosten des Kunden ein, ist für dessen Betrieb jedoch absolut kritisch. Ein Ausfall würde katastrophale wirtschaftliche Schäden verursachen.',
    killerFrage:
      'Könnte das Unternehmen die Preise morgen nominal um 10 % erhöhen, ohne dass signifikante Kundenabwanderungen messbar wären?',
  },
  {
    id: 'replikationsbarriere',
    titel: 'Strukturelle Replikationsbarriere',
    beschreibung:
      'Die Infrastruktur des Marktführers ist über Jahrzehnte gewachsen und lässt sich von Neueinsteigern selbst mit unbegrenztem Kapital nicht ökonomisch sinnvoll nachbauen.',
    killerFrage:
      'Müsste ein rational agierender Konkurrent beim Duplizieren über Jahre Verluste in Kauf nehmen, die das eigene Überleben gefährden?',
  },
  {
    id: 'wechselkosten',
    titel: 'Asymmetrische Wechselkosten',
    beschreibung:
      'Die Integration des Produkts in die Wertschöpfungskette des Kunden ist so tief, dass ein Wechsel hohe operative Risiken und Implementierungszeiträume nach sich zieht.',
    killerFrage:
      'Ist der finanzielle und organisationale Aufwand für einen Anbieterwechsel höher als die potenzielle Ersparnis durch das Konkurrenzprodukt?',
  },
  {
    id: 'marktdichte',
    titel: 'Monopolistische Marktdichte',
    beschreibung:
      'Das Unternehmen kontrolliert eine eng definierte Nische oder Infrastruktur so effizient, dass der Markt keinen Platz für einen zweiten profitablen Akteur bietet.',
    killerFrage:
      'Existiert eine dauerhafte strukturelle Angebots- oder Konsumkonzentration, die Newcomern Skalenerträge verwehrt?',
  },
]

/** Zusatz für junge Plattformen (Moat-Check). */
export const MOAT_CHECK_PLATTFORM_ZUSATZ =
  'Steigen die wiederkehrenden Umsätze (ARR / Net Retention Rate) von Bestandskunden Jahr für Jahr kontinuierlich an (NRR >110 %), während die Grenzkosten für die Betreuung gegen Null sinken?'

/** Abschnitt 4 — Sell-Triggers (Exit-Disziplin). */
export const SELL_TRIGGERS: readonly SellTrigger[] = [
  {
    id: 'rendite-verfall',
    titel: 'Struktureller Verfall der fundamentalen Renditen',
    beschreibung:
      'Der ROIC fällt über drei aufeinanderfolgende Geschäftsjahre strukturell ab und die Unit Economics brechen ein (z. B. LTV/CAC dauerhaft unter 3×), weil Kapital in unrentable Projekte fließt oder die Neukundenakquisition irreversibel verloren geht.',
  },
  {
    id: 'burggraben-erosion',
    titel: 'Erosion des Marktanteils und Verlust des Vorsprungs',
    beschreibung:
      'Über 24 Monate kontinuierlich relativer Marktanteilsverlust an Wettbewerber oder Substitutionsprodukte — der Burggraben ist durchbrochen, Preissetzungsmacht erlischt (sinkende NRR oder Margenkompression im Peer-Vergleich).',
  },
  {
    id: 'kuenstliches-wachstum',
    titel: 'Kollaps der organischen Wachstumssubstanz',
    beschreibung:
      'Organisches Wachstum stagniert oder schrumpft, während EPS-Wachstum durch bilanzielle Anpassungen, F&E-Kürzungen oder schuldenfinanzierte Buybacks bei hoher SBC-Verwässerung maskiert wird.',
  },
]

export const SELL_TRIGGERS_HINWEIS =
  'Verkauf nur bei dauerhafter, irreversibler Zerstörung der Investmenthypothese. Kurzfristige Bewertungsübersprünge (hohes KGV) oder makroökonomische Rezessionen sind explizit keine Verkaufskriterien.'

/** @deprecated Branchen-Mantras durch universelles Framework ersetzt. */
export const SEKTOR_MANTRAS: readonly never[] = []

/** @deprecated */
export type SektorMantraBlock = {
  id: string
  title: string
  intro: string
  zeilen: readonly MantraZeile[]
}

/** @deprecated */
export function findeSektorMantra(_id: string): null {
  return null
}

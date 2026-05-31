/**
 * Leichte Auto-Kategorisierung für Buchungen (Finanzguru-artig).
 *
 * Das bestehende Datenmodell speichert in `kategorie` einen Freitext (meist Firma/Anbieter)
 * und in `beschreibung` Grund/Notiz. Hier leiten wir daraus eine feste Oberkategorie ab,
 * damit Donut-Diagramme und Budgets sinnvoll gruppieren können. Kein DB-Umbau nötig.
 */

/** Deutsche Normalisierung wie in `lib/kategorie-icon.tsx` (ä→ae etc.), für robustes Matching. */
function deutschLower(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
}

export type FinanzKategorieKey =
  | 'einkommen'
  | 'lebensmittel'
  | 'wohnen'
  | 'mobilitaet'
  | 'abos'
  | 'versicherung'
  | 'sparen'
  | 'freizeit'
  | 'gesundheit'
  | 'sonstiges'

export type FinanzKategorieDef = {
  key: FinanzKategorieKey
  label: string
  /** Hex-Farbe für SVG-Diagramme (zum dunklen Theme passend). */
  farbe: string
  /** Tailwind-Textklasse für Akzente in Listen. */
  textClass: string
  /** Schlüsselwörter (bereits deutschLower-normalisiert) für die Zuordnung. */
  keywords: string[]
}

/**
 * Reihenfolge = Priorität bei der Zuordnung (spezifische zuerst, `sonstiges` zuletzt).
 * `einkommen` wird separat behandelt (nur für Einnahmen relevant).
 */
export const FINANZ_KATEGORIEN: readonly FinanzKategorieDef[] = [
  {
    key: 'einkommen',
    label: 'Einkommen',
    farbe: '#34d399',
    textClass: 'text-emerald-300',
    keywords: ['gehalt', 'lohn', 'salary', 'einkommen', 'rueckerstattung', 'erstattung', 'zinsen', 'dividende', 'verkauf', 'bonus', 'gutschrift'],
  },
  {
    key: 'lebensmittel',
    label: 'Lebensmittel & Drogerie',
    farbe: '#22c55e',
    textClass: 'text-green-300',
    keywords: [
      'rewe', 'edeka', 'lidl', 'aldi', 'kaufland', 'penny', 'netto', 'supermarkt', 'lebensmittel',
      'einkauf', 'baecker', 'metzger', 'getraenke', 'dm', 'dm-drogerie', 'rossmann', 'mueller', 'drogerie',
    ],
  },
  {
    key: 'wohnen',
    label: 'Wohnen & Nebenkosten',
    farbe: '#f59e0b',
    textClass: 'text-amber-300',
    keywords: [
      'miete', 'nebenkosten', 'wohnung', 'strom', 'gas', 'wasser', 'heizung', 'waerme', 'enbw', 'eon',
      'e.on', 'stadtwerke', 'vattenfall', 'rundfunk', 'gez', 'internet', 'dsl', 'glasfaser', 'hausrat', 'bausparer', 'schwaebisch hall',
    ],
  },
  {
    key: 'mobilitaet',
    label: 'Mobilität & Auto',
    farbe: '#0ea5e9',
    textClass: 'text-sky-300',
    keywords: [
      'shell', 'aral', 'esso', 'total', 'tanken', 'benzin', 'diesel', 'sprit', 'tankstelle', 'auto',
      'kfz', 'adac', 'bahn', 'db ', 'deutsche bahn', 'ticket', 'bus', 'tram', 'uber', 'bolt', 'taxi', 'parken', 'maut',
    ],
  },
  {
    key: 'abos',
    label: 'Abos & Digital',
    farbe: '#8b5cf6',
    textClass: 'text-violet-300',
    keywords: [
      'netflix', 'spotify', 'discovery', 'disney', 'amazon prime', 'prime', 'youtube', 'apple', 'icloud',
      'gemini', 'chatgpt', 'openai', 'microsoft', 'adobe', 'dropbox', 'github', 'strava', 'whoop',
      'handy', 'mobilfunk', 'o2', 'telekom', 'vodafone', 'abo', 'streaming',
    ],
  },
  {
    key: 'versicherung',
    label: 'Versicherung',
    farbe: '#f43f5e',
    textClass: 'text-rose-300',
    keywords: [
      'versicherung', 'allianz', 'haftpflicht', 'hausrat', 'lebensversicherung', 'rechtsschutz',
      'huk', 'axa', 'ergo', 'devk', 'krankenversicherung', 'unfallversicherung', 'kfz-versicherung',
    ],
  },
  {
    key: 'sparen',
    label: 'Sparen & Anlage',
    farbe: '#2dd4bf',
    textClass: 'text-teal-300',
    keywords: [
      'aktien', 'etf', 'fond', 'fonds', 'sparplan', 'sparen', 'depot', 'trade republic', 'traderepublic',
      'scalable', 'rente', 'uniprofirente', 'uniglobal', 'union investment', 'altersvorsorge', 'ruerup', 'riester',
    ],
  },
  {
    key: 'freizeit',
    label: 'Freizeit & Shopping',
    farbe: '#e879f9',
    textClass: 'text-fuchsia-300',
    keywords: [
      'restaurant', 'mcdonald', 'burger king', 'cafe', 'bar', 'kino', 'urlaub', 'reise', 'hotel',
      'amazon', 'zalando', 'otto', 'ikea', 'mediamarkt', 'saturn', 'kleidung', 'shopping', 'thalia',
      'fitness', 'gym', 'sport', 'hobby', 'konzert', 'freizeit',
    ],
  },
  {
    key: 'gesundheit',
    label: 'Gesundheit',
    farbe: '#06b6d4',
    textClass: 'text-cyan-300',
    keywords: ['apotheke', 'arzt', 'zahnarzt', 'klinik', 'physio', 'brille', 'optiker', 'medikament', 'gesundheit'],
  },
  {
    key: 'sonstiges',
    label: 'Sonstiges',
    farbe: '#94a3b8',
    textClass: 'text-slate-300',
    keywords: [],
  },
] as const

const KATEGORIE_BY_KEY = new Map<FinanzKategorieKey, FinanzKategorieDef>(
  FINANZ_KATEGORIEN.map((k) => [k.key, k]),
)

export function kategorieDef(key: FinanzKategorieKey): FinanzKategorieDef {
  return KATEGORIE_BY_KEY.get(key) ?? KATEGORIE_BY_KEY.get('sonstiges')!
}

/**
 * Ordnet eine Buchung einer Oberkategorie zu.
 * `istEinnahme` erzwingt für Einnahmen die Kategorie „Einkommen“, sofern nicht klar etwas anderes
 * (z. B. eine Sparbuchung als Einnahme) gemeint ist.
 */
export function ordneKategorieZu(
  kategorie?: string | null,
  beschreibung?: string | null,
  istEinnahme = false,
): FinanzKategorieKey {
  const text = `${deutschLower(String(kategorie ?? ''))} ${deutschLower(String(beschreibung ?? ''))}`.trim()

  if (istEinnahme) {
    // Einnahmen sind in aller Regel Einkommen; nur eindeutige Spar-/Anlage-Rückflüsse abweichend.
    for (const needle of kategorieDef('sparen').keywords) {
      if (text.includes(needle)) return 'sparen'
    }
    return 'einkommen'
  }

  for (const def of FINANZ_KATEGORIEN) {
    if (def.key === 'einkommen' || def.key === 'sonstiges') continue
    for (const needle of def.keywords) {
      if (needle && text.includes(needle)) return def.key
    }
  }
  return 'sonstiges'
}

export type KategorieSumme = {
  key: FinanzKategorieKey
  label: string
  farbe: string
  betrag: number
  anteil: number
}

/** Aggregiert Buchungen nach Oberkategorie (absteigend nach Betrag). */
export function summiereNachKategorie(
  rows: Array<{ kategorie?: string | null; beschreibung?: string | null; betrag?: number | string | null }>,
  istEinnahme = false,
): KategorieSumme[] {
  const map = new Map<FinanzKategorieKey, number>()
  for (const r of rows) {
    const b = Number(r.betrag)
    if (!Number.isFinite(b)) continue
    const key = ordneKategorieZu(r.kategorie, r.beschreibung, istEinnahme)
    map.set(key, (map.get(key) || 0) + b)
  }
  const gesamt = [...map.values()].reduce((a, b) => a + b, 0)
  return [...map.entries()]
    .map(([key, betrag]) => {
      const def = kategorieDef(key)
      return {
        key,
        label: def.label,
        farbe: def.farbe,
        betrag: Math.round(betrag * 100) / 100,
        anteil: gesamt > 0 ? betrag / gesamt : 0,
      }
    })
    .sort((a, b) => b.betrag - a.betrag)
}

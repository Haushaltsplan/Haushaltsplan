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
 * Schlüsselwörter sind bereits in `deutschLower`-Form (ae/oe/ue/ss, keine Umlaute) und werden
 * nur als ganze Wörter (Wortgrenzen) erkannt, damit z. B. „auto“ nicht in „Dauerauftrag“ matcht.
 */
export const FINANZ_KATEGORIEN: readonly FinanzKategorieDef[] = [
  {
    key: 'einkommen',
    label: 'Einkommen',
    farbe: '#34d399',
    textClass: 'text-emerald-300',
    keywords: [
      'gehalt', 'lohn', 'salary', 'einkommen', 'rueckerstattung', 'erstattung', 'zinsen', 'dividende',
      'bonus', 'gutschrift', 'honorar', 'taschengeld', 'kindergeld', 'bafoeg',
    ],
  },
  {
    key: 'sparen',
    label: 'Sparen & Anlage',
    farbe: '#2dd4bf',
    textClass: 'text-teal-300',
    keywords: [
      'aktien', 'aktie', 'etf', 'fond', 'fonds', 'sparplan', 'sparen', 'sparbuch', 'depot',
      'trade republic', 'traderepublic', 'scalable', 'comdirect', 'consorsbank', 'finanzen.net',
      'rente', 'uniprofirente', 'uniglobal', 'uniprofi', 'union investment', 'altersvorsorge',
      'ruerup', 'riester', 'bausparer', 'bauspar', 'schwaebisch hall', 'wuestenrot',
      'vermoegenswirksame', 'vwl', 'festgeld', 'tagesgeld', 'krypto', 'bitcoin', 'gold',
    ],
  },
  {
    key: 'versicherung',
    label: 'Versicherung',
    farbe: '#f43f5e',
    textClass: 'text-rose-300',
    keywords: [
      'versicherung', 'allianz', 'haftpflicht', 'lebensversicherung', 'rechtsschutz', 'huk',
      'huk24', 'axa', 'ergo', 'devk', 'generali', 'wgv', 'lvm', 'krankenversicherung',
      'unfallversicherung', 'hausratversicherung', 'berufsunfaehigkeit', 'zusatzversicherung', 'police',
    ],
  },
  {
    key: 'abos',
    label: 'Abos & Digital',
    farbe: '#8b5cf6',
    textClass: 'text-violet-300',
    keywords: [
      'netflix', 'spotify', 'discovery', 'disney', 'amazon prime', 'prime video', 'paramount', 'wow',
      'dazn', 'audible', 'youtube', 'apple', 'icloud', 'gemini', 'chatgpt', 'openai', 'microsoft',
      'office', 'adobe', 'dropbox', 'github', 'strava', 'whoop', 'handy', 'handyvertrag', 'mobilfunk',
      'o2', 'telekom', 'vodafone', 'congstar', 'abo', 'streaming', 'patreon',
    ],
  },
  {
    key: 'mobilitaet',
    label: 'Mobilität & Auto',
    farbe: '#0ea5e9',
    textClass: 'text-sky-300',
    keywords: [
      'shell', 'aral', 'esso', 'totalenergies', 'tanken', 'benzin', 'diesel', 'sprit', 'tankstelle',
      'auto', 'autohaus', 'kfz', 'adac', 'werkstatt', 'reifen', 'deutsche bahn', 'bahn', 'flixbus',
      'flixtrain', 'mvg', 'bvg', 'ticket', 'fahrkarte', 'bus', 'tram', 'uber', 'bolt', 'taxi',
      'parken', 'parkhaus', 'maut', 'leasing',
    ],
  },
  {
    key: 'lebensmittel',
    label: 'Lebensmittel & Drogerie',
    farbe: '#22c55e',
    textClass: 'text-green-300',
    keywords: [
      'rewe', 'edeka', 'lidl', 'aldi', 'kaufland', 'penny', 'netto', 'denns', 'alnatura',
      'supermarkt', 'lebensmittel', 'einkauf', 'wocheneinkauf', 'baecker', 'baeckerei', 'metzger',
      'getraenkemarkt', 'getraenke', 'dm', 'rossmann', 'mueller', 'drogerie',
    ],
  },
  {
    key: 'gesundheit',
    label: 'Gesundheit',
    farbe: '#06b6d4',
    textClass: 'text-cyan-300',
    keywords: [
      'apotheke', 'arzt', 'aerztin', 'zahnarzt', 'klinik', 'krankenhaus', 'physio', 'physiotherapie',
      'brille', 'optiker', 'medikament', 'rezept', 'gesundheit',
    ],
  },
  {
    key: 'wohnen',
    label: 'Wohnen & Nebenkosten',
    farbe: '#f59e0b',
    textClass: 'text-amber-300',
    keywords: [
      'miete', 'kaltmiete', 'warmmiete', 'nebenkosten', 'wohnung', 'strom', 'gas', 'wasser', 'heizung',
      'waerme', 'enbw', 'eon', 'stadtwerke', 'vattenfall', 'rundfunk', 'rundfunkbeitrag', 'gez',
      'internet', 'dsl', 'glasfaser', 'moebel', 'hausgeld', 'grundsteuer', 'muellabfuhr',
    ],
  },
  {
    key: 'freizeit',
    label: 'Freizeit & Shopping',
    farbe: '#e879f9',
    textClass: 'text-fuchsia-300',
    keywords: [
      'restaurant', 'mcdonald', 'burger king', 'cafe', 'kneipe', 'kino', 'urlaub', 'reise', 'hotel',
      'airbnb', 'booking', 'amazon', 'zalando', 'otto', 'ikea', 'mediamarkt', 'saturn', 'kleidung',
      'shopping', 'thalia', 'fitnessstudio', 'fitness', 'gym', 'sportverein', 'hobby', 'konzert',
      'freizeit', 'steam', 'spielwaren',
    ],
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

/** true, wenn `needle` als ganzes Wort in `text` vorkommt (Wortgrenzen = Nicht-alphanumerisch). */
function enthaeltGanzesWort(text: string, needle: string): boolean {
  if (!needle) return false
  const istWortzeichen = (c: string) => c !== '' && /[a-z0-9]/.test(c)
  let from = 0
  for (;;) {
    const i = text.indexOf(needle, from)
    if (i < 0) return false
    const vor = i === 0 ? '' : text[i - 1]
    const nach = i + needle.length >= text.length ? '' : text[i + needle.length]
    if (!istWortzeichen(vor) && !istWortzeichen(nach)) return true
    from = i + 1
  }
}

/**
 * Baut den Text, gegen den Schlüsselwörter geprüft werden. Wichtig:
 * - der Firmen-/Anbietername (`kategorie`) ist das Hauptsignal,
 * - aus `beschreibung` wird nur ein vom Nutzer eingegebener „Grund“ verwendet,
 * - System-Beschreibungen („Dauerauftrag (Auto)“, „Monatsplan …“, „Rechnung • …“) werden ignoriert,
 *   damit z. B. „(Auto)“ nicht fälschlich Mobilität triggert.
 */
function matchText(kategorie?: string | null, beschreibung?: string | null): string {
  const kat = deutschLower(String(kategorie ?? ''))
  const rohB = String(beschreibung ?? '')
  const istSystemtext = /dauerauftrag \(auto\)|monatsplan|rechnung\s*[•:]/i.test(rohB)
  let grund = ''
  if (!istSystemtext && rohB.trim()) {
    const m = rohB.match(/grund:\s*([^•]+)/i)
    grund = deutschLower(m ? m[1] : rohB)
  }
  return `${kat} ${grund}`.trim()
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
  const text = matchText(kategorie, beschreibung)

  if (istEinnahme) {
    // Einnahmen sind in aller Regel Einkommen; nur eindeutige Spar-/Anlage-Rückflüsse abweichend.
    for (const needle of kategorieDef('sparen').keywords) {
      if (enthaeltGanzesWort(text, needle)) return 'sparen'
    }
    return 'einkommen'
  }

  for (const def of FINANZ_KATEGORIEN) {
    if (def.key === 'einkommen' || def.key === 'sonstiges') continue
    for (const needle of def.keywords) {
      if (enthaeltGanzesWort(text, needle)) return def.key
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

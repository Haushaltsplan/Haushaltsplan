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
      'aktien', 'aktie', 'etf', 'msci', 'fondssparplan', 'fonds', 'fond', 'sparplan', 'sparrate',
      'sparbuch', 'sparen', 'depot', 'wertpapier', 'trade republic', 'traderepublic', 'scalable capital',
      'scalable', 'comdirect', 'consorsbank', 'flatex', 'smartbroker', 'etoro', 'weltsparen',
      'coinbase', 'binance', 'bitpanda', 'kraken', 'krypto', 'bitcoin', 'ethereum', 'gold',
      'rente', 'uniprofirente', 'uniprofi', 'uniglobal', 'union investment', 'altersvorsorge',
      'betriebsrente', 'ruerup', 'riester', 'bausparer', 'bauspar', 'schwaebisch hall', 'wuestenrot',
      'lbs', 'vermoegenswirksame', 'vwl', 'festgeld', 'tagesgeld',
      'p2p', 'mintos', 'bondora', 'peerberry', 'auxmoney', 'estateguru', 'twino', 'robocash',
    ],
  },
  {
    key: 'versicherung',
    label: 'Versicherung',
    farbe: '#f43f5e',
    textClass: 'text-rose-300',
    keywords: [
      'versicherung', 'allianz', 'haftpflicht', 'lebensversicherung', 'rechtsschutz', 'huk24', 'huk',
      'axa', 'ergo', 'devk', 'generali', 'gothaer', 'signal iduna', 'debeka', 'barmenia',
      'cosmosdirekt', 'getsafe', 'friday', 'wgv', 'lvm', 'krankenversicherung', 'unfallversicherung',
      'hausratversicherung', 'berufsunfaehigkeit', 'zusatzversicherung', 'kfz-versicherung', 'police',
    ],
  },
  {
    key: 'abos',
    label: 'Abos & Digital',
    farbe: '#8b5cf6',
    textClass: 'text-violet-300',
    keywords: [
      'netflix', 'spotify', 'disney', 'discovery', 'amazon prime', 'prime video', 'paramount',
      'sky', 'wow', 'dazn', 'joyn', 'rtl+', 'crunchyroll', 'mubi', 'twitch', 'audible', 'kindle',
      'youtube', 'apple', 'icloud', 'itunes', 'google one', 'gemini', 'chatgpt', 'openai',
      'microsoft', 'office', 'adobe', 'dropbox', 'notion', 'canva', 'github', 'linkedin', 'xing',
      'parship', 'tinder', 'bumble', 'strava', 'whoop', 'patreon', 'playstation plus', 'game pass',
      'nintendo online', 'handyvertrag', 'handy', 'mobilfunk', 'o2', 'telekom', 'vodafone',
      'congstar', '1&1', '1und1', 'freenet', 'aldi talk', 'lidl connect', 'drillisch', 'winsim',
      'abo', 'streaming',
    ],
  },
  {
    key: 'mobilitaet',
    label: 'Mobilität & Auto',
    farbe: '#0ea5e9',
    textClass: 'text-sky-300',
    keywords: [
      'shell', 'aral', 'esso', 'totalenergies', 'agip', 'hoyer', 'tanken', 'benzin', 'diesel',
      'sprit', 'tankstelle', 'auto', 'autohaus', 'kfz', 'adac', 'werkstatt', 'tuev', 'dekra', 'atu',
      'pitstop', 'reifen', 'waschanlage', 'sixt', 'europcar', 'hertz', 'car2go', 'sharenow',
      'deutsche bahn', 'bahn', 'db navigator', 'flixbus', 'flixtrain', 'mvg', 'bvg', 'rmv', 'hvv',
      'vvs', 'mvv', 'oepnv', 'ticket', 'fahrkarte', 'monatskarte', 'deutschlandticket', 'bus', 'tram',
      'uber', 'bolt', 'taxi', 'parken', 'parkhaus', 'maut', 'leasing',
    ],
  },
  {
    key: 'lebensmittel',
    label: 'Lebensmittel & Drogerie',
    farbe: '#22c55e',
    textClass: 'text-green-300',
    keywords: [
      'rewe', 'edeka', 'lidl', 'aldi', 'kaufland', 'penny', 'netto', 'denns', 'alnatura', 'globus',
      'famila', 'marktkauf', 'tegut', 'supermarkt', 'lebensmittel', 'einkauf', 'wocheneinkauf',
      'baecker', 'baeckerei', 'konditorei', 'metzger', 'fleischerei', 'getraenkemarkt', 'getraenke',
      'dm', 'rossmann', 'mueller', 'budni', 'drogerie',
    ],
  },
  {
    key: 'gesundheit',
    label: 'Gesundheit',
    farbe: '#06b6d4',
    textClass: 'text-cyan-300',
    keywords: [
      'apotheke', 'arzt', 'aerztin', 'hausarzt', 'facharzt', 'zahnarzt', 'klinik', 'krankenhaus',
      'physio', 'physiotherapie', 'krankengymnastik', 'heilpraktiker', 'massage', 'therapie',
      'brille', 'optiker', 'fielmann', 'apollo optik', 'kontaktlinsen', 'medikament', 'rezept',
      'zuzahlung', 'gesundheit',
    ],
  },
  {
    key: 'wohnen',
    label: 'Wohnen & Nebenkosten',
    farbe: '#f59e0b',
    textClass: 'text-amber-300',
    keywords: [
      'miete', 'kaltmiete', 'warmmiete', 'nebenkosten', 'wohngeld', 'kaution', 'vermieter',
      'hausverwaltung', 'wohnung', 'strom', 'gas', 'wasser', 'abwasser', 'heizung', 'waerme', 'enbw',
      'eon', 'rwe', 'vattenfall', 'lichtblick', 'yello', 'eprimo', 'stadtwerke', 'gasag', 'swm',
      'rundfunkbeitrag', 'rundfunk', 'gez', 'internet', 'dsl', 'glasfaser', 'kabel', 'hausgeld',
      'grundsteuer', 'muellabfuhr', 'muell',
    ],
  },
  {
    key: 'freizeit',
    label: 'Freizeit & Shopping',
    farbe: '#e879f9',
    textClass: 'text-fuchsia-300',
    keywords: [
      // Gastronomie & Ausgehen
      'restaurant', 'mcdonald', 'burger king', 'kfc', 'subway', 'pizza', 'lieferando', 'dominos',
      'starbucks', 'cafe', 'kneipe', 'kino', 'theater', 'museum', 'freizeitpark', 'schwimmbad',
      'konzert', 'festival',
      // Reisen
      'urlaub', 'reise', 'hotel', 'airbnb', 'booking', 'flug', 'fluege', 'ryanair', 'lufthansa', 'eurowings',
      // Mode & Schuhe
      'kleidung', 'mode', 'schuhe', 'sneaker', 'zalando', 'about you', 'aboutyou', 'zara', 'h&m',
      'c&a', 'primark', 'nike', 'adidas', 'puma', 'levis', 'hugo boss', 'calvin klein',
      'tommy hilfiger', 'jack wolfskin', 'the north face', 'snipes', 'deichmann', 'bonprix', 'esprit',
      // Beauty & Parfüm
      'parfum', 'parfuem', 'parfuemerie', 'kosmetik', 'beauty', 'douglas', 'flaconi', 'sephora',
      'make-up', 'schminke',
      // Elektronik & allg. Shopping
      'amazon', 'otto', 'ebay', 'mediamarkt', 'saturn', 'conrad', 'cyberport', 'notebooksbilliger',
      'alternate', 'elektronik', 'ikea', 'hoeffner', 'xxxlutz', 'shopping', 'thalia', 'hugendubel',
      'spielwaren',
      // Sport & Hobby
      'decathlon', 'sportscheck', 'fitnessstudio', 'fitness', 'mcfit', 'fitx', 'clever fit', 'gym',
      'sportverein', 'hobby', 'steam', 'playstation', 'xbox', 'nintendo', 'freizeit',
    ],
  },
  {
    key: 'sonstiges',
    label: 'Sonstiges',
    farbe: '#94a3b8',
    textClass: 'text-[var(--app-text)]',
    keywords: [],
  },
] as const

const KATEGORIE_BY_KEY = new Map<FinanzKategorieKey, FinanzKategorieDef>(
  FINANZ_KATEGORIEN.map((k) => [k.key, k]),
)

export function kategorieDef(key: FinanzKategorieKey): FinanzKategorieDef {
  return KATEGORIE_BY_KEY.get(key) ?? KATEGORIE_BY_KEY.get('sonstiges')!
}

export function istKategorieKey(x: unknown): x is FinanzKategorieKey {
  return typeof x === 'string' && KATEGORIE_BY_KEY.has(x as FinanzKategorieKey)
}

/**
 * Effektive Kategorie einer Buchung: Eine vom Nutzer gesetzte `kategorie_key` (manuelle Korrektur)
 * hat Vorrang vor der automatischen Zuordnung.
 */
export function effektiveKategorie(
  row: { kategorie?: string | null; beschreibung?: string | null; kategorie_key?: string | null },
  istEinnahme = false,
): FinanzKategorieKey {
  if (istKategorieKey(row.kategorie_key)) return row.kategorie_key
  return ordneKategorieZu(row.kategorie, row.beschreibung, istEinnahme)
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
 * Bewertet, wie gut ein Text zu einer Kategorie passt. Treffer werden nach Länge gewichtet
 * (längere/spezifischere Begriffe zählen mehr, z. B. „amazon prime“ schlägt „amazon“), und ein
 * zusätzlicher Treffer gibt einen kleinen Bonus.
 */
function bewerteKategorie(text: string, def: FinanzKategorieDef): number {
  let score = 0
  let treffer = 0
  for (const needle of def.keywords) {
    if (enthaeltGanzesWort(text, needle)) {
      score = Math.max(score, needle.length)
      treffer++
    }
  }
  return treffer === 0 ? 0 : score + (treffer - 1)
}

/**
 * Ordnet eine Buchung einer Oberkategorie zu (Scoring statt „erster Treffer gewinnt“).
 * Bei Gleichstand entscheidet die Reihenfolge in `FINANZ_KATEGORIEN` (spezifischere zuerst).
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
    return bewerteKategorie(text, kategorieDef('sparen')) > 0 ? 'sparen' : 'einkommen'
  }

  let beste: FinanzKategorieKey = 'sonstiges'
  let bestScore = 0
  for (const def of FINANZ_KATEGORIEN) {
    if (def.key === 'einkommen' || def.key === 'sonstiges') continue
    const s = bewerteKategorie(text, def)
    if (s > bestScore) {
      bestScore = s
      beste = def.key
    }
  }
  return beste
}

export type KategorieSumme = {
  key: FinanzKategorieKey
  label: string
  farbe: string
  betrag: number
  anteil: number
}

/** Aggregiert Buchungen nach Oberkategorie (absteigend nach Betrag). Berücksichtigt manuelle Korrekturen. */
export function summiereNachKategorie(
  rows: Array<{ kategorie?: string | null; beschreibung?: string | null; kategorie_key?: string | null; betrag?: number | string | null }>,
  istEinnahme = false,
): KategorieSumme[] {
  const map = new Map<FinanzKategorieKey, number>()
  for (const r of rows) {
    const b = Number(r.betrag)
    if (!Number.isFinite(b)) continue
    const key = effektiveKategorie(r, istEinnahme)
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

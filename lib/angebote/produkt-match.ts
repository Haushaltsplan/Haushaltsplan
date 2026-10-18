import type { Angebot, HaendlerId } from '@/lib/angebote/types'

/** Bekannte Eigenmarken — bei generischer Suche klar bevorzugen. */
const EIGENMARKEN = [
  'milsani',
  'gut und guenstig',
  'gut guenstig',
  'ja',
  'rewe beste wahl',
  'rewe bio',
  'rewe freiweg',
  'rewe feine welt',
  'rewe regional',
  'rewe to go',
  'rewe back station',
  'every day',
  'k classic',
  'k bio',
  'k take it veggie',
  'k favourites',
  'milbona',
  'alesto',
  'sondey',
  'freeway',
  'crivit',
  'parkside',
  'livarno',
  'silvercrest',
  'w5',
  'cimera',
  'pilos',
  'aro',
  'tip',
  'meine kaehre',
  'bio wertkost',
  'ein gutes stueck heimat',
  'gutbio',
  'belle france',
  'casino',
  'fairglobe',
  'one two free',
  'chef select',
  'deluxe',
  'freshona',
  'pikkolo',
  'cascada',
  'dovgan',
  'hatherwood',
  'ocean sea',
  'vitasia',
  'trattoria alfredo',
  'bistro',
  'landfreude',
  'heute',
  'landjunker',
  'mio fiorente',
  'tandil',
  'cucina',
  'belbake',
  'gardenline',
  'floralys',
  'cien',
  'dontodent',
]

/** Synonyme / Pluralformen → Suchvarianten */
const SYNONYME: Record<string, string[]> = {
  bananen: ['banane', 'bananen'],
  banane: ['banane', 'bananen'],
  butter: ['butter', 'deutsche markenbutter', 'feine butter'],
  milch: ['milch', 'frischmilch', 'vollmilch', 'haltbare milch'],
  eier: ['eier', 'ei', 'huehnereier'],
  ei: ['eier', 'ei'],
  kaese: ['kaese', 'schnittkaese'],
  brot: ['brot', 'vollkornbrot', 'toastbrot'],
  tomaten: ['tomate', 'tomaten', 'rispentomaten'],
  tomate: ['tomate', 'tomaten'],
  aepfel: ['apfel', 'aepfel', 'tafelapfel'],
  apfel: ['apfel', 'aepfel', 'tafelapfel'],
  kartoffeln: ['kartoffel', 'kartoffeln'],
  kartoffel: ['kartoffel', 'kartoffeln'],
  zwiebeln: ['zwiebel', 'zwiebeln'],
  joghurt: ['joghurt', 'jogurt'],
  yoghurt: ['joghurt', 'jogurt'],
  hackfleisch: ['hackfleisch', 'hack', 'rinderhack', 'gemischtes hack'],
  hack: ['hackfleisch', 'hack'],
  nudel: ['nudeln', 'nudel', 'spaghetti', 'pasta'],
  nudeln: ['nudeln', 'nudel', 'spaghetti', 'pasta'],
  toilettenpapier: ['toilettenpapier', 'klosettpapier', 'wc papier'],
  spuelmittel: ['spuelmittel', 'geschirrspuelmittel'],
  /** Frische Salatgurke — nicht Essiggurke */
  gurke: ['gurke', 'staudengurke', 'salatgurke', 'schlangengurke'],
  gurken: ['gurke', 'staudengurke', 'salatgurke', 'schlangengurke'],
  staudengurke: ['gurke', 'staudengurke', 'salatgurke'],
  paprika: ['paprika', 'peperoni'],
  salat: ['salat', 'kopfsalat', 'eisbergsalat'],
}

/**
 * Falsche Freunde: Query → Treffer die NICHT zählen dürfen.
 * „Gurke“ ≠ Essiggurke; „Butter“ ≠ Buttermilch.
 */
const FALSE_FRIENDS: Record<string, string[]> = {
  butter: [
    'buttermilch',
    'butterkaese',
    'butterbroetchen',
    'butterkekse',
    'butterkeks',
    'erdnussbutter',
    'kakaobutter',
    'sheabutter',
    'koerperbutter',
    'buttercreme',
    'butterzopf',
  ],
  milch: ['buttermilch', 'milchschnitte', 'milchschokolade', 'kondensmilch', 'milchreis'],
  banane: ['banani', 'bruno'],
  bananen: ['banani', 'bruno'],
  ei: ['eiweiss', 'eierlikoer', 'speiseeis', 'eiscreme', 'vanilleeis'],
  eier: ['eiweiss', 'eierlikoer'],
  gurke: [
    'essiggurke',
    'essiggurken',
    'gewuerzgurke',
    'gewuerzgurken',
    'saure gurke',
    'saure gurken',
    'cornichon',
    'cornichons',
    'sandwichgurke',
    'sandwichgurken',
    'senfgurke',
    'senfgurken',
    'honiggurke',
    'mixed pickles',
    'pickles',
    'eingelegte gurke',
    'eingelegte gurken',
    'gurkentopf',
    'relish',
  ],
  gurken: [
    'essiggurke',
    'essiggurken',
    'gewuerzgurke',
    'gewuerzgurken',
    'saure gurke',
    'cornichon',
    'sandwichgurke',
    'senfgurke',
    'pickles',
    'eingelegte',
  ],
  kaese: ['kaeseersatz', 'kaesekuchen'],
  salat: ['salatmayonnaise', 'salatcreme', 'salatdressing', 'salatsauce'],
  apfel: ['apfelmus', 'apfelsaft', 'apfelkuchen', 'apfelring'],
  aepfel: ['apfelmus', 'apfelsaft'],
  tomate: ['tomatensauce', 'tomatensuppe', 'tomatenmark', 'ketchup'],
  tomaten: ['tomatensauce', 'tomatensuppe', 'tomatenmark', 'ketchup'],
  zwiebel: ['zwiebelring', 'roestzwiebel', 'zwiebelpulver'],
  zwiebeln: ['zwiebelring', 'roestzwiebel'],
}

/** Frische Varianten → Score-Bonus (Query-Token → Name-Teile). */
const FRISCH_BOOST: Record<string, string[]> = {
  gurke: ['stauden', 'salatgurke', 'schlangen', 'frisch', 'lose'],
  gurken: ['stauden', 'salatgurke', 'schlangen', 'frisch', 'lose'],
  milch: ['frischmilch', 'frisch'],
  butter: ['deutsche markenbutter', 'feine butter', 'suesse rahmbutter'],
  tomate: ['rispen', 'frisch', 'lose'],
  tomaten: ['rispen', 'frisch', 'lose'],
}

/** Verarbeitete Varianten → Malus. */
const VERARBEITET_MALUS: Record<string, string[]> = {
  gurke: ['essig', 'gewuerz', 'eingelegt', 'sauer', 'glas', 'eingelegte'],
  gurken: ['essig', 'gewuerz', 'eingelegt', 'sauer', 'glas'],
  milch: ['kakao', 'shake', 'drink', 'pudding'],
  apfel: ['mus', 'saft', 'ringe', 'chips'],
  tomate: ['sauce', 'mark', 'passiert', 'püriert', 'püree', 'puree'],
}

const NO_BRAND = new Set([
  'thisisnobrand123',
  'this is no brand',
  'no brand',
  'ohne marke',
  'unbekannt',
  'nobrand',
])

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/&/g, ' und ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function cleanMarke(marke: string | null | undefined): string | null {
  if (!marke?.trim()) return null
  const t = marke.trim()
  if (NO_BRAND.has(normalizeText(t).replace(/\s+/g, ''))) return null
  if (NO_BRAND.has(normalizeText(t))) return null
  return t
}

function eigenmarkeInText(n: string, haendler?: HaendlerId): boolean {
  if (!n) return false
  // „ja!“ oft als Token „ja“
  if (/(?:^|\s)ja(?:\s|$)/.test(` ${n} `) && n.length <= 12) return true
  if (EIGENMARKEN.some((e) => {
    if (e.length <= 3) return n === e || n.startsWith(`${e} `) || n.endsWith(` ${e}`)
    return n.includes(e)
  }))
    return true
  if (haendler === 'rewe' && (n.includes('rewe') || n.includes('ja '))) return true
  if (
    haendler === 'edeka' &&
    (n.includes('gut und guenstig') || n.includes('gut guenstig') || n.includes('edeka'))
  )
    return true
  if (
    haendler === 'lidl' &&
    ['milbona', 'alesto', 'sondey', 'freeway', 'freshona', 'pilos', 'heute', 'cien'].some((e) =>
      n.includes(e),
    )
  )
    return true
  if (haendler === 'penny' && (n.includes('penny') || n.includes('heute') || n.includes('mio')))
    return true
  if (haendler === 'aldi_sued' || haendler === 'aldi_nord') {
    if (['milsani', 'gutbio', 'mio', 'cucina', 'belbake', 'tandil'].some((e) => n.includes(e)))
      return true
  }
  if (haendler === 'kaufland' && (n.includes('k classic') || n.includes('k bio'))) return true
  return false
}

export function istEigenmarke(
  marke: string | null | undefined,
  haendler?: HaendlerId,
  name?: string | null,
): boolean {
  const m = cleanMarke(marke)
  const nameN = normalizeText(name ?? '')
  const markeN = normalizeText(m ?? '')
  if (!m && !nameN) return true // lose Ware ohne Marke
  if (!m && nameN && !eigenmarkeInText(nameN, haendler)) {
    // Obst/Gemüse ohne Marke oft lose Eigenware
    if (
      /gurke|tomate|apfel|banane|zwiebel|kartoffel|salat|paprika|gurken|aepfel/.test(nameN) &&
      !/essig|sauce|mark|saft|mus/.test(nameN)
    )
      return true
  }
  if (eigenmarkeInText(markeN, haendler)) return true
  if (eigenmarkeInText(nameN, haendler)) return true
  return false
}

/** Preisreduktion / Flyer → „im Angebot“. */
export function istImAngebot(a: Angebot): boolean {
  if (a.vorherigerPreisEur != null && a.vorherigerPreisEur > a.preisEur + 0.009) return true
  // Wochenflyer-Quellen zählen als Angebot
  if (a.quelle === 'marktguru') return true
  if (a.gueltigVon || a.gueltigBis) return true
  return false
}

export function angebotRabattProzent(a: Angebot): number | null {
  if (a.vorherigerPreisEur == null || a.vorherigerPreisEur <= a.preisEur) return null
  return Math.round((1 - a.preisEur / a.vorherigerPreisEur) * 100)
}

function expandQuery(suchbegriff: string): string[] {
  const base = normalizeText(suchbegriff)
  const tokens = base.split(/\s+/).filter((t) => t.length >= 2)
  const out = new Set<string>()
  out.add(base)
  for (const t of tokens) {
    out.add(t)
    const syns = SYNONYME[t]
    if (syns) for (const s of syns) out.add(s)
  }
  return [...out]
}

function hasWholeWord(hay: string, word: string): boolean {
  if (!word) return false
  const re = new RegExp(`(?:^|\\s)${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:s|n|en|e)?(?:\\s|$)`)
  return re.test(` ${hay} `)
}

function hatFalseFriend(query: string, hay: string): boolean {
  const qTokens = normalizeText(query).split(/\s+/).filter(Boolean)
  for (const qt of qTokens) {
    const friends = FALSE_FRIENDS[qt]
    if (!friends) continue
    for (const ff of friends) {
      if (hay.includes(ff) || hasWholeWord(hay, ff)) return true
    }
  }
  if (qTokens.includes('butter') && hay.includes('buttermilch')) return true
  if ((qTokens.includes('banane') || qTokens.includes('bananen')) && hay.includes('banani'))
    return true
  // Gurke: zusammengeschriebene Essig-/Gewürzgurke
  if (
    (qTokens.includes('gurke') || qTokens.includes('gurken')) &&
    /(essig|gewuerz|sauer|senf|honig|sandwich).*gurk|gurk.*(essig|glas)|cornichon|pickles/.test(
      hay,
    )
  )
    return true
  return false
}

/** Query wirkt wie Markenname (Haribo, Meggle) → Marke bevorzugen. */
function querySiehtNachMarkeAus(suchbegriff: string): boolean {
  const n = normalizeText(suchbegriff)
  const tokens = n.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return false
  // Generische Lebensmittel-Wörter
  const generisch = new Set([
    ...Object.keys(SYNONYME),
    'wasser',
    'cola',
    'kaffee',
    'tee',
    'mehl',
    'zucker',
    'salz',
    'oel',
    'reis',
    'quark',
    'sahne',
    'schinken',
    'wurst',
    'fisch',
    'huhn',
    'hähnchen',
    'haehnchen',
    'puten',
  ])
  if (tokens.every((t) => generisch.has(t) || SYNONYME[t])) return false
  // Ein Token, kein Synonym, Länge >= 4 → eher Marke
  if (tokens.length === 1 && tokens[0]!.length >= 4 && !generisch.has(tokens[0]!)) return true
  return tokens.some((t) => t.length >= 4 && !generisch.has(t) && !SYNONYME[t])
}

export type MatchErgebnis = {
  angebot: Angebot
  score: number
  eigenmarke: boolean
}

/**
 * Strenges Matching: Wortgrenzen, False-Friends, Synonyme, Frische-Boost.
 * Score höher = besserer Treffer.
 */
export function scoreAngebotFuerQuery(suchbegriff: string, a: Angebot): number {
  const nameN = normalizeText(a.name)
  const markeN = normalizeText(cleanMarke(a.marke) ?? '')
  const katN = normalizeText(a.kategorie ?? '')
  const packN = normalizeText(a.packungText ?? '')
  const hayAll = `${nameN} ${markeN} ${katN} ${packN}`
  const hayName = `${nameN} ${katN}`

  if (hatFalseFriend(suchbegriff, hayAll)) return -1

  const variants = expandQuery(suchbegriff)
  const primary = normalizeText(suchbegriff)
  const primaryTokens = primary.split(/\s+/).filter((t) => t.length >= 2)
  const eigen = istEigenmarke(a.marke, a.haendler, a.name)
  const markenQuery = querySiehtNachMarkeAus(suchbegriff)

  // Exakter Produktname
  if (nameN === primary || variants.some((v) => nameN === v)) {
    let s = 100
    if (eigen && !markenQuery) s += 8
    return s
  }

  // Primärer Suchbegriff als ganzes Wort im Namen
  const nameHit = primaryTokens.every((t) => {
    const syns = SYNONYME[t] ?? [t]
    return syns.some((s) => hasWholeWord(nameN, s) || hasWholeWord(hayName, s))
  })
  if (!nameHit) {
    const markeHit = primaryTokens.every((t) => hasWholeWord(markeN, t) || markeN.includes(t))
    if (markeHit && markeN.length > 0) return markenQuery ? 55 : 35
    return -1
  }

  let score = 70
  if (primaryTokens.some((t) => hasWholeWord(nameN, t))) score += 10

  // Frische-Boost / Verarbeitet-Malus
  for (const t of primaryTokens) {
    for (const b of FRISCH_BOOST[t] ?? []) {
      if (hayAll.includes(b)) score += 12
    }
    for (const m of VERARBEITET_MALUS[t] ?? []) {
      if (hayAll.includes(m)) score -= 25
    }
  }

  // Eigenmarke bei generischer Suche belohnen; bei Markensuche Marke belohnen
  if (!markenQuery && eigen) score += 14
  if (markenQuery && !eigen && cleanMarke(a.marke)) score += 10
  if (markenQuery && eigen) score -= 5

  if (nameN.startsWith('mit ') || nameN.includes(' mit ')) score -= 15
  if (packN.includes('versch') && packN.includes('sorten')) score -= 3

  // Rabattiertes Flyer-Angebot leicht bevorzugen
  if (istImAngebot(a)) score += 3

  return score
}

export type FindeOpts = {
  /** Bereits abgelehnte Angebots-IDs → nächster Vorschlag */
  excludeIds?: Iterable<string>
}

function rankKandidaten(
  suchbegriff: string,
  scored: MatchErgebnis[],
): MatchErgebnis[] {
  if (!scored.length) return []
  const markenQuery = querySiehtNachMarkeAus(suchbegriff)
  const gute = scored.filter((s) => s.score >= 50)
  const pool = [...(gute.length ? gute : scored)]

  pool.sort((a, b) => {
    const scoreDiff = b.score - a.score
    // Großer Score-Unterschied sticht Preis
    if (Math.abs(scoreDiff) > 12) return scoreDiff

    const pa = a.angebot.preisEur
    const pb = b.angebot.preisEur

    if (!markenQuery) {
      // Eigenmarke bis +20 % teurer noch vor Markenprodukt
      if (a.eigenmarke && !b.eigenmarke && pa <= pb * 1.2 + 0.02) return -1
      if (b.eigenmarke && !a.eigenmarke && pb <= pa * 1.2 + 0.02) return 1
    }

    if (Math.abs(pa - pb) > 0.04) return pa - pb

    // Gleichstand: generisch → Eigenmarke; Markensuche → Marke
    if (a.eigenmarke !== b.eigenmarke) {
      return markenQuery ? (a.eigenmarke ? 1 : -1) : a.eigenmarke ? -1 : 1
    }
    return scoreDiff
  })

  return pool
}

export function findeKandidaten(
  suchbegriff: string,
  angebote: Angebot[],
  haendler: HaendlerId,
  opts?: FindeOpts,
): MatchErgebnis[] {
  const exclude = new Set(opts?.excludeIds ?? [])
  const kandidaten = angebote.filter((a) => a.haendler === haendler && !exclude.has(a.id))
  const scored: MatchErgebnis[] = []
  for (const a of kandidaten) {
    const score = scoreAngebotFuerQuery(suchbegriff, a)
    if (score < 0) continue
    scored.push({
      angebot: a,
      score,
      eigenmarke: istEigenmarke(a.marke, a.haendler, a.name),
    })
  }
  return rankKandidaten(suchbegriff, scored)
}

export function findeGuenstigstesAngebot(
  suchbegriff: string,
  angebote: Angebot[],
  haendler: HaendlerId,
  opts?: FindeOpts,
): Angebot | null {
  return findeKandidaten(suchbegriff, angebote, haendler, opts)[0]?.angebot ?? null
}

/** Suchvarianten für API-Calls (Banane + Bananen, Gurke + Staudengurke). */
export function suchvarianten(suchbegriff: string): string[] {
  const n = normalizeText(suchbegriff)
  const out = new Set<string>([suchbegriff.trim(), n])
  for (const t of n.split(/\s+/)) {
    const syns = SYNONYME[t]
    if (syns) for (const s of syns) out.add(s)
  }
  return [...out].filter(Boolean)
}

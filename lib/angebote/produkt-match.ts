import type { Angebot, HaendlerId } from '@/lib/angebote/types'

/** Bekannte Eigenmarken — bei gleichem/ähnlichem Preis bevorzugen. */
const EIGENMARKEN = [
  'milsani',
  'gut & guenstig',
  'gut und guenstig',
  'ja!',
  'ja ',
  'rewe beste wahl',
  'rewe bio',
  'rewe freiweg',
  'every day',
  'k-classic',
  'k-bio',
  'k-take it veggie',
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
  'penny',
  'netto',
  'aldi',
  'markal',
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
]

/** Synonyme / Pluralformen → Suchvarianten */
const SYNONYME: Record<string, string[]> = {
  bananen: ['banane', 'bananen'],
  banane: ['banane', 'bananen'],
  butter: ['butter'],
  milch: ['milch', 'frischmilch', 'haltbare milch'],
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
}

/**
 * Falsche Freunde: Query → Wörter die NICHT zählen dürfen.
 * „Butter“ darf nicht „Buttermilch“ treffen.
 */
const FALSE_FRIENDS: Record<string, string[]> = {
  butter: [
    'buttermilch',
    'butterkaese',
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
  milch: ['buttermilch', 'milchschnitte', 'milchschokolade', 'kondensmilch'],
  banane: ['banani', 'bruno'],
  bananen: ['banani', 'bruno'],
  ei: ['eiweiss', 'eierlikoer', 'speiseeis', 'eiscreme', 'vanilleeis'],
  eier: ['eiweiss', 'eierlikoer'],
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

export function istEigenmarke(marke: string | null | undefined, haendler?: HaendlerId): boolean {
  const m = cleanMarke(marke)
  if (!m) {
    // Obst/Gemüse ohne Marke = oft lose Eigenware → als sparsam werten
    return true
  }
  const n = normalizeText(m)
  if (EIGENMARKEN.some((e) => n.includes(e) || e.includes(n))) return true
  if (haendler === 'rewe' && n.includes('rewe')) return true
  if (haendler === 'edeka' && (n.includes('gut') || n.includes('guenstig') || n.includes('edeka')))
    return true
  if (haendler === 'lidl' && ['milbona', 'alesto', 'sondey', 'freeway', 'freshona', 'pilos'].some((e) => n.includes(e)))
    return true
  return false
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
      if (hasWholeWord(hay, ff) || hay.includes(ff)) return true
    }
  }
  // Spezial: Query „butter“ und Heu enthält „buttermilch“
  if (qTokens.includes('butter') && hay.includes('buttermilch')) return true
  if ((qTokens.includes('banane') || qTokens.includes('bananen')) && hay.includes('banani'))
    return true
  return false
}

export type MatchErgebnis = {
  angebot: Angebot
  score: number
  eigenmarke: boolean
}

/**
 * Strenges Matching: Wortgrenzen, False-Friends, Synonyme.
 * Score höher = besserer Treffer. Eigenmarke als Tiebreaker.
 */
export function scoreAngebotFuerQuery(suchbegriff: string, a: Angebot): number {
  const nameN = normalizeText(a.name)
  const markeN = normalizeText(cleanMarke(a.marke) ?? '')
  const katN = normalizeText(a.kategorie ?? '')
  const packN = normalizeText(a.packungText ?? '')
  const hayAll = `${nameN} ${markeN} ${katN}`
  const hayName = `${nameN} ${katN}`

  if (hatFalseFriend(suchbegriff, `${hayAll} ${packN}`)) return -1

  const variants = expandQuery(suchbegriff)
  const primary = normalizeText(suchbegriff)

  // Exakter Produktname
  if (nameN === primary || variants.some((v) => nameN === v)) return 100

  // Primärer Suchbegriff als ganzes Wort im Namen
  const primaryTokens = primary.split(/\s+/).filter((t) => t.length >= 2)
  const nameHit = primaryTokens.every((t) => {
    const syns = SYNONYME[t] ?? [t]
    return syns.some((s) => hasWholeWord(nameN, s) || hasWholeWord(hayName, s))
  })
  if (!nameHit) {
    // Marke allein reicht nur wenn Suchbegriff die Marke ist (z. B. „haribo“)
    const markeHit = primaryTokens.every((t) => hasWholeWord(markeN, t) || markeN.includes(t))
    if (markeHit && markeN.length > 0) return 40
    return -1
  }

  let score = 70
  if (primaryTokens.some((t) => hasWholeWord(nameN, t))) score += 10
  // Bei sonst gleichem Score: Markenprodukt leicht bevorzugen (nicht Eigenmarke)
  if (!istEigenmarke(a.marke, a.haendler) && cleanMarke(a.marke)) score += 5
  // „mit Butter XXL“ (Rama) ist schwächer als „Butter“ / „Feine Butter“
  if (nameN.startsWith('mit ') || nameN.includes(' mit ')) score -= 15
  if (packN.includes('versch') && packN.includes('sorten')) score -= 3
  return score
}

export function findeGuenstigstesAngebot(
  suchbegriff: string,
  angebote: Angebot[],
  haendler: HaendlerId,
): Angebot | null {
  const kandidaten = angebote.filter((a) => a.haendler === haendler)
  const scored: MatchErgebnis[] = []
  for (const a of kandidaten) {
    const score = scoreAngebotFuerQuery(suchbegriff, a)
    if (score < 0) continue
    scored.push({
      angebot: a,
      score,
      eigenmarke: istEigenmarke(a.marke, a.haendler),
    })
  }
  if (!scored.length) return null

  // 1) Nur gute Treffer (score >= 50), sonst alle positiven
  const gute = scored.filter((s) => s.score >= 50)
  const pool = gute.length ? gute : scored

  // 2) Unter den guten: günstigster Preis; bei Gleichstand Markenprodukt vor Eigenmarke
  pool.sort((a, b) => {
    if (a.angebot.preisEur !== b.angebot.preisEur) {
      return a.angebot.preisEur - b.angebot.preisEur
    }
    if (a.eigenmarke !== b.eigenmarke) return a.eigenmarke ? 1 : -1
    return b.score - a.score
  })

  return pool[0]!.angebot
}

/** Suchvarianten für API-Calls (Banane + Bananen). */
export function suchvarianten(suchbegriff: string): string[] {
  const n = normalizeText(suchbegriff)
  const out = new Set<string>([suchbegriff.trim(), n])
  for (const t of n.split(/\s+/)) {
    const syns = SYNONYME[t]
    if (syns) for (const s of syns) out.add(s)
  }
  return [...out].filter(Boolean)
}

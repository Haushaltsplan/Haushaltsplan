/**
 * Zielmarkt des Shops (Versandprofil „Standard“): Deutschland + EU-Nachbarn.
 * Kein Versand nach USA, UK, Schweiz → englische Tags erreichen kaum kaufberechtigte Käufer.
 * Client-safe (UI, Regeln, Prompts).
 */

export type EtsyVersandland = { code: string; name: string; versandEur: number }

export const ETSY_VERSAND_AB_PLZ = '94542'

export const ETSY_VERSANDLAENDER: EtsyVersandland[] = [
  { code: 'DE', name: 'Deutschland', versandEur: 2.9 },
  { code: 'AT', name: 'Österreich', versandEur: 14.9 },
  { code: 'NL', name: 'Niederlande', versandEur: 14.9 },
  { code: 'BE', name: 'Belgien', versandEur: 14.9 },
  { code: 'LU', name: 'Luxemburg', versandEur: 14.9 },
  { code: 'DK', name: 'Dänemark', versandEur: 14.9 },
  { code: 'PL', name: 'Polen', versandEur: 14.9 },
  { code: 'CZ', name: 'Tschechien', versandEur: 14.9 },
  { code: 'SK', name: 'Slowakei', versandEur: 14.9 },
  { code: 'SI', name: 'Slowenien', versandEur: 14.9 },
  { code: 'HU', name: 'Ungarn', versandEur: 14.9 },
  { code: 'FR', name: 'Frankreich', versandEur: 17.9 },
  { code: 'IT', name: 'Italien', versandEur: 17.9 },
  { code: 'ES', name: 'Spanien', versandEur: 17.9 },
]

/** Etsy Open API `shop_location` — Konkurrenz aus demselben Heimatmarkt. */
export const ETSY_KONKURRENZ_SHOP_LOCATION = 'Germany'

/** Obergrenze fremdsprachiger Tags (EU-Käufer suchen teils englisch, Etsy übersetzt maschinell). */
export const ETSY_MAX_FREMDSPRACHIGE_TAGS = 2

export const ETSY_ZIELMARKT_PROMPT = [
  `ZIELMARKT (Versandprofil): Hauptmarkt DEUTSCHLAND (Versand ${ETSY_VERSANDLAENDER[0]!.versandEur.toFixed(2).replace('.', ',')} €, 1–4 Werktage, ab Niederbayern).`,
  `Zusätzlich EU: ${ETSY_VERSANDLAENDER.slice(1).map((l) => l.name).join(', ')}.`,
  'KEIN Versand nach USA, UK, Schweiz, weltweit → keine US/UK-Keywords, keine Aussagen wie „worldwide shipping“, „free shipping“ oder Zoll-/Dollar-Hinweise.',
  `Tags und Titel DEUTSCH; höchstens ${ETSY_MAX_FREMDSPRACHIGE_TAGS} englische Tags als Ergänzung (Etsy übersetzt Listings für EU-Käufer automatisch).`,
  'KI-/Intent-Suchanfragen aus Sicht deutscher Käufer formulieren (Herkunft Bayern/Deutschland ist ein Kaufargument).',
].join('\n')

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim()
}

const FREMD_WOERTER = new Set([
  // EN
  'bowl', 'bowls', 'wood', 'wooden', 'handmade', 'hand', 'made', 'gift', 'gifts', 'decor', 'natural', 'rustic',
  'turned', 'kitchen', 'home', 'fruit', 'serving', 'centerpiece', 'table', 'farmhouse', 'snack', 'salad',
  'her', 'him', 'mom', 'dad', 'housewarming', 'anniversary', 'wedding', 'unique', 'live', 'edge', 'decorative',
  'carved', 'woodturning', 'woodturned', 'art', 'for', 'the', 'and', 'with',
  // FR / NL / IT / ES / PL / DK
  'bois', 'bol', 'coupe', 'cadeau', 'fait', 'main', 'hout', 'houten', 'schaal', 'legno', 'ciotola',
  'madera', 'cuenco', 'drewno', 'drewniana', 'miska', 'trae', 'skal',
])

const DEUTSCH_WOERTER = new Set([
  'schale', 'schalen', 'holz', 'holzschale', 'deko', 'geschenk', 'handgemacht', 'handgedreht', 'handgedrehte',
  'handgedrechselt', 'handgedrechselte',
  'unikat', 'massivholz', 'obstschale', 'schussel', 'drechselarbeit', 'natur', 'naturrand', 'rustikal',
  'rustikale', 'hochzeit', 'holzhochzeit', 'kuche', 'tisch', 'esstisch', 'wohnzimmer', 'dekoschale', 'aus',
  'mit', 'fur', 'und', 'gedrechselt', 'gedrechselte', 'holzdeko', 'holzgeschenk',
])

/** `fremd` = überwiegend nicht-deutsch (EN/FR/NL …), `neutral` = keine klare Sprache erkennbar. */
export function tagSprache(tag: string): 'de' | 'fremd' | 'neutral' {
  const roh = tag.toLowerCase()
  if (/[äöüß]/.test(roh)) return 'de'
  const worte = norm(tag).split(/[^a-z0-9]+/).filter(Boolean)
  if (worte.length === 0) return 'neutral'
  const de = worte.some((w) => DEUTSCH_WOERTER.has(w) || /(holz|schale|schussel|geschenk|deko)/.test(w))
  if (de) return 'de'
  return worte.some((w) => FREMD_WOERTER.has(w)) ? 'fremd' : 'neutral'
}

export function zaehleFremdsprachigeTags(tags: string[]): string[] {
  return tags.filter((t) => tagSprache(t) === 'fremd')
}

/** Holzart-Gruppen DE+EN; Obst-Hölzer nur mit „-holz/-baum“, sonst kollidiert „apfelschale“ (Nutzung). */
const HOLZ_GRUPPEN: Array<{ id: string; re: RegExp }> = [
  { id: 'eiche', re: /(eiche|\boak\b)/ },
  // \b: sonst trifft „g-esche-nk“
  { id: 'esche', re: /(\besche|\bash\b|ashwood)/ },
  { id: 'ahorn', re: /(ahorn|maple)/ },
  { id: 'nuss', re: /(walnuss|nussbaum|walnut)/ },
  { id: 'kirsch', re: /(kirschholz|kirschbaum|cherry)/ },
  { id: 'birke', re: /(birke|birch)/ },
  { id: 'buche', re: /(buche|beech)/ },
  { id: 'ulme', re: /(ulme|ruster|ruester|\belm\b)/ },
  { id: 'eibe', re: /(eibe|\byew\b)/ },
  { id: 'olive', re: /(olivenholz|olive ?wood)/ },
  { id: 'akazie', re: /(akazie|acacia)/ },
  { id: 'teak', re: /\bteak/ },
  { id: 'mango', re: /mango/ },
  { id: 'bambus', re: /(bambus|bamboo)/ },
  { id: 'kiefer', re: /(kiefer|\bpine\b)/ },
  { id: 'zirbe', re: /zirbe/ },
  { id: 'laerche', re: /(larche|laerche|larch)/ },
  { id: 'fichte', re: /(fichte|spruce)/ },
  { id: 'linde', re: /(lindenholz|\blinde\b|basswood)/ },
  { id: 'pflaume', re: /(pflaumenholz|zwetschg|plum ?wood)/ },
  { id: 'apfel', re: /(apfelholz|apfelbaum|apple ?wood)/ },
  { id: 'birne', re: /(birnenholz|birnbaum|pear ?wood)/ },
  { id: 'robinie', re: /(robinie|locust)/ },
  { id: 'kastanie', re: /(kastanie|chestnut)/ },
  { id: 'platane', re: /(platane|sycamore)/ },
  { id: 'palisander', re: /(palisander|rosewood)/ },
  { id: 'ebenholz', re: /(ebenholz|ebony)/ },
]

export function erkenneHolzGruppen(text: string): Set<string> {
  const t = norm(text)
  const out = new Set<string>()
  for (const g of HOLZ_GRUPPEN) if (g.re.test(t)) out.add(g.id)
  return out
}

/** true, wenn der Tag eine Holzart nennt, die das Produkt nicht hat. Ohne eigene Holzart kein Filter. */
export function nenntFremdeHolzart(tag: string, eigene: Set<string>): boolean {
  if (eigene.size === 0) return false
  const imTag = erkenneHolzGruppen(tag)
  if (imTag.size === 0) return false
  return [...imTag].some((g) => !eigene.has(g))
}

/**
 * Markt-Kandidaten für den Zielmarkt ordnen: fremde Holzarten raus,
 * Deutsch zuerst, fremdsprachige Phrasen gedeckelt ans Ende.
 */
export function filtereKandidatenFuerZielmarkt(kandidaten: string[], holzKontext?: string): string[] {
  const eigene = erkenneHolzGruppen(holzKontext || '')
  const de: string[] = []
  const neutral: string[] = []
  const fremd: string[] = []
  for (const k of kandidaten) {
    if (nenntFremdeHolzart(k, eigene)) continue
    const s = tagSprache(k)
    if (s === 'de') de.push(k)
    else if (s === 'neutral') neutral.push(k)
    else fremd.push(k)
  }
  return [...de, ...neutral, ...fremd.slice(0, ETSY_MAX_FREMDSPRACHIGE_TAGS + 1)]
}

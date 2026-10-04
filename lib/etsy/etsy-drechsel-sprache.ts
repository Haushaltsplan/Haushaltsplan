/**
 * Fach- und SEO-Sprache für Drechselware.
 *
 * Etsy-Suchdaten (Shop-Analytics, 12 Monate):
 * - gedrechselt: hohes Volumen, hohe Konkurrenz → gut als Tag
 * - handgedrechselt: mehr Suchen + weniger Konkurrenz als handgedreht → Titel/Beschreibung
 * - handgedreht: schwächer → ersetzen, nicht primär nutzen
 */

/** Titel/Fließtext: präzises Handwerks-Signal. */
export const ETSY_HANDWERK_TITEL = 'handgedrechselt'
/** Tag-tauglich (≤20 Zeichen): „gedrechselte schale“ = 19. */
export const ETSY_HANDWERK_TAG_SCHALE = 'gedrechselte schale'

const TAG_PAD = [
  ETSY_HANDWERK_TAG_SCHALE,
  'drechselarbeit',
  'holzschale unikat',
  'holzgeschenk',
  'massivholz schale',
  'naturrand schale',
  'obstschale holz',
  'esstisch deko',
  'niederbayern holz',
]

/**
 * Ersetzt „handgedreht*“ durch „handgedrechselt*“ (Groß/Klein).
 * „gedreht“ allein bleibt — zu generisch / andere Kontexte.
 */
export function normalisiereDrechselSprache(text: string): string {
  if (!text) return text
  return text.replace(/handgedreht/gi, (m) => {
    if (m === m.toUpperCase()) return 'HANDGEDRECHSELT'
    if (m[0] === m[0]!.toUpperCase()) return 'Handgedrechselt'
    return 'handgedrechselt'
  })
}

/** Tags: handgedreht* → handgedrechselt* bzw. Schalen-Phrase auf Tag-Länge. */
export function normalisiereDrechselTag(tag: string): string {
  const t = normalisiereDrechselSprache(tag.trim())
  const low = t.toLowerCase()
  if (
    low === 'handgedrehte schale' ||
    low === 'handgedrechselte schale' ||
    low === 'handgedrehte holzschale'
  ) {
    return ETSY_HANDWERK_TAG_SCHALE
  }
  if (low === 'handgedreht' || low === 'handgedrechselt') {
    return ETSY_HANDWERK_TITEL
  }
  return t.slice(0, 20)
}

export function normalisiereDrechselTags(
  tags: string[],
  opts?: { aufDreizehn?: boolean },
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const t = normalisiereDrechselTag(raw)
    if (!t) continue
    const k = t.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  if (opts?.aufDreizehn) {
    let i = 0
    while (out.length < 13 && i < TAG_PAD.length) {
      const t = TAG_PAD[i++]!
      const k = t.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      out.push(t)
    }
    return out.slice(0, 13)
  }
  return out
}

/** True, wenn noch die schwache Form „handgedreht“ vorkommt. */
export function enthaeltVeraltetesHandgedreht(text: string): boolean {
  return /handgedreht/i.test(text)
}

export type DrechselUmschreibung = {
  needsUpdate: boolean
  title: string
  description: string
  tags: string[]
  aenderungen: { title: boolean; description: boolean; tags: boolean }
}

function tagsGleich(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((t, i) => t.toLowerCase() === (b[i] || '').toLowerCase())
}

/** Reine Textumschreibung Titel/Beschreibung/Tags — kein API-Call. */
export function baueDrechselUmschreibung(listing: {
  title: string
  description: string
  tags: string[]
}): DrechselUmschreibung {
  const titleAlt = listing.title.trim()
  const title = normalisiereDrechselSprache(titleAlt).slice(0, 140)
  const description = normalisiereDrechselSprache(listing.description)
  const tagsVorher = listing.tags.map((t) => t.trim()).filter(Boolean)
  const tagsBrauchenFix = tagsVorher.some(
    (t) => enthaeltVeraltetesHandgedreht(t) || normalisiereDrechselTag(t) !== t,
  )
  const tags = tagsBrauchenFix
    ? normalisiereDrechselTags(tagsVorher, { aufDreizehn: tagsVorher.length === 13 })
    : tagsVorher

  const aenderungen = {
    title: title !== titleAlt,
    description: description !== listing.description,
    tags: tagsBrauchenFix && !tagsGleich(tags, tagsVorher),
  }
  return {
    needsUpdate: aenderungen.title || aenderungen.description || aenderungen.tags,
    title,
    description,
    tags,
    aenderungen,
  }
}

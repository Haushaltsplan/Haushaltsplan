/**
 * Regelbasierte Etsy-SEO-Checks — client- und serverseitig nutzbar.
 * Abgestimmt auf Query Matching / Exact Match / Front-Loading / 13 Long-Tail-Tags
 * (siehe etsy_seo_guidelines_ruleset).
 */

import type { EtsySeoIssue, EtsyShopListingDetail } from '@/lib/etsy/etsy-seo-audit-types'
import { ETSY_FORM_TAXONOMY } from '@/lib/etsy/etsy-types'

export const ETSY_SEO_TITLE_MAX = 140
/** Idealbereich laut Guide (Soft-Warning außerhalb). */
export const ETSY_SEO_TITLE_IDEAL_MIN = 70
export const ETSY_SEO_TITLE_IDEAL_MAX = 120
/** Mobile Front-Load: Primär-Keyword in den ersten N Zeichen. */
export const ETSY_SEO_TITLE_FRONTLOAD = 50
export const ETSY_SEO_TAG_MAX = 20
export const ETSY_SEO_TAG_COUNT = 13

/** Produkt-/Kategorie-Wörter, die in den ersten 50 Zeichen erwartet werden. */
const FRONTLOAD_KEYWORDS = [
  'schale',
  'schalen',
  'schüssel',
  'schuessel',
  'bowl',
  'bowls',
  'dose',
  'dosen',
  'behälter',
  'behaelter',
  'box',
  'vase',
  'vasen',
  'teller',
  'stab',
  'skulptur',
  'gefäß',
  'gefaess',
  'holzschale',
  'wood',
  'wooden',
  'turned',
  'gedreht',
  'handgedreht',
  'unikat',
]

/** Begriffe, die oft schon in Category/Material stecken — allein als Tag verschwendet. */
const ATTR_ONLY_STOP = new Set([
  'holz',
  'wood',
  'wooden',
  'oak',
  'eiche',
  'walnut',
  'walnuss',
  'maple',
  'ahorn',
  'bowl',
  'bowls',
  'schale',
  'schalen',
  'vase',
  'vasen',
  'dose',
  'dosen',
  'teller',
  'box',
  'handmade',
  'handgemacht',
  'woodturning',
  'drechseln',
])

export type EtsySeoRegelReport = {
  issues: EtsySeoIssue[]
  titleOk: boolean
  titleFrontloadOk: boolean
  titleLengthIdeal: boolean
  tagsCountOk: boolean
  tagsLengthOk: boolean
  tagsLongtailOk: boolean
  tagsStemOk: boolean
  tagsAttrOk: boolean
  descriptionOk: boolean
  scorePenalty: number
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
}

/** Grobes Stemming für Plural-/Stamm-Duplikate (DE/EN). */
export function stemWort(raw: string): string {
  let w = norm(raw).replace(/[^a-z0-9]/g, '')
  if (w.length < 4) return w
  if (w.endsWith('schen') && w.length > 6) w = w.slice(0, -5)
  else if (w.endsWith('chen') && w.length > 6) w = w.slice(0, -4)
  else if (w.endsWith('en') && w.length > 5) w = w.slice(0, -2)
  else if (w.endsWith('er') && w.length > 5) w = w.slice(0, -2)
  else if (w.endsWith('e') && w.length > 4) w = w.slice(0, -1)
  else if (w.endsWith('s') && w.length > 4 && !w.endsWith('ss')) w = w.slice(0, -1)
  return w
}

function woerter(text: string): string[] {
  return norm(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2)
}

function taxonomyLabelFuerId(taxonomyId: number | null | undefined): string | null {
  if (taxonomyId == null) return null
  for (const v of Object.values(ETSY_FORM_TAXONOMY)) {
    if (v.id === taxonomyId) return v.label
  }
  return null
}

function attributeWortSatz(opts: {
  materials?: string[]
  taxonomyId?: number | null
  taxonomyLabel?: string | null
}): Set<string> {
  const set = new Set<string>()
  for (const m of opts.materials ?? []) {
    for (const w of woerter(m)) set.add(stemWort(w))
  }
  const label = opts.taxonomyLabel || taxonomyLabelFuerId(opts.taxonomyId ?? null)
  if (label) {
    for (const w of woerter(label)) set.add(stemWort(w))
  }
  // Häufige Material-/Kategorie-Stämme immer als „bereits abgedeckt“ behandeln,
  // wenn Material oder Taxonomy gesetzt ist.
  if ((opts.materials?.length ?? 0) > 0 || opts.taxonomyId != null || label) {
    for (const stop of ['holz', 'wood', 'wooden', 'schale', 'bowl', 'vase', 'dose', 'teller']) {
      set.add(stemWort(stop))
    }
  }
  return set
}

export function pruefeEtsySeoRegeln(input: {
  title: string
  tags: string[]
  description: string
  materials?: string[]
  taxonomyId?: number | null
  taxonomyLabel?: string | null
}): EtsySeoRegelReport {
  const issues: EtsySeoIssue[] = []
  let scorePenalty = 0
  const title = (input.title || '').trim()
  const tags = (input.tags || []).map((t) => t.trim()).filter(Boolean)
  const description = (input.description || '').trim()

  let titleOk = title.length > 0 && title.length <= ETSY_SEO_TITLE_MAX
  let titleFrontloadOk = true
  let titleLengthIdeal = true
  let tagsLengthOk = true
  let tagsLongtailOk = true
  let tagsStemOk = true
  let tagsAttrOk = true

  if (!title) {
    titleOk = false
    titleFrontloadOk = false
    titleLengthIdeal = false
    issues.push({ severity: 'error', field: 'title', message: 'Titel fehlt.' })
    scorePenalty += 25
  } else {
    if (title.length > ETSY_SEO_TITLE_MAX) {
      titleOk = false
      issues.push({
        severity: 'error',
        field: 'title',
        message: `Titel hat ${title.length} Zeichen (max. ${ETSY_SEO_TITLE_MAX}).`,
      })
      scorePenalty += 15
    } else if (title.length < ETSY_SEO_TITLE_IDEAL_MIN) {
      titleLengthIdeal = false
      issues.push({
        severity: 'warning',
        field: 'title',
        message: `Titel nur ${title.length} Zeichen — Ideal ${ETSY_SEO_TITLE_IDEAL_MIN}–${ETSY_SEO_TITLE_IDEAL_MAX} (Keywords + Lesbarkeit).`,
      })
      scorePenalty += 4
    } else if (title.length > ETSY_SEO_TITLE_IDEAL_MAX) {
      titleLengthIdeal = false
      issues.push({
        severity: 'info',
        field: 'title',
        message: `Titel ${title.length} Zeichen — Ideal bis ${ETSY_SEO_TITLE_IDEAL_MAX}; Mobile schneidet früher ab.`,
      })
      scorePenalty += 2
    }

    const front = norm(title.slice(0, ETSY_SEO_TITLE_FRONTLOAD))
    const hatKeyword = FRONTLOAD_KEYWORDS.some((k) => front.includes(norm(k)))
    if (!hatKeyword) {
      titleFrontloadOk = false
      issues.push({
        severity: 'warning',
        field: 'title',
        message: `Primär-Keyword fehlt in den ersten ${ETSY_SEO_TITLE_FRONTLOAD} Zeichen (Mobile Front-Loading).`,
      })
      scorePenalty += 8
    }

    const fluff = /\b(beautiful|amazing|best|wunderbar|traumhaft|einzigartig|premium)\b/i
    if (fluff.test(title.slice(0, ETSY_SEO_TITLE_FRONTLOAD))) {
      titleFrontloadOk = false
      issues.push({
        severity: 'warning',
        field: 'title',
        message: 'Subjektive Füllwörter vorne im Titel — Platz für Exact-Match-Keywords nutzen.',
      })
      scorePenalty += 4
    }
  }

  const tagsCountOk = tags.length === ETSY_SEO_TAG_COUNT
  if (tags.length !== ETSY_SEO_TAG_COUNT) {
    issues.push({
      severity: tags.length < ETSY_SEO_TAG_COUNT ? 'error' : 'warning',
      field: 'tags',
      message: `${tags.length} von ${ETSY_SEO_TAG_COUNT} Tags genutzt.`,
    })
    scorePenalty += tags.length < ETSY_SEO_TAG_COUNT ? 12 : 4
  }

  for (const t of tags) {
    if (t.length > ETSY_SEO_TAG_MAX) {
      tagsLengthOk = false
      issues.push({
        severity: 'error',
        field: 'tags',
        message: `Tag „${t.slice(0, 24)}${t.length > 24 ? '…' : ''}“ hat ${t.length} Zeichen (max. ${ETSY_SEO_TAG_MAX}).`,
      })
      scorePenalty += 5
    }
    if (t.includes(',')) {
      tagsLengthOk = false
      issues.push({
        severity: 'error',
        field: 'tags',
        message: `Tag enthält Komma: „${t.slice(0, 30)}“.`,
      })
      scorePenalty += 5
    }
  }

  const seenExact = new Set<string>()
  for (const t of tags) {
    const k = norm(t)
    if (seenExact.has(k)) {
      issues.push({
        severity: 'warning',
        field: 'tags',
        message: `Doppeltes Tag: „${t}“.`,
      })
      scorePenalty += 3
    }
    seenExact.add(k)
  }

  // Stemming / Plurals: Einwort-Tags mit gleichem Stamm verschwenden Slots
  const stemMap = new Map<string, string[]>()
  for (const t of tags) {
    const parts = woerter(t)
    if (parts.length !== 1) continue
    const st = stemWort(parts[0])
    if (st.length < 3) continue
    const arr = stemMap.get(st) ?? []
    arr.push(t)
    stemMap.set(st, arr)
  }
  for (const [, group] of stemMap) {
    if (group.length < 2) continue
    tagsStemOk = false
    issues.push({
      severity: 'warning',
      field: 'tags',
      message: `Stemming-Duplikat (Etsy erkennt Plural/Stamm): ${group.map((g) => `„${g}“`).join(' / ')}.`,
    })
    scorePenalty += 4
  }

  // Long-Tail: zu viele Einwort-Tags
  const singleWord = tags.filter((t) => woerter(t).length <= 1)
  if (tags.length >= 5 && singleWord.length >= Math.ceil(tags.length * 0.45)) {
    tagsLongtailOk = false
    issues.push({
      severity: 'warning',
      field: 'tags',
      message: `${singleWord.length} Einwort-Tags — Long-Tail-Phrasen bevorzugen (z. B. „hand turned oak bowl“).`,
    })
    scorePenalty += 5
  }

  // Category/Attribute nicht als alleinige Tags wiederholen
  const attrStems = attributeWortSatz({
    materials: input.materials,
    taxonomyId: input.taxonomyId,
    taxonomyLabel: input.taxonomyLabel,
  })
  if (attrStems.size > 0) {
    for (const t of tags) {
      const parts = woerter(t)
      if (parts.length === 0) continue
      // Reiner Stop-Begriff oder nur Attribute-Wörter
      const allAttr = parts.every((p) => attrStems.has(stemWort(p)) || ATTR_ONLY_STOP.has(norm(p)))
      const isStopAlone = parts.length === 1 && ATTR_ONLY_STOP.has(norm(parts[0]))
      if (isStopAlone || (parts.length <= 2 && allAttr)) {
        tagsAttrOk = false
        issues.push({
          severity: 'warning',
          field: 'tags',
          message: `Tag „${t}“ wiederholt nur Kategorie/Material — Slot für Long-Tail nutzen.`,
        })
        scorePenalty += 3
      }
    }
  }

  const descriptionOk = description.length >= 80
  if (!description) {
    issues.push({ severity: 'error', field: 'description', message: 'Beschreibung fehlt.' })
    scorePenalty += 20
  } else if (description.length < 80) {
    issues.push({
      severity: 'warning',
      field: 'description',
      message: 'Beschreibung sehr kurz — GEO (WAS/FÜR WEN/ANLASS) kaum abdeckbar.',
    })
    scorePenalty += 8
  }

  // Exact Match: Titel-Keywords in Tags
  const titleWords = title
    .toLowerCase()
    .split(/[^a-zäöüß0-9]+/i)
    .filter((w) => w.length >= 4)
  const tagBlob = tags.join(' ').toLowerCase()
  const missing = titleWords.filter((w) => !tagBlob.includes(w)).slice(0, 3)
  if (missing.length >= 2 && tags.length > 0) {
    issues.push({
      severity: 'warning',
      field: 'tags',
      message: `Titel-Keywords fehlen in Tags: ${missing.join(', ')}.`,
    })
    scorePenalty += 4
  }

  return {
    issues,
    titleOk,
    titleFrontloadOk,
    titleLengthIdeal,
    tagsCountOk,
    tagsLengthOk,
    tagsLongtailOk,
    tagsStemOk,
    tagsAttrOk,
    descriptionOk,
    scorePenalty: Math.min(60, scorePenalty),
  }
}

export function pruefeListingRegeln(
  listing: Pick<
    EtsyShopListingDetail,
    'title' | 'tags' | 'description' | 'materials' | 'taxonomyId'
  > & { taxonomyLabel?: string | null },
): EtsySeoRegelReport {
  return pruefeEtsySeoRegeln({
    title: listing.title,
    tags: listing.tags,
    description: listing.description,
    materials: listing.materials,
    taxonomyId: listing.taxonomyId,
    taxonomyLabel: listing.taxonomyLabel ?? null,
  })
}

export function scoreFarbe(score: number): 'rot' | 'gelb' | 'gruen' {
  if (score < 60) return 'rot'
  if (score < 80) return 'gelb'
  return 'gruen'
}

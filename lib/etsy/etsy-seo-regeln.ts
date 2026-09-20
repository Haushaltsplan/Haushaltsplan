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

/** Long-Tail: Mehrwort-Phrase ODER sinnvolles DE-Kompositum (ohne Leerzeichen). */
export function istTagLongtail(tag: string): boolean {
  const parts = woerter(tag)
  if (parts.length >= 2) return true
  const raw = tag.replace(/\s/g, '')
  if (raw.length >= 12) return true
  if (
    raw.length >= 8 &&
    /(schale|holz|drechsel|unikat|rinde|esche|eiche|ahorn|naturrand|gedreht|obst|deko|geschenk)/i.test(
      raw,
    )
  ) {
    return true
  }
  return false
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

  // Long-Tail: kurze Einwort-Tags (DE-Komposita ≥8 mit Produktstamm zählen als Long-Tail)
  const weakTags = tags.filter((t) => !istTagLongtail(t))
  if (tags.length >= 5 && weakTags.length >= Math.ceil(tags.length * 0.45)) {
    tagsLongtailOk = false
    issues.push({
      severity: 'warning',
      field: 'tags',
      message: `${weakTags.length} schwache Kurz-Tags — Long-Tail oder DE-Komposita (z. B. „esche holzschale“, „naturrandschale“).`,
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
      // Nur reine 1-Wort-Stops (nicht Multiwort-Phrasen)
      const isStopAlone = parts.length === 1 && ATTR_ONLY_STOP.has(norm(parts[0]))
      if (isStopAlone) {
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

  // Exact Match: relevante Titel-Keywords in Tags (Standort/Prozess-Füllwörter auslassen)
  const TITLE_TAG_SKIP = new Set([
    'handgedreht',
    'handgefertigt',
    'unikat',
    'niederbayern',
    'deutschland',
    'aus',
    'mit',
    'und',
    'oder',
    'cm',
    'ca',
    'fuer',
    'für',
  ])
  const titleWords = title
    .toLowerCase()
    .split(/[^a-zäöüß0-9]+/i)
    .filter((w) => w.length >= 5 && !TITLE_TAG_SKIP.has(norm(w)))
  const tagBlob = tags.join(' ').toLowerCase()
  const missing = titleWords
    .filter((w) => !tagBlob.includes(w) && !tags.some((t) => norm(t).includes(norm(w))))
    .slice(0, 3)
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

/** Live-Score für KI-Agent Schritt 2 (ohne Gemini) — SEO-Regeln + GEO-Heuristik. */
export type EtsyDraftSeoGeoScore = {
  seoScore: number
  geoScore: number
  overall: number
  regel: EtsySeoRegelReport
  geoNotes: string[]
}

export function berechneEtsyDraftSeoGeoScore(input: {
  title: string
  tags: string[]
  description: string
  materials?: string[]
  taxonomyId?: number | null
  taxonomyLabel?: string | null
}): EtsyDraftSeoGeoScore {
  const regel = pruefeEtsySeoRegeln(input)
  const seoScore = Math.max(0, Math.min(100, 100 - regel.scorePenalty))

  const desc = (input.description || '').trim()
  const lower = desc.toLowerCase()
  const titleLower = (input.title || '').toLowerCase()
  const geoNotes: string[] = []

  // GEO als Aufbau-Score (nicht nur Abzüge): klare Antworten für KI-Antwortboxen
  let geo = 55

  const cutEmoji = desc.search(/\n[🪵📏✨💎🧼🚫🌻]/)
  const intro = (cutEmoji > 40 ? desc.slice(0, cutEmoji) : desc.slice(0, 500)).trim()

  const hasWhat =
    /(schale|schüssel|schuessel|dose|vase|teller|stab|unikat|holz|esche|eiche|ahorn|walnuss|handgedreht|gedreht|naturrand|holzware)/i.test(
      `${intro} ${titleLower}`,
    )
  if (hasWhat) {
    geo += 15
  } else {
    geoNotes.push('WAS unklar: Produkt/Holzart in Intro oder Titel nennen.')
  }

  // VERWENDUNG:-Block zählt voll als FÜR WEN (auch ohne Keyword-Hit im Fließtext)
  const verwendungMatch = /verwendung\s*:\s*([^\n🪵📏✨💎]+)/i.exec(desc)
  const verwendungText = (verwendungMatch?.[1] || '').trim()
  const hasWho =
    verwendungText.length >= 12 ||
    /(sammler|geschenk|küche|kueche|obst|deko|tisch|sideboard|galerie|wohn|einzug|solitär|solitaer|repräsentativ|repraesentativ|sammlerstück|sammlerstueck|esstisch|obstschale|aufbewahrung|präsentation|praesentation)/i.test(
      lower,
    )
  if (hasWho) {
    geo += 18
  } else {
    geoNotes.push('FÜR WEN fehlt: VERWENDUNG-Zeile oder Zielgruppe (Obstschale, Geschenk, Sammler…).')
  }

  const hasOccasion =
    /(hochzeit|holzhochzeit|geburtstag|jubiläum|jubilaeum|einzug|weihnachten|vaterstag|muttertag|anlass|geschenk|jubilaeum)/i.test(
      lower,
    )
  if (hasOccasion) {
    geo += 8
  } else if (hasWho) {
    // Optional — nur Hinweis, kein harter Abzug wenn Verwendung klar ist
    geoNotes.push('Tipp: ANLASS erwähnen (Holzhochzeit, Einzug, Geschenk) für noch stärkeres GEO.')
  } else {
    geoNotes.push('ANLASS fehlt — zusammen mit FÜR WEN ergänzen.')
  }

  if (intro.length >= 80) geo += 4
  else if (intro.length < 40 && desc.length > 0) {
    geoNotes.push('Intro vor den Detail-Emojis etwas länger halten (2–3 Sätze).')
  }

  if (/🪵|📏|✨|verwendung\s*:/i.test(desc)) geo += 4
  if (desc.length >= 250) geo += 4
  else if (desc.length < 120) {
    geo -= 8
    geoNotes.push('Beschreibung insgesamt sehr kurz.')
  }

  const geoScore = Math.max(0, Math.min(100, Math.round(geo)))
  // SEO etwas stärker gewichtet — Marktplatz-Relevanz; GEO als Qualitäts-Bonus
  const overall = Math.round(0.6 * seoScore + 0.4 * geoScore)

  return { seoScore, geoScore, overall, regel, geoNotes }
}

/**
 * Deterministische Nachhärtung: Tags long-tailen, GEO-Intro ergänzen.
 * Wird nach KI-Optimierung angewandt, damit der Score nicht regressiert.
 */
export function haerteEtsyListingFuerScore(input: {
  title: string
  tags: string[]
  description: string
  holzart?: string
  produktForm?: string
}): { title: string; tags: string[]; description: string } {
  const title = input.title.trim().slice(0, ETSY_SEO_TITLE_MAX)
  const holz = (input.holzart || '').trim()
  const form = (input.produktForm || 'Schale').trim() || 'Schale'

  const seen = new Set<string>()
  const tags: string[] = []
  const pushTag = (raw: string) => {
    const t = raw.replace(/,/g, ' ').replace(/\s+/g, ' ').trim().slice(0, ETSY_SEO_TAG_MAX)
    if (!t) return
    const k = norm(t)
    if (seen.has(k)) return
    seen.add(k)
    tags.push(t)
  }

  for (const t of input.tags) pushTag(t)

  // Schwache Kurz-Tags zu Phrasen erweitern
  for (let i = 0; i < tags.length; i++) {
    if (istTagLongtail(tags[i])) continue
    const base = tags[i]
    const candidate =
      holz && !norm(base).includes(norm(holz))
        ? `${base} ${holz}`.slice(0, ETSY_SEO_TAG_MAX)
        : `${base} ${form}`.slice(0, ETSY_SEO_TAG_MAX)
    if (candidate.length > base.length && !seen.has(norm(candidate))) {
      seen.delete(norm(base))
      seen.add(norm(candidate))
      tags[i] = candidate
    }
  }

  const extras = [
    holz ? `${holz} holzschale` : 'holzschale unikat',
    'handgedreht holz',
    `${form.toLowerCase()} naturrand`.slice(0, ETSY_SEO_TAG_MAX),
    'rustikale holzdeko',
    'geschenk holz unik',
    'obstschale holz',
    'drechselarbeit de',
    'unikat holzdeko',
  ]
  for (const e of extras) {
    if (tags.length >= ETSY_SEO_TAG_COUNT) break
    pushTag(e)
  }
  while (tags.length > ETSY_SEO_TAG_COUNT) tags.pop()
  while (tags.length < ETSY_SEO_TAG_COUNT) {
    pushTag(`holzunikat ${tags.length + 1}`)
  }

  let description = input.description.trim()
  const lower = description.toLowerCase()
  const needsWho =
    !/(sammler|geschenk|küche|kueche|obst|deko|tisch|sideboard|verwendung|sammlerstück|obstschale|esstisch)/i.test(
      lower,
    )
  const needsOccasion = !/(hochzeit|geburtstag|einzug|weihnachten|anlass|geschenk|jubiläum)/i.test(lower)

  if (needsWho || needsOccasion) {
    const geoZeile = [
      needsWho
        ? `Ideal als repräsentative ${form} für Esstisch oder Sideboard, als Sammlerstück oder hochwertiges Geschenk.`
        : '',
      needsOccasion && needsWho
        ? `Passend als Anlass-Geschenk — etwa zur Holzhochzeit (5. Hochzeitstag), zum Einzug oder Geburtstag.`
        : needsOccasion
          ? `Auch als Geschenk zu Holzhochzeit, Einzug oder Geburtstag geeignet.`
          : '',
    ]
      .filter(Boolean)
      .join(' ')
    const cut = description.search(/\n[🪵📏✨💎]/)
    if (cut > 20) {
      description = `${description.slice(0, cut).trim()}\n\n${geoZeile}\n${description.slice(cut)}`
    } else {
      description = `${geoZeile}\n\n${description}`
    }
    // VERWENDUNG-Zeile ergänzen, falls fehlend
    if (needsWho && !/verwendung\s*:/i.test(description)) {
      description = description.replace(
        /(💎 CHARAKTER:[^\n]*)/i,
        `$1\nVERWENDUNG: Obstschale, Solitär-Dekoration für Esstisch/Sideboard, Sammlerstück oder Geschenk`,
      )
    }
  }

  return { title, tags: tags.slice(0, ETSY_SEO_TAG_COUNT), description }
}

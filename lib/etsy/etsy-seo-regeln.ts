/**
 * Regelbasierte Etsy-SEO-Checks — client- und serverseitig nutzbar.
 */

import type { EtsySeoIssue, EtsyShopListingDetail } from '@/lib/etsy/etsy-seo-audit-types'

export const ETSY_SEO_TITLE_MAX = 140
export const ETSY_SEO_TAG_MAX = 20
export const ETSY_SEO_TAG_COUNT = 13

export type EtsySeoRegelReport = {
  issues: EtsySeoIssue[]
  titleOk: boolean
  tagsCountOk: boolean
  tagsLengthOk: boolean
  descriptionOk: boolean
  scorePenalty: number
}

export function pruefeEtsySeoRegeln(input: {
  title: string
  tags: string[]
  description: string
}): EtsySeoRegelReport {
  const issues: EtsySeoIssue[] = []
  let scorePenalty = 0
  const title = (input.title || '').trim()
  const tags = (input.tags || []).map((t) => t.trim()).filter(Boolean)
  const description = (input.description || '').trim()

  const titleOk = title.length > 0 && title.length <= ETSY_SEO_TITLE_MAX
  if (!title) {
    issues.push({ severity: 'error', field: 'title', message: 'Titel fehlt.' })
    scorePenalty += 25
  } else if (title.length > ETSY_SEO_TITLE_MAX) {
    issues.push({
      severity: 'error',
      field: 'title',
      message: `Titel hat ${title.length} Zeichen (max. ${ETSY_SEO_TITLE_MAX}).`,
    })
    scorePenalty += 15
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

  let tagsLengthOk = true
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
      issues.push({
        severity: 'error',
        field: 'tags',
        message: `Tag enthält Komma: „${t.slice(0, 30)}“.`,
      })
      scorePenalty += 5
    }
  }

  const seen = new Set<string>()
  for (const t of tags) {
    const k = t.toLowerCase()
    if (seen.has(k)) {
      issues.push({
        severity: 'warning',
        field: 'tags',
        message: `Doppeltes Tag: „${t}“.`,
      })
      scorePenalty += 3
    }
    seen.add(k)
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

  // Hauptwörter aus Titel vs Tags
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
    tagsCountOk,
    tagsLengthOk,
    descriptionOk,
    scorePenalty: Math.min(60, scorePenalty),
  }
}

export function pruefeListingRegeln(listing: Pick<EtsyShopListingDetail, 'title' | 'tags' | 'description'>): EtsySeoRegelReport {
  return pruefeEtsySeoRegeln(listing)
}

export function scoreFarbe(score: number): 'rot' | 'gelb' | 'gruen' {
  if (score < 60) return 'rot'
  if (score < 80) return 'gelb'
  return 'gruen'
}

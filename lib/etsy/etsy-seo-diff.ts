/** Diff & Fingerprint für SEO-Audits. */

import type { EtsyShopListingDetail } from '@/lib/etsy/etsy-seo-audit-types'

export function listingFingerprint(listing: Pick<EtsyShopListingDetail, 'title' | 'tags' | 'description'>): string {
  const raw = [
    listing.title.trim(),
    [...listing.tags].map((t) => t.trim().toLowerCase()).sort().join('|'),
    listing.description.trim().slice(0, 800),
    String(listing.description.length),
  ].join('\n')
  // Einfacher stabiler Hash (kein crypto nötig auf Client)
  let h = 2166136261
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16)
}

export type EtsySeoDiffZeile = {
  field: 'title' | 'tags' | 'description'
  label: string
  before: string
  after: string
  changed: boolean
}

export function baueEtsySeoDiff(opts: {
  before: { title: string; tags: string[]; description: string }
  after: { title: string; tags: string[]; descriptionIntro?: string; description?: string }
}): EtsySeoDiffZeile[] {
  const beforeTags = opts.before.tags.join(', ')
  const afterTags = opts.after.tags.join(', ')
  const afterDesc =
    opts.after.description?.trim() ||
    (opts.after.descriptionIntro
      ? `${opts.after.descriptionIntro.trim()}\n\n${opts.before.description}`.trim()
      : opts.before.description)

  return [
    {
      field: 'title',
      label: 'Titel',
      before: opts.before.title,
      after: opts.after.title,
      changed: opts.before.title.trim() !== opts.after.title.trim(),
    },
    {
      field: 'tags',
      label: 'Tags',
      before: beforeTags,
      after: afterTags,
      changed: beforeTags !== afterTags,
    },
    {
      field: 'description',
      label: 'Beschreibung (Vorschau)',
      before: opts.before.description.slice(0, 500),
      after: afterDesc.slice(0, 500),
      changed: opts.before.description.trim() !== afterDesc.trim(),
    },
  ]
}

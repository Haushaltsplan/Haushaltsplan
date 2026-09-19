/** Batch-SEO-Audit mit Cache und begrenzter Parallelität. */

import 'server-only'

import { auditiereEtsyListing } from '@/lib/etsy/etsy-seo-audit-engine'
import {
  ladeEtsySeoCacheFuerListing,
  speichereEtsySeoAudit,
} from '@/lib/etsy/etsy-seo-audit-cache'
import type { EtsySeoAuditResult } from '@/lib/etsy/etsy-seo-audit-types'
import { listingFingerprint } from '@/lib/etsy/etsy-seo-diff'
import { ladeEtsyListingDetail, ladeEtsyShopListings } from '@/lib/etsy/etsy-listings-server'

export type EtsyBatchAuditZeile = {
  listingId: number
  title: string
  state: string
  overallScore: number
  fromCache: boolean
  auditedAt: string
  error?: string
  audit?: EtsySeoAuditResult
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx])
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)
  return out
}

export async function batchAuditiereEtsyShop(opts: {
  ownerUserId: string
  state?: string
  limit?: number
  force?: boolean
}): Promise<{ shopId: number; results: EtsyBatchAuditZeile[] }> {
  const limit = Math.min(25, Math.max(1, opts.limit ?? 15))
  const { shopId, listings } = await ladeEtsyShopListings(opts.ownerUserId, {
    state: opts.state || 'active',
    limit,
  })

  const results = await mapPool(listings, 2, async (kurz): Promise<EtsyBatchAuditZeile> => {
    try {
      const { listing } = await ladeEtsyListingDetail(opts.ownerUserId, kurz.listingId)
      const fp = listingFingerprint(listing)
      if (!opts.force) {
        const cached = await ladeEtsySeoCacheFuerListing(opts.ownerUserId, listing.listingId)
        if (cached && cached.fingerprint === fp) {
          return {
            listingId: listing.listingId,
            title: listing.title,
            state: listing.state,
            overallScore: cached.overallScore,
            fromCache: true,
            auditedAt: cached.auditedAt,
            audit: cached.audit,
          }
        }
      }
      const audit = await auditiereEtsyListing(listing)
      await speichereEtsySeoAudit({
        ownerUserId: opts.ownerUserId,
        listingId: listing.listingId,
        fingerprint: fp,
        audit,
        listingTitle: listing.title,
        state: listing.state,
      })
      return {
        listingId: listing.listingId,
        title: listing.title,
        state: listing.state,
        overallScore: audit.overall_score,
        fromCache: false,
        auditedAt: new Date().toISOString(),
        audit,
      }
    } catch (e) {
      return {
        listingId: kurz.listingId,
        title: kurz.title,
        state: kurz.state,
        overallScore: 0,
        fromCache: false,
        auditedAt: new Date().toISOString(),
        error: e instanceof Error ? e.message : 'Audit fehlgeschlagen',
      }
    }
  })

  results.sort((a, b) => {
    if (a.error && !b.error) return 1
    if (!a.error && b.error) return -1
    return a.overallScore - b.overallScore
  })

  return { shopId, results }
}

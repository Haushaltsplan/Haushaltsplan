/**
 * Top-5 Keywords laden: gecachter Auto-Scan + Merkliste + Fallback.
 */

import 'server-only'

import { ladeGecachtenKeywordScan } from '@/lib/etsy/etsy-keyword-auto-server'
import type { EtsyAutoKeywordScan } from '@/lib/etsy/etsy-markt-types'
import {
  listingProduktGruppe,
  waehleTopKeywords,
  type EtsyProduktGruppe,
  type EtsyTopKeyword,
} from '@/lib/etsy/etsy-top-keywords'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

async function ladeMerkliste(ownerUserId: string): Promise<string[]> {
  const { data, error } = await createSupabaseAdmin()
    .from('etsy_keyword_merkliste')
    .select('keyword')
    .eq('owner_user_id', ownerUserId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map((r) => String(r.keyword || '').trim()).filter(Boolean)
}

/** Frischer Scan, sonst auch abgelaufener Cache (besser als nur Fallback-Seeds). */
async function ladeScanAuchAbgelaufen(ownerUserId: string): Promise<EtsyAutoKeywordScan | null> {
  const frisch = await ladeGecachtenKeywordScan(ownerUserId).catch(() => null)
  if (frisch) return frisch
  const key = `keyword_auto:${ownerUserId}`.slice(0, 200)
  const { data } = await createSupabaseAdmin()
    .from('etsy_markt_cache')
    .select('payload')
    .eq('cache_key', key)
    .maybeSingle()
  const p = data?.payload as EtsyAutoKeywordScan | undefined
  if (!p?.alle?.length) return null
  return { ...p, ausCache: true }
}

export async function ladeTopKeywordsFuerListing(opts: {
  ownerUserId: string
  title: string
  tags: string[]
  limit?: number
}): Promise<{ gruppe: EtsyProduktGruppe; keywords: EtsyTopKeyword[] }> {
  const gruppe = listingProduktGruppe(opts.title, opts.tags)
  const [scan, merkliste] = await Promise.all([
    ladeScanAuchAbgelaufen(opts.ownerUserId),
    ladeMerkliste(opts.ownerUserId),
  ])
  const keywords = waehleTopKeywords({
    gruppe,
    scanKeywords: scan?.alle ?? [],
    merkliste,
    limit: opts.limit ?? 5,
  })
  return { gruppe, keywords }
}

/** Top-5 je Produktgruppe — für Shop-weites Rank-Tracking. */
export async function ladeTopKeywordsProGruppe(
  ownerUserId: string,
  limit = 5,
): Promise<Record<EtsyProduktGruppe, EtsyTopKeyword[]>> {
  const [scan, merkliste] = await Promise.all([
    ladeScanAuchAbgelaufen(ownerUserId),
    ladeMerkliste(ownerUserId),
  ])
  const alle = scan?.alle ?? []
  return {
    schale: waehleTopKeywords({ gruppe: 'schale', scanKeywords: alle, merkliste, limit }),
    vase: waehleTopKeywords({ gruppe: 'vase', scanKeywords: alle, merkliste, limit }),
    allgemein: waehleTopKeywords({ gruppe: 'allgemein', scanKeywords: alle, merkliste, limit }),
  }
}

import { ladeEtsyRankMap, ladeEtsySeoCacheMap } from '@/lib/etsy/etsy-seo-audit-cache'
import { ladeEtsyShopListings } from '@/lib/etsy/etsy-listings-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Listings inkl. Cache-Scores + Rank-Kurzinfo für die Übersicht. */
export async function GET(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 })

  const url = new URL(req.url)
  const state = url.searchParams.get('state') || 'active'
  const limit = Number(url.searchParams.get('limit') || 50)

  try {
    const [{ shopId, listings }, cacheMap, rankMap] = await Promise.all([
      ladeEtsyShopListings(user.id, { state, limit }),
      ladeEtsySeoCacheMap(user.id),
      ladeEtsyRankMap(user.id),
    ])

    const enriched = listings.map((l) => {
      const c = cacheMap.get(l.listingId)
      const r = rankMap.get(l.listingId)
      return {
        ...l,
        cachedScore: c?.overallScore ?? null,
        cachedAt: c?.auditedAt ?? null,
        cachedFingerprint: c?.fingerprint ?? null,
        rankPage: r?.bestPage ?? null,
        rankPosition: r?.bestPosition ?? null,
        rankKeyword: r?.keyword ?? null,
        rankCheckedAt: r?.checkedAt ?? null,
      }
    })

    enriched.sort((a, b) => {
      // Schwach rankende zuerst (hohe Seite), dann niedriger Score
      const ra = a.rankPage ?? 99
      const rb = b.rankPage ?? 99
      if (ra !== rb) return rb - ra
      const sa = a.cachedScore ?? 999
      const sb_ = b.cachedScore ?? 999
      return sa - sb_
    })

    return NextResponse.json({ ok: true, shopId, listings: enriched })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Listings laden fehlgeschlagen'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

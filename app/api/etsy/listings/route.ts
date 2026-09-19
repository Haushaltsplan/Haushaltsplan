import { ladeEtsySeoCacheMap } from '@/lib/etsy/etsy-seo-audit-cache'
import { ladeEtsyShopListings } from '@/lib/etsy/etsy-listings-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Listings inkl. Cache-Scores für die Übersicht. */
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
    const [{ shopId, listings }, cacheMap] = await Promise.all([
      ladeEtsyShopListings(user.id, { state, limit }),
      ladeEtsySeoCacheMap(user.id),
    ])

    const enriched = listings.map((l) => {
      const c = cacheMap.get(l.listingId)
      return {
        ...l,
        cachedScore: c?.overallScore ?? null,
        cachedAt: c?.auditedAt ?? null,
        cachedFingerprint: c?.fingerprint ?? null,
      }
    })

    enriched.sort((a, b) => {
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

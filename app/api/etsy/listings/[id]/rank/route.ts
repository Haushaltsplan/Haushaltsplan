import { trackeEtsyListingRanks } from '@/lib/etsy/etsy-rank-apify'
import { ladeEtsyListingDetail } from '@/lib/etsy/etsy-listings-server'
import { ladeEtsyRankCacheFuerListing } from '@/lib/etsy/etsy-seo-audit-cache'
import { ladeTopKeywordsFuerListing } from '@/lib/etsy/etsy-top-keywords-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

type Ctx = { params: Promise<{ id: string }> }

type Body = { keywords?: string[] }

export async function GET(req: Request, ctx: Ctx) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 })

  const { id } = await ctx.params
  const listingId = Number(id)
  if (!Number.isFinite(listingId) || listingId <= 0) {
    return NextResponse.json({ error: 'Ungültige listing id.' }, { status: 400 })
  }

  try {
    const { listing } = await ladeEtsyListingDetail(user.id, listingId)
    const [{ gruppe, keywords: top }, cache] = await Promise.all([
      ladeTopKeywordsFuerListing({
        ownerUserId: user.id,
        title: listing.title,
        tags: listing.tags,
      }),
      ladeEtsyRankCacheFuerListing(user.id, listingId),
    ])
    const byKw = new Map(cache.map((c) => [c.keyword.toLowerCase(), c]))
    const results = top.map((t) => {
      const c = byKw.get(t.keyword)
      return {
        keyword: t.keyword,
        page: c?.page ?? null,
        position: c?.position ?? null,
        found: c?.found ?? false,
        note: c?.note ?? (c ? undefined : 'noch nicht geprüft'),
        nachfrage: t.nachfrage,
        chance: t.chance,
        quellen: t.quellen,
        ausMerkliste: t.ausMerkliste,
        checkedAt: c?.checkedAt ?? null,
      }
    })
    return NextResponse.json({
      ok: true,
      gruppe,
      topKeywords: top,
      results,
      checkedAt: cache[0]?.checkedAt ?? null,
      provider: cache[0]?.provider ?? null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Rank-Cache laden fehlgeschlagen'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 })

  const { id } = await ctx.params
  const listingId = Number(id)
  if (!Number.isFinite(listingId) || listingId <= 0) {
    return NextResponse.json({ error: 'Ungültige listing id.' }, { status: 400 })
  }

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    /* keywords optional */
  }

  try {
    const { listing } = await ladeEtsyListingDetail(user.id, listingId)
    let keywords: string[]
    let gruppe: string | null = null
    let topMeta: Awaited<ReturnType<typeof ladeTopKeywordsFuerListing>>['keywords'] = []
    if (Array.isArray(body.keywords) && body.keywords.length > 0) {
      keywords = body.keywords.map(String)
    } else {
      const top = await ladeTopKeywordsFuerListing({
        ownerUserId: user.id,
        title: listing.title,
        tags: listing.tags,
      })
      gruppe = top.gruppe
      topMeta = top.keywords
      keywords = top.keywords.map((k) => k.keyword)
    }
    const rank = await trackeEtsyListingRanks({
      ownerUserId: user.id,
      listingId,
      listingUrl: listing.url,
      keywords,
    })
    return NextResponse.json({ ok: true, rank, gruppe, topKeywords: topMeta })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Rank-Check fehlgeschlagen'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

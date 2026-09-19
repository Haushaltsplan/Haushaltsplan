import { trackeEtsyListingRanks } from '@/lib/etsy/etsy-rank-apify'
import { ladeEtsyListingDetail } from '@/lib/etsy/etsy-listings-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

type Ctx = { params: Promise<{ id: string }> }

type Body = { keywords?: string[] }

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
    const keywords =
      Array.isArray(body.keywords) && body.keywords.length > 0
        ? body.keywords.map(String)
        : listing.tags.slice(0, 5)
    const rank = await trackeEtsyListingRanks({
      ownerUserId: user.id,
      listingId,
      listingUrl: listing.url,
      keywords,
    })
    return NextResponse.json({ ok: true, rank })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Rank-Check fehlgeschlagen'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

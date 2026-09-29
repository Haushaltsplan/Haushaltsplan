import { auditiereEtsyListing } from '@/lib/etsy/etsy-seo-audit-engine'
import {
  ladeEtsyHauptbegriff,
  ladeEtsySeoCacheFuerListing,
  ladeEtsySeoHistorie,
  speichereEtsySeoAudit,
} from '@/lib/etsy/etsy-seo-audit-cache'
import { listingFingerprint } from '@/lib/etsy/etsy-seo-diff'
import { ladeEtsyListingDetail } from '@/lib/etsy/etsy-listings-server'
import { pruefeListingRegeln } from '@/lib/etsy/etsy-seo-regeln'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 180

type Ctx = { params: Promise<{ id: string }> }

type Body = { force?: boolean }

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
    /* force optional */
  }

  try {
    const [{ listing }, hauptbegriff] = await Promise.all([
      ladeEtsyListingDetail(user.id, listingId),
      ladeEtsyHauptbegriff(user.id, listingId).catch(() => null),
    ])
    const fingerprint = listingFingerprint(listing)
    const regels = pruefeListingRegeln({ ...listing, hauptbegriff })

    if (!body.force) {
      const cached = await ladeEtsySeoCacheFuerListing(user.id, listingId)
      if (cached && cached.fingerprint === fingerprint) {
        const historie = await ladeEtsySeoHistorie(user.id, listingId)
        return NextResponse.json({
          ok: true,
          listing,
          audit: cached.audit,
          fromCache: true,
          auditedAt: cached.auditedAt,
          fingerprint,
          regelReport: regels,
          historie,
        })
      }
    }

    const audit = await auditiereEtsyListing(listing, { hauptbegriff })
    await speichereEtsySeoAudit({
      ownerUserId: user.id,
      listingId,
      fingerprint,
      audit,
      listingTitle: listing.title,
      state: listing.state,
    })
    const historie = await ladeEtsySeoHistorie(user.id, listingId)
    return NextResponse.json({
      ok: true,
      listing,
      audit,
      fromCache: false,
      auditedAt: new Date().toISOString(),
      fingerprint,
      regelReport: regels,
      historie,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Audit fehlgeschlagen'
    console.error('[etsy audit]', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

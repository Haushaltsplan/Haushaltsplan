import { batchAuditiereEtsyShop } from '@/lib/etsy/etsy-seo-batch'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

type Body = { state?: string; limit?: number; force?: boolean }

export async function POST(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 })

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    /* defaults */
  }

  try {
    const { shopId, results } = await batchAuditiereEtsyShop({
      ownerUserId: user.id,
      state: body.state || 'active',
      limit: body.limit ?? 15,
      force: body.force === true,
    })
    return NextResponse.json({ ok: true, shopId, results })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Batch-Audit fehlgeschlagen'
    console.error('[etsy batch-audit]', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

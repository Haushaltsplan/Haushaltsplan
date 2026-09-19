import { ladeEtsyVorlage, speichereEtsyVorlage } from '@/lib/etsy/etsy-vorlage-historie'
import {
  defaultEtsyVorlage,
  type EtsyListingVorlage,
  type EtsyWhenMade,
  type EtsyWhoMade,
} from '@/lib/etsy/etsy-types'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 })

  try {
    const vorlage = await ladeEtsyVorlage(user.id)
    return NextResponse.json({ ok: true, vorlage })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Vorlage laden fehlgeschlagen' },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 })

  let body: Partial<EtsyListingVorlage>
  try {
    body = (await req.json()) as Partial<EtsyListingVorlage>
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body.' }, { status: 400 })
  }

  const base = defaultEtsyVorlage()
  const vorlage: EtsyListingVorlage = {
    shippingProfileId:
      typeof body.shippingProfileId === 'number' ? body.shippingProfileId : base.shippingProfileId,
    readinessStateId:
      typeof body.readinessStateId === 'number' ? body.readinessStateId : base.readinessStateId,
    taxonomyId: typeof body.taxonomyId === 'number' ? body.taxonomyId : base.taxonomyId,
    standortText:
      typeof body.standortText === 'string' && body.standortText.trim()
        ? body.standortText.trim()
        : base.standortText,
    finishText:
      typeof body.finishText === 'string' && body.finishText.trim()
        ? body.finishText.trim()
        : base.finishText,
    whoMade: (body.whoMade as EtsyWhoMade) || base.whoMade,
    whenMade: (body.whenMade as EtsyWhenMade) || base.whenMade,
  }

  try {
    await speichereEtsyVorlage(user.id, vorlage)
    return NextResponse.json({ ok: true, vorlage })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Speichern fehlgeschlagen' },
      { status: 500 },
    )
  }
}

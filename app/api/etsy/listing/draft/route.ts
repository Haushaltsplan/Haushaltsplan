import { legeEtsyDraftAn } from '@/lib/etsy/etsy-listing-create'
import { generiereEtsyListingTexte } from '@/lib/etsy/etsy-listing-generator'
import type { EtsyListingBasis, EtsyWhenMade, EtsyWhoMade } from '@/lib/etsy/etsy-types'
import { COACH_IMAGE_MIME, type CoachImagePart } from '@/lib/finance-coach-images'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

type Body = {
  images?: Array<{ mimeType?: string; base64?: string }>
  holzart?: string
  masse?: string
  preisEur?: number
  quantity?: number
  shippingProfileId?: number
  taxonomyId?: number
  readinessStateId?: number
  whoMade?: string
  whenMade?: string
  materials?: string[]
  dryRun?: boolean
}

function parseImages(raw: Body['images']): CoachImagePart[] {
  if (!Array.isArray(raw)) return []
  const out: CoachImagePart[] = []
  for (const item of raw) {
    const mimeType = String(item?.mimeType || '').toLowerCase()
    const base64 = String(item?.base64 || '').replace(/\s/g, '')
    if (!base64 || !COACH_IMAGE_MIME.has(mimeType)) continue
    if (base64.length > 3_600_000) continue
    out.push({ mimeType, base64 })
    if (out.length >= 8) break
  }
  return out
}

export async function POST(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) {
    return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  }

  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body.' }, { status: 400 })
  }

  const images = parseImages(body.images)
  if (images.length === 0) {
    return NextResponse.json({ error: 'Mindestens ein gültiges Produktfoto (JPEG/PNG/WebP/GIF) nötig.' }, { status: 400 })
  }

  const preisEur = Number(body.preisEur)
  const shippingProfileId = Number(body.shippingProfileId)
  if (!Number.isFinite(preisEur) || preisEur <= 0) {
    return NextResponse.json({ error: 'preisEur muss > 0 sein.' }, { status: 400 })
  }
  if (!Number.isFinite(shippingProfileId) || shippingProfileId <= 0) {
    return NextResponse.json(
      { error: 'shippingProfileId fehlt. Im Shop ein Versandprofil anlegen und hier auswählen.' },
      { status: 400 },
    )
  }

  const basis: EtsyListingBasis = {
    holzart: typeof body.holzart === 'string' ? body.holzart : undefined,
    masse: typeof body.masse === 'string' ? body.masse : undefined,
    preisEur,
    quantity: typeof body.quantity === 'number' ? body.quantity : 1,
    shippingProfileId,
    taxonomyId: typeof body.taxonomyId === 'number' ? body.taxonomyId : undefined,
    readinessStateId: typeof body.readinessStateId === 'number' ? body.readinessStateId : undefined,
    whoMade: (body.whoMade as EtsyWhoMade | undefined) || 'i_did',
    whenMade: (body.whenMade as EtsyWhenMade | undefined) || 'made_to_order',
    materials: Array.isArray(body.materials) ? body.materials.map(String) : undefined,
  }

  try {
    const listing = await generiereEtsyListingTexte(images, basis)

    if (body.dryRun === true) {
      return NextResponse.json({ ok: true, dryRun: true, listing })
    }

    const draft = await legeEtsyDraftAn({
      ownerUserId: user.id,
      basis,
      listing,
      images,
    })

    return NextResponse.json({
      ok: true,
      listing,
      draft,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Draft fehlgeschlagen'
    console.error('[etsy draft]', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

import { generiereEtsyListingTexte } from '@/lib/etsy/etsy-listing-generator'
import { ladeEtsyVorlage } from '@/lib/etsy/etsy-vorlage-historie'
import type { EtsyListingBasis } from '@/lib/etsy/etsy-types'
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
  materials?: string[]
  standortText?: string
  finishText?: string
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

/** Schritt 1: KI-Analyse + Entwurf (kein Etsy-Upload). */
export async function POST(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })

  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 })

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body.' }, { status: 400 })
  }

  const images = parseImages(body.images)
  if (images.length === 0) {
    return NextResponse.json({ error: 'Mindestens ein gültiges Produktfoto nötig.' }, { status: 400 })
  }

  try {
    const vorlage = await ladeEtsyVorlage(user.id)
    const preisRoh = Number(body.preisEur)
    const basis: EtsyListingBasis = {
      holzart: typeof body.holzart === 'string' ? body.holzart : undefined,
      masse: typeof body.masse === 'string' ? body.masse : undefined,
      preisEur: Number.isFinite(preisRoh) && preisRoh > 0 ? preisRoh : undefined,
      materials: Array.isArray(body.materials) ? body.materials.map(String) : undefined,
      standortText:
        typeof body.standortText === 'string' && body.standortText.trim()
          ? body.standortText.trim()
          : vorlage.standortText,
      finishText:
        typeof body.finishText === 'string' && body.finishText.trim()
          ? body.finishText.trim()
          : vorlage.finishText,
      whoMade: vorlage.whoMade,
      whenMade: vorlage.whenMade,
      taxonomyId: vorlage.taxonomyId ?? undefined,
    }

    const listing = await generiereEtsyListingTexte(images, basis)
    return NextResponse.json({ ok: true, listing, vorlage })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Generierung fehlgeschlagen'
    console.error('[etsy generate]', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

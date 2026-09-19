import { legeEtsyDraftAn } from '@/lib/etsy/etsy-listing-create'
import { speichereEtsyDraftHistorie } from '@/lib/etsy/etsy-vorlage-historie'
import type {
  EtsyGeneratedListing,
  EtsyListingBasis,
  EtsyWhenMade,
  EtsyWhoMade,
} from '@/lib/etsy/etsy-types'
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
  /** Freigegebener / nachbearbeiteter Entwurf aus Schritt 1 */
  listing?: Partial<EtsyGeneratedListing> & {
    title?: string
    description?: string
    tags?: string[]
  }
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

function parseFreigabe(raw: Body['listing']): EtsyGeneratedListing | null {
  if (!raw || typeof raw !== 'object') return null
  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  const description = typeof raw.description === 'string' ? raw.description.trim() : ''
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 13)
    : []
  if (!title || !description || tags.length < 1) return null

  const preisMinEur = Number(raw.preisMinEur) || Number(raw.preisEmpfohlenEur) || 0
  const preisEmpfohlenEur = Number(raw.preisEmpfohlenEur) || preisMinEur
  const preisMaxEur = Number(raw.preisMaxEur) || preisEmpfohlenEur
  if (preisEmpfohlenEur < 1) return null

  return {
    title: title.slice(0, 140),
    description,
    tags,
    warenkorbZusammenfassung:
      typeof raw.warenkorbZusammenfassung === 'string' ? raw.warenkorbZusammenfassung : '',
    preisMinEur: Math.round(preisMinEur),
    preisEmpfohlenEur: Math.round(preisEmpfohlenEur),
    preisMaxEur: Math.round(preisMaxEur),
    preisBegruendung: typeof raw.preisBegruendung === 'string' ? raw.preisBegruendung : '',
    produktForm: typeof raw.produktForm === 'string' ? raw.produktForm : 'Schale',
    taxonomyId: Number(raw.taxonomyId) || 2078,
    taxonomyLabel: typeof raw.taxonomyLabel === 'string' ? raw.taxonomyLabel : 'Schalen',
    fotoCheck: raw.fotoCheck ?? {
      hatHauptbild: true,
      hatDetailMaserung: false,
      hatMassstab: false,
      warnungen: [],
    },
  }
}

/** Schritt 2: Freigegebenen Entwurf als Etsy-Draft anlegen (+ Historie). */
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

  const listing = parseFreigabe(body.listing)
  if (!listing) {
    return NextResponse.json(
      { error: 'Freigegebener Entwurf fehlt (title, description, tags, Preis).' },
      { status: 400 },
    )
  }

  const shippingProfileId = Number(body.shippingProfileId)
  if (!Number.isFinite(shippingProfileId) || shippingProfileId <= 0) {
    return NextResponse.json({ error: 'Versandprofil wählen.' }, { status: 400 })
  }

  const preisRoh = Number(body.preisEur)
  const preisEur =
    Number.isFinite(preisRoh) && preisRoh > 0 ? Math.round(preisRoh) : listing.preisEmpfohlenEur

  const basis: EtsyListingBasis = {
    holzart: typeof body.holzart === 'string' ? body.holzart : undefined,
    masse: typeof body.masse === 'string' ? body.masse : undefined,
    preisEur,
    quantity: typeof body.quantity === 'number' ? body.quantity : 1,
    shippingProfileId,
    taxonomyId: typeof body.taxonomyId === 'number' ? body.taxonomyId : listing.taxonomyId,
    readinessStateId: typeof body.readinessStateId === 'number' ? body.readinessStateId : undefined,
    whoMade: (body.whoMade as EtsyWhoMade | undefined) || 'i_did',
    whenMade: (body.whenMade as EtsyWhenMade | undefined) || 'made_to_order',
    materials: Array.isArray(body.materials) ? body.materials.map(String) : undefined,
  }

  try {
    const draft = await legeEtsyDraftAn({
      ownerUserId: user.id,
      basis,
      listing,
      images,
    })

    try {
      await speichereEtsyDraftHistorie({
        ownerUserId: user.id,
        listingId: draft.listingId,
        shopId: draft.shopId,
        listing,
        preisVerwendetEur: preisEur,
        holzart: basis.holzart,
        listingUrl: draft.listingUrl,
      })
    } catch (e) {
      console.warn('[etsy historie]', e instanceof Error ? e.message : e)
    }

    return NextResponse.json({
      ok: true,
      draft,
      verwendeterPreisEur: preisEur,
      listing,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Draft fehlgeschlagen'
    console.error('[etsy draft]', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

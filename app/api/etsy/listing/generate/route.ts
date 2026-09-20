import {
  generiereEtsyListingTexte,
  optimiereEtsyListingTexte,
} from '@/lib/etsy/etsy-listing-generator'
import { berechneEtsyDraftSeoGeoScore } from '@/lib/etsy/etsy-seo-regeln'
import { ladeEtsyVorlage } from '@/lib/etsy/etsy-vorlage-historie'
import type { EtsyListingBasis } from '@/lib/etsy/etsy-types'
import { COACH_IMAGE_MIME, type CoachImagePart } from '@/lib/finance-coach-images'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

type OptimizeBody = {
  title: string
  description: string
  tags: string[]
  produktForm?: string
  taxonomyId?: number
  taxonomyLabel?: string
  warenkorbZusammenfassung?: string
  issues?: string[]
  preisMinEur?: number
  preisEmpfohlenEur?: number
  preisMaxEur?: number
  preisBegruendung?: string
  fotoCheck?: {
    hatHauptbild?: boolean
    hatDetailMaserung?: boolean
    hatMassstab?: boolean
    warnungen?: string[]
  }
}

type Body = {
  images?: Array<{ mimeType?: string; base64?: string }>
  holzart?: string
  masse?: string
  preisEur?: number
  materials?: string[]
  standortText?: string
  finishText?: string
  /** Wenn gesetzt: SEO/GEO-Nachoptimierung statt Frischgenerierung. */
  optimize?: OptimizeBody
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

function scoreFuerListing(listing: {
  title: string
  tags: string[]
  description: string
  taxonomyId: number
  taxonomyLabel: string
  materials?: string[]
  fotoCheck?: { hatHauptbild: boolean; hatDetailMaserung: boolean; hatMassstab: boolean; warnungen?: string[] }
}) {
  return berechneEtsyDraftSeoGeoScore({
    title: listing.title,
    tags: listing.tags,
    description: listing.description,
    materials: listing.materials,
    taxonomyId: listing.taxonomyId,
    taxonomyLabel: listing.taxonomyLabel,
    fotoCheck: listing.fotoCheck ?? null,
  })
}

/** Schritt 1: KI-Analyse + Entwurf (kein Etsy-Upload). Optional: optimize. */
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
    const materials = Array.isArray(body.materials)
      ? body.materials.map(String)
      : body.holzart?.trim()
        ? [body.holzart.trim()]
        : undefined

    const basis: EtsyListingBasis = {
      holzart: typeof body.holzart === 'string' ? body.holzart : undefined,
      masse: typeof body.masse === 'string' ? body.masse : undefined,
      preisEur: Number.isFinite(preisRoh) && preisRoh > 0 ? preisRoh : undefined,
      materials,
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

    const listing =
      body.optimize?.title && body.optimize.description
        ? await optimiereEtsyListingTexte(images, basis, {
            title: String(body.optimize.title),
            description: String(body.optimize.description),
            tags: Array.isArray(body.optimize.tags) ? body.optimize.tags.map(String) : [],
            produktForm: body.optimize.produktForm,
            taxonomyId: body.optimize.taxonomyId,
            taxonomyLabel: body.optimize.taxonomyLabel,
            warenkorbZusammenfassung: body.optimize.warenkorbZusammenfassung,
            issues: Array.isArray(body.optimize.issues)
              ? body.optimize.issues.map(String).slice(0, 20)
              : [],
            preisMinEur: body.optimize.preisMinEur,
            preisEmpfohlenEur: body.optimize.preisEmpfohlenEur,
            preisMaxEur: body.optimize.preisMaxEur,
            preisBegruendung: body.optimize.preisBegruendung,
            fotoCheck: body.optimize.fotoCheck
              ? {
                  hatHauptbild: Boolean(body.optimize.fotoCheck.hatHauptbild),
                  hatDetailMaserung: Boolean(body.optimize.fotoCheck.hatDetailMaserung),
                  hatMassstab: Boolean(body.optimize.fotoCheck.hatMassstab),
                  warnungen: Array.isArray(body.optimize.fotoCheck.warnungen)
                    ? body.optimize.fotoCheck.warnungen.map(String)
                    : [],
                }
              : null,
          })
        : await generiereEtsyListingTexte(images, basis)

    const score = scoreFuerListing({
      ...listing,
      materials: materials ?? (basis.holzart ? [basis.holzart] : undefined),
      fotoCheck: listing.fotoCheck,
    })

    return NextResponse.json({
      ok: true,
      listing,
      vorlage,
      score: {
        overall: score.overall,
        seoScore: score.seoScore,
        geoScore: score.geoScore,
        fotoScore: score.fotoScore,
        einschaetzung: score.einschaetzung,
        limitierer: score.limitierer,
        punkteErreicht: score.punkteErreicht,
        punkteMax: score.punkteMax,
        issues: score.regel.issues,
        geoNotes: score.geoNotes,
      },
      optimized: Boolean(body.optimize),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Generierung fehlgeschlagen'
    console.error('[etsy generate]', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

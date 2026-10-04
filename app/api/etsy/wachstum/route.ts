import { etsyApiUser } from '@/lib/etsy/etsy-api-auth'
import { speichereEtsyEinstellungen } from '@/lib/etsy/etsy-geld-server'
import {
  baueEtsyWachstum,
  contentIdeeAusListing,
  seedSaisonKampagne,
} from '@/lib/etsy/etsy-wachstum-server'
import { ladeEtsyShopListings } from '@/lib/etsy/etsy-listings-server'
import type { EtsyStarSellerCheck } from '@/lib/etsy/etsy-shop-os-types'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 90

export async function GET(req: Request) {
  const auth = await etsyApiUser(req)
  if (auth.error) return auth.error
  try {
    return NextResponse.json({ ok: true, ...(await baueEtsyWachstum(auth.userId, auth.sb)) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Wachstum fehlgeschlagen'
    return NextResponse.json({ error: msg }, { status: /nicht verbunden/i.test(msg) ? 409 : 502 })
  }
}

export async function POST(req: Request) {
  const auth = await etsyApiUser(req)
  if (auth.error) return auth.error
  const body = (await req.json().catch(() => ({}))) as {
    action?: string
    saisonId?: string
    kampagneId?: string
    patch?: Record<string, unknown>
    listingId?: number
    listingTitle?: string
    titel?: string
    tags?: string[]
    variante?: 'A' | 'B'
    receiptId?: number
    kaeuferName?: string
    sterne?: number
    zitat?: string
    starSeller?: EtsyStarSellerCheck
    contentId?: string
    idee?: string
    kanal?: string
  }

  try {
    if (body.action === 'saison_seed' && body.saisonId) {
      const n = await seedSaisonKampagne(auth.userId, body.saisonId, auth.sb)
      return NextResponse.json({ ok: true, anzahl: n })
    }
    if (body.action === 'saison_patch' && body.kampagneId && body.patch) {
      const { error } = await auth.sb
        .from('etsy_saison_kampagne')
        .update({
          tag_geplant: body.patch.tagGeplant,
          gift_foto: body.patch.giftFoto,
          preis_ok: body.patch.preisOk,
          erledigt: body.patch.erledigt,
          notiz: body.patch.notiz,
        })
        .eq('owner_user_id', auth.userId)
        .eq('id', body.kampagneId)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'ab_start' && body.listingId) {
      const { error } = await auth.sb.from('etsy_ab_test').insert({
        owner_user_id: auth.userId,
        listing_id: body.listingId,
        listing_title: (body.listingTitle || '').slice(0, 200),
        variante: body.variante || 'B',
        aktiv: true,
        titel: body.titel ?? null,
        tags: body.tags ?? null,
        notiz: 'Manuell gestartet — nach 14 Tagen mit Statistik vergleichen',
      })
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'ab_ende' && body.kampagneId) {
      const { error } = await auth.sb
        .from('etsy_ab_test')
        .update({ aktiv: false, beendet_at: new Date().toISOString() })
        .eq('owner_user_id', auth.userId)
        .eq('id', body.kampagneId)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'review_fragt' && body.receiptId != null) {
      const { error } = await auth.sb.from('etsy_review_notiz').insert({
        owner_user_id: auth.userId,
        receipt_id: body.receiptId,
        listing_id: body.listingId ?? null,
        kaeufer_name: body.kaeuferName || '',
        angefragt_at: new Date().toISOString(),
      })
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'review_zitat') {
      const { error } = await auth.sb.from('etsy_review_notiz').insert({
        owner_user_id: auth.userId,
        receipt_id: body.receiptId ?? null,
        listing_id: body.listingId ?? null,
        kaeufer_name: body.kaeuferName || '',
        sterne: body.sterne ?? null,
        zitat: (body.zitat || '').slice(0, 500),
        erhalten_at: new Date().toISOString(),
        fuer_listing_nutzen: Boolean(body.zitat),
      })
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'star_seller' && body.starSeller) {
      await speichereEtsyEinstellungen(auth.userId, { starSeller: body.starSeller }, auth.sb)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'content_neu') {
      let idee = body.idee
      let title = body.listingTitle || ''
      if (!idee && body.listingId) {
        const { listings } = await ladeEtsyShopListings(auth.userId, { state: 'active', limit: 100 })
        const l = listings.find((x) => x.listingId === body.listingId)
        title = l?.title || title
        idee = contentIdeeAusListing(title)
      }
      if (!idee) idee = contentIdeeAusListing(title || 'Neue Holzschale')
      const { error } = await auth.sb.from('etsy_content_idee').insert({
        owner_user_id: auth.userId,
        listing_id: body.listingId ?? null,
        listing_title: title.slice(0, 200),
        kanal: body.kanal || 'reel',
        idee: idee.slice(0, 500),
        geplant_fuer: new Date().toISOString().slice(0, 10),
      })
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true, idee })
    }
    if (body.action === 'content_erledigt' && body.contentId) {
      const { error } = await auth.sb
        .from('etsy_content_idee')
        .update({ erledigt: true })
        .eq('owner_user_id', auth.userId)
        .eq('id', body.contentId)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Aktion fehlgeschlagen' }, { status: 502 })
  }
}

import { etsyApiUser } from '@/lib/etsy/etsy-api-auth'
import { baueEtsyKunden } from '@/lib/etsy/etsy-kunden-server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const auth = await etsyApiUser(req)
  if (auth.error) return auth.error
  try {
    return NextResponse.json({ ok: true, ...(await baueEtsyKunden(auth.userId, auth.sb)) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Kunden fehlgeschlagen' }, { status: 502 })
  }
}

export async function POST(req: Request) {
  const auth = await etsyApiUser(req)
  if (auth.error) return auth.error
  const body = (await req.json().catch(() => ({}))) as {
    action?: string
    id?: string
    kaeuferKey?: string
    notiz?: string
    gravur?: {
      receiptId?: number
      listingId?: number
      kaeuferName?: string
      textWunsch?: string
      aufschlagEur?: number
      status?: string
      notiz?: string
    }
    nachricht?: {
      prioritaet?: string
      betreff?: string
      kaeuferName?: string
      notiz?: string
    }
  }

  try {
    if (body.action === 'crm_erledigt' && body.id) {
      const { error } = await auth.sb
        .from('etsy_crm_aufgabe')
        .update({ erledigt: true })
        .eq('owner_user_id', auth.userId)
        .eq('id', body.id)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'kaeufer_notiz' && body.kaeuferKey != null) {
      const { error } = await auth.sb
        .from('etsy_kaeufer')
        .update({ notiz: (body.notiz || '').slice(0, 500), updated_at: new Date().toISOString() })
        .eq('owner_user_id', auth.userId)
        .eq('kaeufer_key', body.kaeuferKey)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'gravur_neu' && body.gravur) {
      const { error } = await auth.sb.from('etsy_gravur_anfrage').insert({
        owner_user_id: auth.userId,
        receipt_id: body.gravur.receiptId ?? null,
        listing_id: body.gravur.listingId ?? null,
        kaeufer_name: body.gravur.kaeuferName || '',
        text_wunsch: (body.gravur.textWunsch || '').slice(0, 200),
        aufschlag_eur: body.gravur.aufschlagEur ?? 15,
        status: body.gravur.status || 'offen',
        notiz: body.gravur.notiz || '',
      })
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'gravur_status' && body.id && body.gravur?.status) {
      const { error } = await auth.sb
        .from('etsy_gravur_anfrage')
        .update({ status: body.gravur.status, updated_at: new Date().toISOString(), notiz: body.gravur.notiz })
        .eq('owner_user_id', auth.userId)
        .eq('id', body.id)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'nachricht_neu' && body.nachricht) {
      const { error } = await auth.sb.from('etsy_nachricht_notiz').insert({
        owner_user_id: auth.userId,
        prioritaet: body.nachricht.prioritaet || 'mittel',
        betreff: (body.nachricht.betreff || '').slice(0, 120),
        kaeufer_name: body.nachricht.kaeuferName || '',
        notiz: (body.nachricht.notiz || '').slice(0, 500),
      })
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'nachricht_erledigt' && body.id) {
      const { error } = await auth.sb
        .from('etsy_nachricht_notiz')
        .update({ erledigt: true })
        .eq('owner_user_id', auth.userId)
        .eq('id', body.id)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Aktion fehlgeschlagen' }, { status: 502 })
  }
}

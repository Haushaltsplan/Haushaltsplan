import { etsyApiUser } from '@/lib/etsy/etsy-api-auth'
import {
  ladeEtsyBestellungen,
  setzeBestellStatus,
  stelleVersandVorlagenSicher,
  syncEtsyBestellungen,
} from '@/lib/etsy/etsy-bestellung-server'
import type { EtsyBestellStatus, EtsyRohholzStatus } from '@/lib/etsy/etsy-shop-os-types'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 90

export async function GET(req: Request) {
  const auth = await etsyApiUser(req)
  if (auth.error) return auth.error
  try {
    await stelleVersandVorlagenSicher(auth.userId, auth.sb)
    const sync = await syncEtsyBestellungen(auth.userId).catch((e) => ({
      anzahl: 0,
      fehler: e instanceof Error ? e.message : 'Sync fehlgeschlagen',
    }))
    const [bestellungen, vorlagenRes, rohRes] = await Promise.all([
      ladeEtsyBestellungen(auth.userId, auth.sb),
      auth.sb.from('etsy_versand_vorlage').select('*').eq('owner_user_id', auth.userId).order('schluessel'),
      auth.sb.from('etsy_rohholz').select('*').eq('owner_user_id', auth.userId).order('created_at', { ascending: false }).limit(40),
    ])
    return NextResponse.json({
      ok: true,
      sync,
      bestellungen,
      vorlagen: (vorlagenRes.data ?? []).map((v) => ({
        id: String(v.id),
        schluessel: String(v.schluessel),
        titel: String(v.titel),
        text: String(v.text),
      })),
      rohholz: (rohRes.data ?? []).map((r) => ({
        id: String(r.id),
        holzart: String(r.holzart),
        beschreibung: String(r.beschreibung || ''),
        status: String(r.status),
        kostenEur: r.kosten_eur != null ? Number(r.kosten_eur) : null,
        gekauftAt: r.gekauft_at != null ? String(r.gekauft_at) : null,
        bereitAt: r.bereit_at != null ? String(r.bereit_at) : null,
        listingId: r.listing_id != null ? Number(r.listing_id) : null,
        notiz: String(r.notiz || ''),
      })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Betrieb fehlgeschlagen'
    return NextResponse.json({ error: msg }, { status: /nicht verbunden/i.test(msg) ? 409 : 502 })
  }
}

export async function POST(req: Request) {
  const auth = await etsyApiUser(req)
  if (auth.error) return auth.error
  const body = (await req.json().catch(() => ({}))) as {
    action?: string
    receiptId?: number
    status?: EtsyBestellStatus
    notiz?: string
    gewichtG?: number | null
    masseText?: string | null
    vorlage?: { id?: string; schluessel?: string; titel?: string; text?: string }
    rohholz?: {
      id?: string
      holzart?: string
      beschreibung?: string
      status?: EtsyRohholzStatus
      kostenEur?: number | null
      gekauftAt?: string | null
      bereitAt?: string | null
      listingId?: number | null
      notiz?: string
    }
  }

  try {
    if (body.action === 'status' && body.receiptId && body.status) {
      await setzeBestellStatus(
        auth.userId,
        body.receiptId,
        body.status,
        { notiz: body.notiz, gewichtG: body.gewichtG, masseText: body.masseText },
        auth.sb,
      )
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'vorlage' && body.vorlage?.schluessel && body.vorlage.titel && body.vorlage.text) {
      const { error } = await auth.sb.from('etsy_versand_vorlage').upsert(
        {
          owner_user_id: auth.userId,
          schluessel: body.vorlage.schluessel.slice(0, 40),
          titel: body.vorlage.titel.slice(0, 80),
          text: body.vorlage.text.slice(0, 2000),
        },
        { onConflict: 'owner_user_id,schluessel' },
      )
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'rohholz_neu' && body.rohholz?.holzart) {
      const { error } = await auth.sb.from('etsy_rohholz').insert({
        owner_user_id: auth.userId,
        holzart: body.rohholz.holzart.slice(0, 60),
        beschreibung: (body.rohholz.beschreibung || '').slice(0, 200),
        status: body.rohholz.status || 'gekauft',
        kosten_eur: body.rohholz.kostenEur ?? null,
        gekauft_at: body.rohholz.gekauftAt ?? new Date().toISOString().slice(0, 10),
        notiz: body.rohholz.notiz || '',
      })
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'rohholz_status' && body.rohholz?.id && body.rohholz.status) {
      const { error } = await auth.sb
        .from('etsy_rohholz')
        .update({
          status: body.rohholz.status,
          bereit_at: body.rohholz.status === 'bereit' ? new Date().toISOString().slice(0, 10) : body.rohholz.bereitAt,
          listing_id: body.rohholz.listingId,
          notiz: body.rohholz.notiz,
          updated_at: new Date().toISOString(),
        })
        .eq('owner_user_id', auth.userId)
        .eq('id', body.rohholz.id)
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'sync') {
      const sync = await syncEtsyBestellungen(auth.userId)
      return NextResponse.json({ ok: true, sync })
    }
    return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Aktion fehlgeschlagen' }, { status: 502 })
  }
}

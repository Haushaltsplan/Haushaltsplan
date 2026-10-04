import { etsyApiUser } from '@/lib/etsy/etsy-api-auth'
import {
  baueEtsyGeld,
  speichereEtsyEinstellungen,
  speichereKostenVorlage,
  speichereProduktKosten,
} from '@/lib/etsy/etsy-geld-server'
import type { EtsyKostenZeile, EtsyShopEinstellungen } from '@/lib/etsy/etsy-shop-os-types'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const auth = await etsyApiUser(req)
  if (auth.error) return auth.error
  try {
    return NextResponse.json({ ok: true, ...(await baueEtsyGeld(auth.userId, auth.sb)) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Geld-Modul fehlgeschlagen'
    return NextResponse.json({ error: msg }, { status: /nicht verbunden/i.test(msg) ? 409 : 502 })
  }
}

export async function POST(req: Request) {
  const auth = await etsyApiUser(req)
  if (auth.error) return auth.error
  const body = (await req.json().catch(() => ({}))) as {
    action?: string
    listingId?: number
    listingTitle?: string
    kosten?: EtsyKostenZeile & { holzart?: string | null; notiz?: string }
    vorlageName?: string
    einstellungen?: Partial<EtsyShopEinstellungen>
  }

  try {
    if (body.action === 'einstellungen' && body.einstellungen) {
      const e = await speichereEtsyEinstellungen(auth.userId, body.einstellungen, auth.sb)
      return NextResponse.json({ ok: true, einstellungen: e })
    }
    if (body.action === 'kosten' && body.listingId && body.kosten) {
      await speichereProduktKosten(
        auth.userId,
        body.listingId,
        body.listingTitle || '',
        body.kosten,
        auth.sb,
      )
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'vorlage' && body.vorlageName && body.kosten) {
      await speichereKostenVorlage(auth.userId, body.vorlageName, body.kosten, auth.sb)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Speichern fehlgeschlagen' }, { status: 502 })
  }
}

import { etsyApiUser } from '@/lib/etsy/etsy-api-auth'
import { speichereEtsyEinstellungen } from '@/lib/etsy/etsy-geld-server'
import { baueEtsyStrategie } from '@/lib/etsy/etsy-strategie-server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 90

export async function GET(req: Request) {
  const auth = await etsyApiUser(req)
  if (auth.error) return auth.error
  try {
    return NextResponse.json({ ok: true, ...(await baueEtsyStrategie(auth.userId, auth.sb)) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Strategie fehlgeschlagen'
    return NextResponse.json({ error: msg }, { status: /nicht verbunden/i.test(msg) ? 409 : 502 })
  }
}

export async function POST(req: Request) {
  const auth = await etsyApiUser(req)
  if (auth.error) return auth.error
  const body = (await req.json().catch(() => ({}))) as {
    action?: string
    kapazitaetProWoche?: number
  }
  try {
    if (body.action === 'kapazitaet' && body.kapazitaetProWoche != null) {
      await speichereEtsyEinstellungen(
        auth.userId,
        { kapazitaetProWoche: Math.max(1, Math.min(40, Number(body.kapazitaetProWoche) || 4)) },
        auth.sb,
      )
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Aktion fehlgeschlagen' }, { status: 502 })
  }
}

import { etsyApiUser } from '@/lib/etsy/etsy-api-auth'
import { baueEtsyZahlen } from '@/lib/etsy/etsy-zahlen-server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const auth = await etsyApiUser(req)
  if (auth.error) return auth.error
  try {
    return NextResponse.json({ ok: true, ...(await baueEtsyZahlen(auth.userId, auth.sb)) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Zahlen fehlgeschlagen'
    return NextResponse.json({ error: msg }, { status: /nicht verbunden/i.test(msg) ? 409 : 502 })
  }
}

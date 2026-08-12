/**
 * Führung Cloud-Sync: GET laden / POST speichern.
 * Auth über Proxy-Middleware (Bearer via installApiAuth).
 */
import { NextResponse } from 'next/server'
import {
  ladeFuehrungStateAusCloud,
  speichereFuehrungStateInCloud,
} from '@/lib/fuehrung/fuehrung-sync-server'
import type { FuehrungState } from '@/lib/fuehrung/store'
import { ownerUserIdAusRequest } from '@/lib/supabase-user'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const ownerUserId = ownerUserIdAusRequest(req)
  if (!ownerUserId) {
    return NextResponse.json({ ok: false, fehler: 'Nicht angemeldet.' }, { status: 401 })
  }

  const stand = await ladeFuehrungStateAusCloud(ownerUserId)
  if (!stand) {
    return NextResponse.json({ ok: true, vorhanden: false, payload: null, aktualisiertAm: null })
  }
  return NextResponse.json({
    ok: true,
    vorhanden: true,
    payload: stand.payload,
    aktualisiertAm: stand.aktualisiertAm,
  })
}

export async function POST(req: Request) {
  const ownerUserId = ownerUserIdAusRequest(req)
  if (!ownerUserId) {
    return NextResponse.json({ ok: false, fehler: 'Nicht angemeldet.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const roh = body as { payload?: unknown; aktualisiertAm?: unknown }
  if (!roh.payload || typeof roh.payload !== 'object') {
    return NextResponse.json({ ok: false, fehler: 'payload fehlt.' }, { status: 400 })
  }

  const aktualisiertAm =
    typeof roh.aktualisiertAm === 'string' && roh.aktualisiertAm.trim()
      ? roh.aktualisiertAm.trim()
      : new Date().toISOString()

  const result = await speichereFuehrungStateInCloud(
    ownerUserId,
    roh.payload as FuehrungState,
    aktualisiertAm,
  )
  if (!result.ok) {
    return NextResponse.json({ ok: false, fehler: result.fehler }, { status: 502 })
  }
  return NextResponse.json({ ok: true, aktualisiertAm })
}

/**
 * Geräte-State: GET laden / POST speichern.
 * Auth über Proxy-Middleware (Bearer via installApiAuth).
 */
import { NextResponse } from 'next/server'
import {
  ladeClientStateAusCloud,
  speichereClientStateInCloud,
} from '@/lib/client-state/client-state-server'
import type { ClientStateEintrag } from '@/lib/client-state/client-state-keys'
import { ownerUserIdAusRequest } from '@/lib/supabase-user'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function parseEintraege(body: unknown): ClientStateEintrag[] | null {
  if (!body || typeof body !== 'object') return null
  const roh = body as { eintraege?: unknown; schluessel?: unknown; payload?: unknown; aktualisiertAm?: unknown }
  if (Array.isArray(roh.eintraege)) {
    const out: ClientStateEintrag[] = []
    for (const row of roh.eintraege) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const schluessel = typeof r.schluessel === 'string' ? r.schluessel.trim() : ''
      if (!schluessel) continue
      out.push({
        schluessel,
        payload: r.payload ?? {},
        aktualisiertAm:
          typeof r.aktualisiertAm === 'string' && r.aktualisiertAm.trim()
            ? r.aktualisiertAm.trim()
            : new Date().toISOString(),
      })
    }
    return out
  }
  if (typeof roh.schluessel === 'string' && roh.schluessel.trim()) {
    return [
      {
        schluessel: roh.schluessel.trim(),
        payload: roh.payload ?? {},
        aktualisiertAm:
          typeof roh.aktualisiertAm === 'string' && roh.aktualisiertAm.trim()
            ? roh.aktualisiertAm.trim()
            : new Date().toISOString(),
      },
    ]
  }
  return null
}

export async function GET(req: Request) {
  const ownerUserId = ownerUserIdAusRequest(req)
  if (!ownerUserId) {
    return NextResponse.json({ ok: false, fehler: 'Nicht angemeldet.' }, { status: 401 })
  }
  const eintraege = await ladeClientStateAusCloud(ownerUserId)
  return NextResponse.json({ ok: true, eintraege })
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

  const eintraege = parseEintraege(body)
  if (!eintraege || eintraege.length === 0) {
    return NextResponse.json({ ok: false, fehler: 'schluessel/payload fehlt.' }, { status: 400 })
  }

  const result = await speichereClientStateInCloud(ownerUserId, eintraege)
  if (!result.ok) {
    return NextResponse.json({ ok: false, fehler: result.fehler }, { status: 502 })
  }
  return NextResponse.json({ ok: true, uebersprungen: result.uebersprungen ?? 0 })
}

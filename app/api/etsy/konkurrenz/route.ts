import { aktualisiereEtsyKonkurrenz, ladeEtsyKonkurrenz } from '@/lib/etsy/etsy-konkurrenz-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

async function nutzer(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return null
  const {
    data: { user },
  } = await sb.auth.getUser()
  return user?.id ? { sb, userId: user.id } : null
}

export async function GET(req: Request) {
  const n = await nutzer(req)
  if (!n) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const tage = Math.max(7, Math.min(365, Number(new URL(req.url).searchParams.get('tage')) || 90))
  try {
    return NextResponse.json({ ok: true, ...(await ladeEtsyKonkurrenz(n.sb, tage)) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Laden fehlgeschlagen' }, { status: 502 })
  }
}

/** Sofort-Snapshot (sonst täglich per Cron). Body `{ neuEntdecken?: boolean }`. */
export async function POST(req: Request) {
  const n = await nutzer(req)
  if (!n) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { neuEntdecken?: boolean }
  try {
    const lauf = await aktualisiereEtsyKonkurrenz(n.userId, { neuEntdecken: body.neuEntdecken === true })
    if (lauf.fehler) return NextResponse.json({ error: lauf.fehler, lauf }, { status: 502 })
    return NextResponse.json({ ok: true, lauf })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Aktualisieren fehlgeschlagen' }, { status: 502 })
  }
}

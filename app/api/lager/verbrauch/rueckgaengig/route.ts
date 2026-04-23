import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

function mapRpcError(msg: string): string {
  const m = msg.toUpperCase()
  if (m.includes('VERBRAUCH_NICHT_GEFUNDEN')) return 'Diese Ausbuchung existiert nicht (mehr).'
  return msg.length > 200 ? `${msg.slice(0, 200)}…` : msg
}

export async function POST(req: Request) {
  let admin: ReturnType<typeof createSupabaseAdmin>
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json(
      {
        error:
          'SUPABASE_SERVICE_ROLE_KEY fehlt in .env.local — Stornieren nur serverseitig mit Service Role.',
      },
      { status: 501 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const verbrauchId = typeof body.verbrauch_id === 'string' ? body.verbrauch_id.trim() : ''
  if (!verbrauchId) {
    return NextResponse.json({ error: 'verbrauch_id fehlt.' }, { status: 400 })
  }

  try {
    const { error } = await admin.rpc('lager_verbrauch_rueckgaengig', { p_verbrauch_id: verbrauchId })
    if (error) {
      console.error('lager/verbrauch/rueckgaengig rpc', error)
      return NextResponse.json({ error: mapRpcError(error.message) }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('lager/verbrauch/rueckgaengig', e)
    const msg = e instanceof Error ? e.message : 'Serverfehler'
    return NextResponse.json({ error: mapRpcError(msg) }, { status: 500 })
  }
}

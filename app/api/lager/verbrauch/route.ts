import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  let admin: ReturnType<typeof createSupabaseAdmin>
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json(
      {
        error:
          'SUPABASE_SERVICE_ROLE_KEY fehlt in .env.local — Buchung nur serverseitig mit Service Role.',
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

  const produktId = typeof body.produkt_id === 'string' ? body.produkt_id.trim() : ''
  const menge = Number(body.menge)
  const notiz = typeof body.notiz === 'string' ? body.notiz.trim().slice(0, 500) : null

  if (!produktId) {
    return NextResponse.json({ error: 'produkt_id fehlt.' }, { status: 400 })
  }
  if (!Number.isFinite(menge) || menge <= 0) {
    return NextResponse.json({ error: 'Menge muss eine positive Zahl sein.' }, { status: 400 })
  }

  try {
    const { data: lb, error: lbQ } = await admin
      .from('lagerbestand')
      .select('aktuelle_menge')
      .eq('produkt_id', produktId)
      .maybeSingle()

    if (lbQ) throw new Error(lbQ.message)

    const aktuell = Number(lb?.aktuelle_menge) || 0
    const neu = Math.round((aktuell - menge) * 1000) / 1000
    if (neu < 0) {
      return NextResponse.json(
        { error: `Nicht genug Bestand (aktuell ${aktuell}, Abgang ${menge}).` },
        { status: 400 },
      )
    }

    const { error: uErr } = await admin.from('lagerbestand').upsert(
      { produkt_id: produktId, aktuelle_menge: neu },
      { onConflict: 'produkt_id' },
    )
    if (uErr) throw new Error(uErr.message)

    const { error: vErr } = await admin.from('lager_verbrauch').insert({
      produkt_id: produktId,
      menge,
      notiz: notiz || null,
    })
    if (vErr) throw new Error(vErr.message)

    return NextResponse.json({ ok: true, neue_menge: neu })
  } catch (e) {
    console.error('lager/verbrauch', e)
    const msg = e instanceof Error ? e.message : 'Serverfehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

/** Setzt alle `lagerbestand.aktuelle_menge` auf 0 (Artikel & Einkaufshistorie bleiben). */
export async function POST() {
  let admin: ReturnType<typeof createSupabaseAdmin>
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json(
      {
        error:
          'SUPABASE_SERVICE_ROLE_KEY fehlt in .env.local — Leeren nur serverseitig mit Service Role.',
      },
      { status: 501 },
    )
  }

  try {
    const { data: rows, error: qErr } = await admin.from('lagerbestand').select('produkt_id')
    if (qErr) throw new Error(qErr.message)

    let aktualisiert = 0
    for (const r of rows || []) {
      const pid = (r as { produkt_id: string }).produkt_id
      const { error: uErr } = await admin.from('lagerbestand').update({ aktuelle_menge: 0 }).eq('produkt_id', pid)
      if (uErr) throw new Error(uErr.message)
      aktualisiert++
    }

    return NextResponse.json({ ok: true, aktualisiert })
  } catch (e) {
    console.error('lager/bestand/alle-nullen', e)
    const msg = e instanceof Error ? e.message : 'Serverfehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

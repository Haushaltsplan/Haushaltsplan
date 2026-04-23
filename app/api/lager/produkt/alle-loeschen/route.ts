import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

const CHUNK = 150

/** Löscht alle Zeilen in `produkte` (CASCADE: Bestand, Einkäufe, Verbrauch). */
export async function POST() {
  let admin: ReturnType<typeof createSupabaseAdmin>
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json(
      {
        error:
          'SUPABASE_SERVICE_ROLE_KEY fehlt in .env.local — Massen-Löschen nur serverseitig mit Service Role.',
      },
      { status: 501 },
    )
  }

  try {
    const { data: rows, error: qErr } = await admin.from('produkte').select('id')
    if (qErr) throw new Error(qErr.message)
    const ids = (rows || []).map((r) => String((r as { id: string }).id)).filter(Boolean)
    if (ids.length === 0) {
      return NextResponse.json({ ok: true, geloescht: 0 })
    }

    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK)
      const { error: dErr } = await admin.from('produkte').delete().in('id', slice)
      if (dErr) throw new Error(dErr.message)
    }

    return NextResponse.json({ ok: true, geloescht: ids.length })
  } catch (e) {
    console.error('lager/produkt/alle-loeschen', e)
    const msg = e instanceof Error ? e.message : 'Serverfehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

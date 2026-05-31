import { NextResponse } from 'next/server'
import { gruppiereProduktIdsFuerLagerDuplikate, mergeProduktDuplikateFuerSchluessel } from '@/lib/merge-produkt-duplikate'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'

export const runtime = 'nodejs'

/** Führt Gruppen mit gleicher Namens-Normalform oder gleichem Lager-Sammel-Schlüssel zusammen (kürzester Name / UUID bleibt). */
export async function POST(req: Request) {
  const admin = createSupabaseFuerRequest(req)
  if (!admin) {
    return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  }

  try {
    const { data: rows, error } = await admin.from('produkte').select('id, name')
    if (error) throw new Error(error.message)
    const gruppen = gruppiereProduktIdsFuerLagerDuplikate((rows || []) as { id: string; name: string }[])
    let entfernt = 0
    for (const [, ids] of gruppen) {
      if (ids.length < 2) continue
      const r = await mergeProduktDuplikateFuerSchluessel(admin, ids)
      entfernt += r.entfernt
    }
    return NextResponse.json({ ok: true, entfernteDuplikate: entfernt })
  } catch (e) {
    console.error('lager/produkt/merge-duplicates', e)
    const msg = e instanceof Error ? e.message : 'Serverfehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

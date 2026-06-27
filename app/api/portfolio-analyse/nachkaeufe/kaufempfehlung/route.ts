import { NextResponse } from 'next/server'
import 'server-only'

import { ladeNachkaufScanAusCloud } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-db-server'
import { ergaenzeKaufhistorieUndNotizen } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-db-server'
import { berechneTrimSignale } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-trim-signal'
import { generiereKaufempfehlung } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-kaufempfehlung-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const maxDuration = 120

export async function POST() {
  try {
    // 1. Scan-Ergebnisse laden und anreichern
    let ergebnisse = await ladeNachkaufScanAusCloud()
    if (ergebnisse.length === 0) {
      return NextResponse.json(
        { ok: false, fehler: 'Keine Scan-Ergebnisse vorhanden. Bitte zuerst den monatlichen Scan ausführen.' },
        { status: 400 },
      )
    }

    await ergaenzeKaufhistorieUndNotizen(ergebnisse)
    ergebnisse = berechneTrimSignale(ergebnisse)

    // 2. Kaufempfehlung generieren
    const ergebnis = await generiereKaufempfehlung(ergebnisse)

    // 3. In Supabase speichern
    try {
      const monat = new Date().toISOString().slice(0, 7)
      const supabase = createSupabaseAdmin()
      await supabase
        .from('nachkauf_kaufempfehlung')
        .upsert(
          {
            monat,
            kandidaten: ergebnis.basisAllokation.map((p) => p.ticker),
            basis_allokation: ergebnis.basisAllokation,
            ki_text: ergebnis.kiEmpfehlungText,
          },
          { onConflict: 'owner_user_id,monat' },
        )
    } catch (dbErr) {
      console.warn('[kaufempfehlung] Speichern fehlgeschlagen:', dbErr)
      // kein Hard-Fail — Ergebnis trotzdem zurückgeben
    }

    return NextResponse.json(ergebnis)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[kaufempfehlung] Fehler:', msg)
    return NextResponse.json({ ok: false, fehler: msg }, { status: 500 })
  }
}

// Lade gespeicherte Empfehlung für aktuellen Monat
export async function GET() {
  try {
    const monat = new Date().toISOString().slice(0, 7)
    const supabase = createSupabaseAdmin()
    const { data, error } = await supabase
      .from('nachkauf_kaufempfehlung')
      .select('*')
      .eq('monat', monat)
      .maybeSingle()

    if (error || !data) return NextResponse.json({ ok: false, daten: null })
    return NextResponse.json({ ok: true, daten: data })
  } catch (e) {
    return NextResponse.json({ ok: false, daten: null })
  }
}

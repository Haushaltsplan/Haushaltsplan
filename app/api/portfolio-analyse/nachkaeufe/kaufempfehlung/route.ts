import { NextResponse } from 'next/server'
import 'server-only'

import {
  ladeNachkaufScanAusCloud,
  ladeAlleDeepResearch,
  speichereNachkaufScanEintraege,
} from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-db-server'
import { reichereNachkaufEintraegeVoll } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-kontext-server'
import { generiereKaufempfehlung } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-kaufempfehlung-server'
import { speichereEmpfehlungTracking } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-performance-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const maxDuration = 120

export async function POST(req: Request) {
  try {
    let budgetEur = 500
    try {
      const body = await req.json()
      if (typeof body.budget === 'number' && body.budget >= 100) budgetEur = body.budget
    } catch { /* Standardwert */ }

    let ergebnisse = await ladeNachkaufScanAusCloud()
    if (ergebnisse.length === 0) {
      return NextResponse.json(
        { ok: false, fehler: 'Keine Scan-Ergebnisse vorhanden. Bitte zuerst den monatlichen Scan ausführen.' },
        { status: 400 },
      )
    }

    const deepMap = await ladeAlleDeepResearch()
    for (const e of ergebnisse) {
      const dr = deepMap.get(e.ticker.toUpperCase())
      if (dr) e.tiefenAnalyse = dr
    }

    // Volle Projekt-Anreicherung: Depot (Dashboard), Historie, Notizen, Insider, Ranking
    await reichereNachkaufEintraegeVoll(ergebnisse)
    await speichereNachkaufScanEintraege(ergebnisse)

    const ergebnis = await generiereKaufempfehlung(ergebnisse, budgetEur)

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
            verkauf_allokation: ergebnis.basisVerkaufAllokation,
            ki_text: ergebnis.kiEmpfehlungText,
          },
          { onConflict: 'owner_user_id,monat' },
        )

      const scanMap = new Map(ergebnisse.map((e) => [e.ticker.toUpperCase(), e]))
      await speichereEmpfehlungTracking({
        monat,
        basisAllokation: ergebnis.basisAllokation,
        scanMap,
      })
    } catch (dbErr) {
      console.warn('[kaufempfehlung] Speichern fehlgeschlagen:', dbErr)
    }

    return NextResponse.json(ergebnis)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[kaufempfehlung] Fehler:', msg)
    return NextResponse.json({ ok: false, fehler: msg }, { status: 500 })
  }
}

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

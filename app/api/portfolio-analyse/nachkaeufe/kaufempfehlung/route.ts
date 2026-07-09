import { NextResponse } from 'next/server'
import 'server-only'

import {
  ladeNachkaufScanAusCloud,
  ladeAlleDeepResearch,
  speichereNachkaufScanEintraege,
} from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-db-server'
import { reichereNachkaufEintraegeVoll } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-kontext-server'
import { generiereKaufempfehlung } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-kaufempfehlung-server'
import {
  speichereEmpfehlungTracking,
  ladePortfolioOwnerUserId,
} from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-performance-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { ownerUserIdAusRequest } from '@/lib/supabase-user'

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

    let trackingGespeichert = 0
    let trackingFehler: string | undefined

    try {
      const monat = new Date().toISOString().slice(0, 7)
      const ownerUserId =
        ownerUserIdAusRequest(req) ?? (await ladePortfolioOwnerUserId())
      if (!ownerUserId) {
        trackingFehler = 'Nutzer-ID nicht ermittelbar — Tracking übersprungen'
        console.warn('[kaufempfehlung]', trackingFehler)
      } else {
        const supabase = createSupabaseAdmin()
        const { error: empError } = await supabase
          .from('nachkauf_kaufempfehlung')
          .upsert(
            {
              owner_user_id: ownerUserId,
              monat,
              kandidaten: ergebnis.basisAllokation.map((p) => p.ticker),
              basis_allokation: ergebnis.basisAllokation,
              verkauf_allokation: ergebnis.basisVerkaufAllokation,
              ki_text: ergebnis.kiEmpfehlungText,
            },
            { onConflict: 'owner_user_id,monat' },
          )
        if (empError) {
          trackingFehler = `Kaufempfehlung speichern: ${empError.message}`
          console.warn('[kaufempfehlung]', trackingFehler)
        }

        if (ergebnis.basisAllokation.length > 0) {
          const scanMap = new Map(ergebnisse.map((e) => [e.ticker.toUpperCase(), e]))
          const tracking = await speichereEmpfehlungTracking({
            monat,
            basisAllokation: ergebnis.basisAllokation,
            scanMap,
            ownerUserId,
            empfohlenAm: ergebnis.erstellt_am,
          })
          trackingGespeichert = tracking.gespeichert
          if (tracking.fehler) trackingFehler = tracking.fehler
        }
      }
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr)
      trackingFehler = msg
      console.warn('[kaufempfehlung] Speichern fehlgeschlagen:', msg)
    }

    return NextResponse.json({ ...ergebnis, trackingGespeichert, trackingFehler })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[kaufempfehlung] Fehler:', msg)
    return NextResponse.json({ ok: false, fehler: msg }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const monat = new Date().toISOString().slice(0, 7)
    const ownerUserId = req.headers.get('x-user-id')?.trim() || null
    const supabase = createSupabaseAdmin()
    let query = supabase.from('nachkauf_kaufempfehlung').select('*').eq('monat', monat)
    if (ownerUserId) query = query.eq('owner_user_id', ownerUserId)
    const { data, error } = await query.maybeSingle()

    if (error || !data) return NextResponse.json({ ok: false, daten: null })
    return NextResponse.json({ ok: true, daten: data })
  } catch (e) {
    return NextResponse.json({ ok: false, daten: null })
  }
}

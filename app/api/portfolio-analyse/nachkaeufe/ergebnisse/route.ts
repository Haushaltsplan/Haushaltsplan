import { NextResponse } from 'next/server'
import { jsonMitOwner } from '@/lib/request-owner'
import {
  ergaenzeDepotGewichte,
  ladeAlleDeepResearch,
  ladeNachkaufScanAusCloud,
  ladeNachkaufScanDatum,
} from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-db-server'
import { berechneMonatsEmpfehlung } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-score'
import type { NachkaufErgebnissePaket } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-types'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: Request) {
  return jsonMitOwner(req, async () => {
    try {
      const [ergebnisse, deepMap, gescannt_am] = await Promise.all([
        ladeNachkaufScanAusCloud(),
        ladeAlleDeepResearch(),
        ladeNachkaufScanDatum(),
      ])

      const sichtbar = ergebnisse.map((e) => ({
        ...e,
        tiefenAnalyse: deepMap.get(e.ticker.toUpperCase()) ?? null,
      }))

      // Nur Depot-Gewichte, und auch die dürfen die Antwort nicht verschlucken.
      await Promise.race([
        ergaenzeDepotGewichte(sichtbar),
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ])

      let monatsEmpfehlung = null
      try {
        monatsEmpfehlung = sichtbar.length > 0 ? berechneMonatsEmpfehlung(sichtbar) : null
      } catch (e) {
        console.warn('[api/nachkaeufe/ergebnisse] Monatsempfehlung übersprungen:', e)
      }

      const paket: NachkaufErgebnissePaket = {
        ok: true,
        ergebnisse: sichtbar,
        gescannt_am: gescannt_am ?? sichtbar[0]?.gescannt_am ?? null,
        monatsEmpfehlung,
        gesamtAnzahl: sichtbar.length,
        ausstehend: 0,
      }

      return NextResponse.json(paket)
    } catch (e) {
      console.error('[api/nachkaeufe/ergebnisse]', e)
      return NextResponse.json(
        { ok: false, ergebnisse: [], gescannt_am: null, monatsEmpfehlung: null },
        { status: 502 },
      )
    }
  })
}

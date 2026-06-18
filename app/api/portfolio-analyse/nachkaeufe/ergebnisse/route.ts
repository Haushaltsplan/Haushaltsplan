import { NextResponse } from 'next/server'
import {
  ergaenzeDepotGewichte,
  ladeAlleDeepResearch,
  ladeNachkaufScanAusCloud,
  ladeNachkaufScanDatum,
} from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-db-server'
import { berechneMonatsEmpfehlung } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-score'
import { NACHKAUF_RADAR_WHITELIST } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import type { NachkaufErgebnissePaket } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-types'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  try {
    const [ergebnisse, deepMap, gescannt_am] = await Promise.all([
      ladeNachkaufScanAusCloud(),
      ladeAlleDeepResearch(),
      ladeNachkaufScanDatum(),
    ])

    const mitDeep = ergebnisse.map((e) => ({
      ...e,
      tiefenAnalyse: deepMap.get(e.ticker.toUpperCase()) ?? null,
    }))
    await ergaenzeDepotGewichte(mitDeep)

    const gesamtAnzahl = NACHKAUF_RADAR_WHITELIST.length
    const ausstehend = Math.max(0, gesamtAnzahl - mitDeep.length)

    const paket: NachkaufErgebnissePaket = {
      ok: true,
      ergebnisse: mitDeep,
      gescannt_am: gescannt_am ?? null,
      monatsEmpfehlung: mitDeep.length > 0 ? berechneMonatsEmpfehlung(mitDeep) : null,
      gesamtAnzahl,
      ausstehend,
    }

    return NextResponse.json(paket)
  } catch (e) {
    console.error('[api/nachkaeufe/ergebnisse]', e)
    return NextResponse.json(
      { ok: false, ergebnisse: [], gescannt_am: null, monatsEmpfehlung: null },
      { status: 502 },
    )
  }
}

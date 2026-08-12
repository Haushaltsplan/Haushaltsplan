import { NextResponse } from 'next/server'
import {
  ergaenzeDepotGewichte,
  ergaenzeKaufhistorieUndNotizen,
  ladeAlleDeepResearch,
  ladeNachkaufScanAusCloud,
  ladeNachkaufScanDatum,
} from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-db-server'
import { berechneMonatsEmpfehlung } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-score'
import { reichereNachkaufEintraegeVoll } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-kontext-server'
import { ladeNachkaufKandidaten } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-watchlist-cloud-server'
import type { NachkaufErgebnissePaket } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-types'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  try {
    const [ergebnisse, deepMap, gescannt_am, kandidaten] = await Promise.all([
      ladeNachkaufScanAusCloud(),
      ladeAlleDeepResearch(),
      ladeNachkaufScanDatum(),
      ladeNachkaufKandidaten(),
    ])

    const mitDeep = ergebnisse.map((e) => ({
      ...e,
      tiefenAnalyse: deepMap.get(e.ticker.toUpperCase()) ?? null,
    }))

    try {
      await reichereNachkaufEintraegeVoll(mitDeep)
    } catch (e) {
      console.warn('[api/nachkaeufe/ergebnisse] Anreicherung fehlgeschlagen — Roh-Scan wird trotzdem geliefert:', e)
    }

    const gesamtAnzahl = kandidaten.length
    const gespeicherteIsins = new Set(
      mitDeep.map((e) => e.isin?.trim().toUpperCase()).filter(Boolean),
    )
    const gespeicherteTicker = new Set(mitDeep.map((e) => e.ticker.trim().toUpperCase()))
    const ausstehend = kandidaten.filter((p) => {
      const isin = p.isin.toUpperCase()
      if (gespeicherteIsins.has(isin)) return false
      const k = p.symbolYahoo?.replace(/\.[^.]+$/, '')?.toUpperCase()
      if (k && gespeicherteTicker.has(k)) return false
      return true
    }).length

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

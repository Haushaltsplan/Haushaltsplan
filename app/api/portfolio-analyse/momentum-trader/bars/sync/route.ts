/**
 * OHLCV-Bars von Yahoo laden und in Supabase speichern.
 * POST /api/portfolio-analyse/momentum-trader/bars/sync
 * Body: { symbols?: string[]; tage?: number; test?: boolean }
 */
import { NextResponse } from 'next/server'
import { heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { speichereMomentumBars } from '@/lib/portfolio-analyse/momentum-trader/momentum-db-server'
import {
  ladeMomentumUniversumSymbole,
  MOMENTUM_TEST_SYMBOLE,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-universe'
import { ladeYahooOhlcvBatch } from '@/lib/portfolio-analyse/momentum-trader/yahoo-ohlcv-server'
import type { MomentumBarsSyncErgebnis } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function addDaysIso(iso: string, tage: number): string {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + tage)
  return d.toISOString().slice(0, 10)
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {}
  try {
    body = ((await req.json()) ?? {}) as Record<string, unknown>
  } catch {
    // leerer Body ist ok
  }

  const testModus = body.test === true
  const tage = typeof body.tage === 'number' && body.tage > 0 ? Math.min(body.tage, 400) : 252
  const bisDatum = heuteIsoUtc()
  const vonDatum = addDaysIso(bisDatum, -tage)

  let symbole: string[]
  if (Array.isArray(body.symbols) && body.symbols.length > 0) {
    symbole = body.symbols.map((s) => String(s).trim().toUpperCase()).filter(Boolean)
  } else if (testModus) {
    symbole = [...MOMENTUM_TEST_SYMBOLE]
  } else {
    try {
      symbole = await ladeMomentumUniversumSymbole()
    } catch (e) {
      return NextResponse.json(
        {
          ok: false,
          symbole: 0,
          kerzenGeschrieben: 0,
          vonDatum,
          bisDatum,
          fehler: 'Universum laden fehlgeschlagen: ' + String(e),
        } satisfies MomentumBarsSyncErgebnis,
        { status: 500 },
      )
    }
  }

  try {
    const batch = await ladeYahooOhlcvBatch(symbole, vonDatum, bisDatum)
    const alleBars = [...batch.values()].flat()
    const geschrieben = await speichereMomentumBars(alleBars)

    const ergebnis: MomentumBarsSyncErgebnis = {
      ok: true,
      symbole: batch.size,
      kerzenGeschrieben: geschrieben,
      vonDatum,
      bisDatum,
      fehler: batch.size < symbole.length
        ? 'Nur ' + batch.size + ' von ' + symbole.length + ' Symbolen mit Daten.'
        : null,
    }
    return NextResponse.json(ergebnis)
  } catch (e) {
    console.error('[api/momentum-trader/bars/sync]', e)
    return NextResponse.json(
      {
        ok: false,
        symbole: symbole.length,
        kerzenGeschrieben: 0,
        vonDatum,
        bisDatum,
        fehler: String(e),
      } satisfies MomentumBarsSyncErgebnis,
      { status: 500 },
    )
  }
}

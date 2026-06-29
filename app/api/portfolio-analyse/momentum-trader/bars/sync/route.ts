/**
 * OHLCV-Bars für Watchlist + Regime-Indizes (kein S&P-500-Vollsync).
 * POST /api/portfolio-analyse/momentum-trader/bars/sync
 * Body: { tage?: number }
 */
import { NextResponse } from 'next/server'
import { heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { syncSymboleFuerWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-sync-server'
import { speichereMomentumBars } from '@/lib/portfolio-analyse/momentum-trader/momentum-db-server'
import { MOMENTUM_REGIME_SYMBOLS } from '@/lib/portfolio-analyse/momentum-trader/momentum-universe'
import {
  ladeMomentumWatchlist,
  symboleAusWatchlist,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-server'
import { ladeYahooOhlcvBatch } from '@/lib/portfolio-analyse/momentum-trader/yahoo-ohlcv-server'
import type { MomentumBarsSyncErgebnis } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function addDaysIso(iso: string, tage: number): string {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + tage)
  return d.toISOString().slice(0, 10)
}

export async function POST(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) {
    return NextResponse.json(
      { ok: false, symbole: 0, kerzenGeschrieben: 0, vonDatum: '', bisDatum: '', fehler: 'Nicht angemeldet.' },
      { status: 401 },
    )
  }

  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser()
  if (userErr || !user) {
    return NextResponse.json(
      { ok: false, symbole: 0, kerzenGeschrieben: 0, vonDatum: '', bisDatum: '', fehler: 'Nicht angemeldet.' },
      { status: 401 },
    )
  }

  let body: Record<string, unknown> = {}
  try {
    body = ((await req.json()) ?? {}) as Record<string, unknown>
  } catch {
    // leer ok
  }

  const tage = typeof body.tage === 'number' && body.tage > 0 ? Math.min(body.tage, 400) : 252
  const bisDatum = heuteIsoUtc()
  const vonDatum = addDaysIso(bisDatum, -tage)

  const watchlist = await ladeMomentumWatchlist(sb)
  const symbole = syncSymboleFuerWatchlist(watchlist, MOMENTUM_REGIME_SYMBOLS)

  if (symboleAusWatchlist(watchlist).length === 0) {
    return NextResponse.json(
      {
        ok: false,
        symbole: symbole.length,
        kerzenGeschrieben: 0,
        vonDatum,
        bisDatum,
        fehler: 'Watchlist leer — zuerst Titel per Suche hinzufügen. (Nur Regime-Indizes würden ohne Watchlist wenig bringen.)',
      } satisfies MomentumBarsSyncErgebnis,
      { status: 400 },
    )
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

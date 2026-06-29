/** Regelbasierter Scan (Stufe A) — GET letzter / POST neu. */
import { NextResponse } from 'next/server'
import { heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { ladeNeuestenMomentumScan, ladeNeuestesMomentumRegime } from '@/lib/portfolio-analyse/momentum-trader/momentum-db-server'
import {
  berechneRegimeGates,
  syncMomentumMarketRegime,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-regime-server'
import { scanMomentumWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-scan-server'
import { ladeMomentumWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

async function authOder401(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return { sb: null, res: NextResponse.json({ fehler: 'Nicht angemeldet.' }, { status: 401 }) }
  const {
    data: { user },
    error,
  } = await sb.auth.getUser()
  if (error || !user) {
    return { sb: null, res: NextResponse.json({ fehler: 'Nicht angemeldet.' }, { status: 401 }) }
  }
  return { sb, res: null }
}

export async function GET(req: Request) {
  const { res } = await authOder401(req)
  if (res) return res

  const gespeichert = await ladeNeuestenMomentumScan()
  if (!gespeichert) {
    return NextResponse.json({
      scanDate: heuteIsoUtc(),
      regime: null,
      ergebnisse: [],
    })
  }

  const regime = await ladeNeuestesMomentumRegime()
  const regimeGates = regime ? berechneRegimeGates(regime) : null
  return NextResponse.json({
    scanDate: gespeichert.scanDate,
    regime: regimeGates,
    ergebnisse: gespeichert.ergebnisse,
  })
}

export async function POST(req: Request) {
  const { sb, res } = await authOder401(req)
  if (res || !sb) return res!

  const watchlist = await ladeMomentumWatchlist(sb)
  if (watchlist.length === 0) {
    return NextResponse.json(
      { fehler: 'Watchlist leer — zuerst Titel hinzufügen und Daten syncen.' },
      { status: 400 },
    )
  }

  try {
    const regimeGates = await syncMomentumMarketRegime()
    if (!regimeGates) {
      return NextResponse.json(
        { fehler: 'Markt-Regime nicht berechenbar — zuerst Kurse syncen.' },
        { status: 400 },
      )
    }

    const paket = await scanMomentumWatchlist(watchlist, regimeGates)
    return NextResponse.json(paket)
  } catch (e) {
    console.error('[api/momentum-trader/scan]', e)
    return NextResponse.json({ fehler: String(e) }, { status: 500 })
  }
}

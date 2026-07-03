/** Regelbasierter Scan (Stufe A) — GET letzter / POST neu. */
import { NextResponse } from 'next/server'
import { heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { ladeNeuestenMomentumScan, ladeNeuestesMomentumRegime } from '@/lib/portfolio-analyse/momentum-trader/momentum-db-server'
import {
  berechneRegimeGates,
  syncMomentumMarketRegime,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-regime-server'
import { MOMENTUM_SCAN_MIT_KI_DEFAULT } from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
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

  try {
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
    const { ergaenzeScanMitErfolg } = await import(
      '@/lib/portfolio-analyse/momentum-trader/momentum-trade-erfolg-server'
    )
    const { ladePlaybookStats, baueStatsLookup, wendePlaybookDeaktivierungAn } = await import(
      '@/lib/portfolio-analyse/momentum-trader/momentum-playbook-stats-server'
    )
    const statsPaket = await ladePlaybookStats()
    const statsLookup = baueStatsLookup(statsPaket.stats)
    return NextResponse.json({
      scanDate: gespeichert.scanDate,
      regime: regimeGates,
      ergebnisse: wendePlaybookDeaktivierungAn(
        ergaenzeScanMitErfolg(gespeichert.ergebnisse, regimeGates, statsLookup),
        statsLookup,
      ),
      playbookStats: statsPaket,
    })
  } catch (e) {
    console.error('[api/momentum-trader/scan] GET', e)
    return NextResponse.json({ fehler: String(e) }, { status: 500 })
  }
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
    let mitKi = MOMENTUM_SCAN_MIT_KI_DEFAULT
    try {
      const body = ((await req.json()) ?? {}) as Record<string, unknown>
      if (body.mitKi === true) mitKi = true
      if (body.mitKi === false) mitKi = false
    } catch {
      /* leerer Body ok */
    }

    const regimeGates = await syncMomentumMarketRegime()
    if (!regimeGates) {
      return NextResponse.json(
        { fehler: 'Markt-Regime nicht berechenbar — zuerst Kurse syncen.' },
        { status: 400 },
      )
    }

    const paket = await scanMomentumWatchlist(watchlist, regimeGates, { mitKiMemos: mitKi })
    return NextResponse.json(paket)
  } catch (e) {
    console.error('[api/momentum-trader/scan]', e)
    return NextResponse.json({ fehler: String(e) }, { status: 500 })
  }
}

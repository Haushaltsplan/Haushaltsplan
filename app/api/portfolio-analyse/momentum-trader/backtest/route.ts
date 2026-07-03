/** Playbook-Backtest — historische Trefferquoten (GET laden / POST neu berechnen). */
import { NextResponse } from 'next/server'
import {
  berechneUndSpeicherePlaybookStats,
  ladePlaybookStats,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-playbook-stats-server'
import { ladeMomentumWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })
  const {
    data: { user },
    error,
  } = await sb.auth.getUser()
  if (error || !user) return NextResponse.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })

  try {
    const paket = await ladePlaybookStats()
    return NextResponse.json(paket)
  } catch (e) {
    return NextResponse.json({ fehler: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })
  const {
    data: { user },
    error,
  } = await sb.auth.getUser()
  if (error || !user) return NextResponse.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })

  try {
    const watchlist = await ladeMomentumWatchlist(sb)
    if (watchlist.length === 0) {
      return NextResponse.json({ fehler: 'Watchlist leer.' }, { status: 400 })
    }
    const paket = await berechneUndSpeicherePlaybookStats(watchlist)
    return NextResponse.json(paket)
  } catch (e) {
    console.error('[api/momentum-trader/backtest]', e)
    return NextResponse.json({ fehler: String(e) }, { status: 500 })
  }
}

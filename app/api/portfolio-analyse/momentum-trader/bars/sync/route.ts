/**
 * OHLCV-Bars für Watchlist + Regime-Indizes.
 */
import { NextResponse } from 'next/server'
import { syncBarsFuerWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-bars-sync-server'
import { backfillEarningsEventsFuerWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-events-server'
import { ladeMomentumWatchlist, symboleAusWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

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
    // ok
  }

  const tage = typeof body.tage === 'number' && body.tage > 0 ? Math.min(body.tage, 400) : 252
  const mitBackfill = body.backfillEvents === true

  const watchlist = await ladeMomentumWatchlist(sb)
  if (symboleAusWatchlist(watchlist).length === 0) {
    return NextResponse.json(
      {
        ok: false,
        symbole: 0,
        kerzenGeschrieben: 0,
        vonDatum: '',
        bisDatum: '',
        fehler: 'Watchlist leer — zuerst Titel hinzufügen.',
      },
      { status: 400 },
    )
  }

  try {
    const ergebnis = await syncBarsFuerWatchlist(watchlist, tage)
    if (mitBackfill) await backfillEarningsEventsFuerWatchlist(watchlist)
    return NextResponse.json(ergebnis, { status: ergebnis.ok ? 200 : 207 })
  } catch (e) {
    console.error('[api/momentum-trader/bars/sync]', e)
    return NextResponse.json(
      { ok: false, symbole: 0, kerzenGeschrieben: 0, vonDatum: '', bisDatum: '', fehler: String(e) },
      { status: 500 },
    )
  }
}

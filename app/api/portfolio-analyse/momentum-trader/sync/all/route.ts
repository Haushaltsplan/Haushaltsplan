/** Komplette Pipeline: Earnings → Kurse → Historie → Scan. */
import { NextResponse } from 'next/server'
import { fuehreVollenMomentumSyncAus } from '@/lib/portfolio-analyse/momentum-trader/momentum-full-sync-server'
import { ladeMomentumWatchlist } from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })

  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser()
  if (userErr || !user) return NextResponse.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })

  try {
    const watchlist = await ladeMomentumWatchlist(sb)
    const ergebnis = await fuehreVollenMomentumSyncAus(sb, watchlist)
    return NextResponse.json(ergebnis, { status: ergebnis.ok ? 200 : 207 })
  } catch (e) {
    console.error('[api/momentum-trader/sync/all]', e)
    return NextResponse.json({ ok: false, fehler: [String(e)], schritte: [], scan: null }, { status: 500 })
  }
}

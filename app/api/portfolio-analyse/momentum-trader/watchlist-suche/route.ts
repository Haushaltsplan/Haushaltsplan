import { NextResponse } from 'next/server'
import {
  loeseMomentumWatchlistKandidat,
  sucheMomentumWatchlistKandidaten,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-suche-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })
  const {
    data: { user },
    error,
  } = await sb.auth.getUser()
  if (error || !user) return NextResponse.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ treffer: [] })

  try {
    const treffer = await sucheMomentumWatchlistKandidaten(q)
    return NextResponse.json({ treffer })
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

  let body: Record<string, unknown>
  try {
    body = ((await req.json()) ?? {}) as Record<string, unknown>
  } catch {
    return NextResponse.json({ fehler: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const symbol = body.symbol != null ? String(body.symbol).trim() : ''
  const name = body.name != null ? String(body.name).trim() : ''
  const istPreIpo = body.istPreIpo === true
  const ipoDatumVorschlag =
    body.ipoDatumVorschlag != null ? String(body.ipoDatumVorschlag).trim().slice(0, 10) : null
  const notiz = body.notiz != null ? String(body.notiz).trim() : null

  if (!symbol && !name) {
    return NextResponse.json({ fehler: 'Symbol oder Name fehlt.' }, { status: 400 })
  }

  try {
    const aufgeloest = await loeseMomentumWatchlistKandidat({
      symbol: symbol || name,
      name: name || symbol,
      istPreIpo,
      ipoDatumVorschlag,
      notiz,
    })
    if (!aufgeloest) {
      return NextResponse.json({ fehler: 'Titel konnte nicht aufgelöst werden.' }, { status: 404 })
    }
    return NextResponse.json({ eintrag: aufgeloest })
  } catch (e) {
    return NextResponse.json({ fehler: String(e) }, { status: 500 })
  }
}

/** Momentum Trader — Watchlist CRUD. */
import { NextResponse } from 'next/server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import {
  aktualisiereMomentumWatchlistMeta,
  entferneAusMomentumWatchlist,
  fuegeZurMomentumWatchlist,
  ladeMomentumWatchlist,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-server'
import { reichereWatchlistMitEarningsAn } from '@/lib/portfolio-analyse/momentum-trader/momentum-watchlist-enrich-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'

export const dynamic = 'force-dynamic'

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
  const { sb, res } = await authOder401(req)
  if (res || !sb) return res!

  try {
    const eintraege = await ladeMomentumWatchlist(sb)
    const angereichert = await reichereWatchlistMitEarningsAn(eintraege)
    return NextResponse.json({ eintraege: angereichert })
  } catch (e) {
    return NextResponse.json({ fehler: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const { sb, res } = await authOder401(req)
  if (res || !sb) return res!

  let body: Record<string, unknown>
  try {
    body = ((await req.json()) ?? {}) as Record<string, unknown>
  } catch {
    return NextResponse.json({ fehler: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const isin = body.isin != null ? String(body.isin).trim().toUpperCase() : ''
  const name = body.name != null ? String(body.name).trim() : ''
  const symbolYahoo = body.symbolYahoo != null ? String(body.symbolYahoo).trim().toUpperCase() : null
  const symbolCandidates = Array.isArray(body.symbolCandidates)
    ? body.symbolCandidates.map((s) => String(s).trim().toUpperCase()).filter(Boolean)
    : []

  if (!isin) {
    return NextResponse.json({ fehler: 'ISIN fehlt.' }, { status: 400 })
  }

  const k = isinKenntnis(isin)
  const ergebnis = await fuegeZurMomentumWatchlist(sb, {
    isin,
    name: name || k?.name || isin,
    symbolYahoo: symbolYahoo || k?.symbolYahoo || null,
    symbolCandidates: symbolCandidates.length > 0 ? symbolCandidates : (k?.symbolCandidates ?? []),
  })

  if (!ergebnis.ok) {
    return NextResponse.json({ fehler: ergebnis.fehler }, { status: 400 })
  }

  const eintraege = await reichereWatchlistMitEarningsAn(await ladeMomentumWatchlist(sb))
  return NextResponse.json({ ok: true, eintraege })
}

export async function DELETE(req: Request) {
  const { sb, res } = await authOder401(req)
  if (res || !sb) return res!

  let isin = ''
  try {
    const body = ((await req.json()) ?? {}) as Record<string, unknown>
    isin = body.isin != null ? String(body.isin).trim().toUpperCase() : ''
  } catch {
    const u = new URL(req.url)
    isin = (u.searchParams.get('isin') ?? '').trim().toUpperCase()
  }

  if (!isin) {
    return NextResponse.json({ fehler: 'ISIN fehlt.' }, { status: 400 })
  }

  try {
    await entferneAusMomentumWatchlist(sb, isin)
    const eintraege = await reichereWatchlistMitEarningsAn(await ladeMomentumWatchlist(sb))
    return NextResponse.json({ ok: true, eintraege })
  } catch (e) {
    return NextResponse.json({ fehler: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const { sb, res } = await authOder401(req)
  if (res || !sb) return res!

  let body: Record<string, unknown>
  try {
    body = ((await req.json()) ?? {}) as Record<string, unknown>
  } catch {
    return NextResponse.json({ fehler: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const isin = body.isin != null ? String(body.isin).trim().toUpperCase() : ''
  if (!isin) return NextResponse.json({ fehler: 'ISIN fehlt.' }, { status: 400 })

  try {
    await aktualisiereMomentumWatchlistMeta(sb, isin, {
      ipoDatum: 'ipoDatum' in body ? (body.ipoDatum != null ? String(body.ipoDatum) : null) : undefined,
      notiz: 'notiz' in body ? (body.notiz != null ? String(body.notiz) : null) : undefined,
    })
    const eintraege = await reichereWatchlistMitEarningsAn(await ladeMomentumWatchlist(sb))
    return NextResponse.json({ ok: true, eintraege })
  } catch (e) {
    return NextResponse.json({ fehler: String(e) }, { status: 400 })
  }
}

/** Einzel-Ticker vollständig syncen (Earnings + Kurse + Gap-Historie + Live-Kurs). */
import { NextResponse } from 'next/server'
import { syncMomentumTicker } from '@/lib/portfolio-analyse/momentum-trader/momentum-ticker-sync-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

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

  const isin = body.isin != null ? String(body.isin).trim().toUpperCase() : ''
  if (!isin) return NextResponse.json({ fehler: 'ISIN fehlt.' }, { status: 400 })

  try {
    const ergebnis = await syncMomentumTicker(sb, isin)
    const status = ergebnis.eintrag ? 200 : 404
    return NextResponse.json(ergebnis, { status: ergebnis.eintrag ? 200 : status })
  } catch (e) {
    return NextResponse.json({ fehler: String(e) }, { status: 500 })
  }
}

/**
 * Watchlist-Cloud-Sync für den Nachkauf-Radar.
 *
 * GET  → aktuelle Cloud-Watchlist (für Merge beim Laden der Watchlist-Seite)
 * POST → Vollabgleich: Browser-Watchlist ersetzt den Cloud-Stand
 *
 * Auth läuft über die Proxy-Middleware (Supabase Bearer-Token, automatisch
 * angehängt durch installApiAuth im Client).
 */
import { NextResponse } from 'next/server'
import {
  ladeNachkaufWatchlistAusCloud,
  syncNachkaufWatchlistZurCloud,
  type NachkaufWatchlistEintrag,
} from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-watchlist-cloud-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const eintraege = await ladeNachkaufWatchlistAusCloud()
  return NextResponse.json({ ok: true, eintraege })
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const roh = (body as { eintraege?: unknown })?.eintraege
  if (!Array.isArray(roh)) {
    return NextResponse.json({ ok: false, fehler: 'eintraege[] fehlt.' }, { status: 400 })
  }

  const eintraege: NachkaufWatchlistEintrag[] = roh
    .map((e) => {
      const r = (e ?? {}) as Record<string, unknown>
      return {
        isin: String(r.isin ?? '').trim().toUpperCase(),
        name: String(r.name ?? '').trim(),
        symbolYahoo: r.symbolYahoo != null ? String(r.symbolYahoo).trim() || null : null,
        symbolCandidates: Array.isArray(r.symbolCandidates)
          ? r.symbolCandidates.filter((s): s is string => typeof s === 'string')
          : [],
        hinzugefuegtAm:
          typeof r.hinzugefuegtAm === 'string' && r.hinzugefuegtAm
            ? r.hinzugefuegtAm
            : new Date().toISOString(),
      }
    })
    .filter((e) => e.isin && e.name)

  const result = await syncNachkaufWatchlistZurCloud(eintraege)
  if (!result.ok) {
    return NextResponse.json({ ok: false, fehler: result.fehler }, { status: 502 })
  }
  return NextResponse.json({ ok: true, anzahl: eintraege.length })
}

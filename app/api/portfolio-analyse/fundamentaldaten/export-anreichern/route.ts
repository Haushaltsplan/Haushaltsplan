import { ladeFundamentalExportAnreicherung } from '@/lib/portfolio-analyse/fundamentaldaten-export-anreichern-server'
import { jsonMitOwner } from '@/lib/request-owner'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Liefert Earnings-/SEC inkl. Transkripttext + KI-Zusammenfassung aus dem Server-Cache. */
export async function POST(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return { ok: false, message: 'Kein gültiges JSON.' }
    }
    const ticker = String(body.ticker ?? '').trim().toUpperCase()
    if (!ticker) return { ok: false, message: 'ticker fehlt' }

    const anreicherung = await ladeFundamentalExportAnreicherung({ ticker })
    return {
      ok: true,
      earningsCalls: anreicherung.earningsCalls,
      secBerichte: anreicherung.secBerichte,
    }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}

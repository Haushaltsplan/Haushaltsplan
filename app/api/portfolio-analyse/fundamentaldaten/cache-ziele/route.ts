import { NextResponse } from 'next/server'
import { jsonMitOwner } from '@/lib/request-owner'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import {
  ladeNachkaufKandidaten,
  ladeWatchlistScrapeKandidaten,
} from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-watchlist-cloud-server'
import type { FundamentaldatenAnfrage } from '@/lib/portfolio-analyse/fundamentaldaten-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unique(werte: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const w of werte) {
    const t = w?.trim()
    if (!t) continue
    const k = t.toUpperCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  return out
}

/**
 * Fundamentaldaten-/Segment-Batch.
 * `?umfang=depot` (Default): nur Live-Depot.
 * `?umfang=watchlist`: Cloud-Watchlist ohne Titel, die schon im Depot liegen.
 */
export async function GET(req: Request) {
  return jsonMitOwner(req, async () => {
  try {
    const umfang = new URL(req.url).searchParams.get('umfang') === 'watchlist' ? 'watchlist' : 'depot'
    const kandidaten =
      umfang === 'watchlist' ? await ladeWatchlistScrapeKandidaten() : await ladeNachkaufKandidaten()
    const ziele: FundamentaldatenAnfrage[] = []
    const gesehen = new Set<string>()
    let depotN = 0
    let watchlistN = 0

    for (const k of kandidaten) {
      const isin = k.isin?.trim().toUpperCase()
      if (!isin || gesehen.has(isin)) continue
      gesehen.add(isin)
      if (k.quelle === 'depot') depotN++
      else watchlistN++
      const ken = isinKenntnis(isin)
      ziele.push({
        isin,
        name: k.name,
        symbolYahoo: k.symbolYahoo ?? ken?.symbolYahoo ?? null,
        symbolCandidates: unique([
          ...(k.symbolCandidates ?? []),
          ken?.symbolYahoo,
          ...(ken?.symbolCandidates ?? []),
        ]),
        frequenz: 'jahr',
        cacheModus: 'erneuern',
      })
    }

    return NextResponse.json({
      ok: true,
      ziele,
      anzahl: ziele.length,
      depot: depotN,
      watchlist: watchlistN,
    })
  } catch (e) {
    console.error('[fundamentaldaten/cache-ziele]', e)
    return NextResponse.json(
      { ok: false, ziele: [], anzahl: 0, message: e instanceof Error ? e.message : 'Ziele fehlgeschlagen.' },
      { status: 502 },
    )
  }
  })
}

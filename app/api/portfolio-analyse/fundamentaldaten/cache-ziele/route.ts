import { NextResponse } from 'next/server'
import { jsonMitOwner } from '@/lib/request-owner'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { ladeNachkaufWatchlistAusCloud } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-watchlist-cloud-server'
import { ladeDepotAktieAnfragen } from '@/lib/portfolio-analyse/depot-gewichte-server'
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

/** Fundamentaldaten-Batch: nur Depot ∪ Watchlist — ohne Nachkauf-Radar-Whitelist. */
export async function GET(req: Request) {
  return jsonMitOwner(req, async () => {
  try {
    const [depot, watchlist] = await Promise.all([
      ladeDepotAktieAnfragen(),
      ladeNachkaufWatchlistAusCloud(),
    ])
    const ziele: FundamentaldatenAnfrage[] = []
    const gesehen = new Set<string>()

    for (const d of depot) {
      const isin = d.isin?.trim().toUpperCase()
      if (!isin || gesehen.has(isin)) continue
      gesehen.add(isin)
      const ken = isinKenntnis(isin)
      ziele.push({
        ...d,
        isin,
        symbolYahoo: d.symbolYahoo ?? ken?.symbolYahoo ?? null,
        symbolCandidates: unique([
          ...(d.symbolCandidates ?? []),
          ken?.symbolYahoo,
          ...(ken?.symbolCandidates ?? []),
        ]),
        frequenz: 'jahr',
        cacheModus: 'erneuern',
      })
    }

    for (const w of watchlist) {
      const isin = w.isin?.trim().toUpperCase()
      if (!isin || gesehen.has(isin)) continue
      gesehen.add(isin)
      const ken = isinKenntnis(isin)
      ziele.push({
        isin,
        name: w.name,
        symbolYahoo: w.symbolYahoo ?? ken?.symbolYahoo ?? null,
        symbolCandidates: unique([
          ...w.symbolCandidates,
          ken?.symbolYahoo,
          ...(ken?.symbolCandidates ?? []),
        ]),
        frequenz: 'jahr',
        cacheModus: 'erneuern',
      })
    }

    return NextResponse.json({ ok: true, ziele, anzahl: ziele.length })
  } catch (e) {
    console.error('[fundamentaldaten/cache-ziele]', e)
    return NextResponse.json(
      { ok: false, ziele: [], anzahl: 0, message: e instanceof Error ? e.message : 'Ziele fehlgeschlagen.' },
      { status: 502 },
    )
  }
  })
}

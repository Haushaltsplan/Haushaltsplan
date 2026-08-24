import { NextResponse } from 'next/server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { ladeNachkaufKandidaten } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-watchlist-cloud-server'
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

export async function GET() {
  try {
    const kandidaten = await ladeNachkaufKandidaten()
    const depot = await ladeDepotAktieAnfragen()
    const ziele: FundamentaldatenAnfrage[] = kandidaten.map((k) => {
      const ken = isinKenntnis(k.isin)
      return {
        isin: k.isin,
        name: k.name,
        symbolYahoo: k.symbolYahoo ?? ken?.symbolYahoo ?? null,
        symbolCandidates: unique([
          ...(k.symbolCandidates ?? []),
          ken?.symbolYahoo,
          ...(ken?.symbolCandidates ?? []),
        ]),
        frequenz: 'jahr',
        cacheModus: 'erneuern',
      }
    })
    const gesehen = new Set(ziele.map((z) => z.isin?.trim().toUpperCase()).filter(Boolean) as string[])
    for (const d of depot) {
      const isin = d.isin?.trim().toUpperCase()
      if (!isin || gesehen.has(isin)) continue
      gesehen.add(isin)
      ziele.push({ ...d, cacheModus: 'erneuern' })
    }
    return NextResponse.json({ ok: true, ziele, anzahl: ziele.length })
  } catch (e) {
    console.error('[fundamentaldaten/cache-ziele]', e)
    return NextResponse.json(
      { ok: false, ziele: [], anzahl: 0, message: e instanceof Error ? e.message : 'Ziele fehlgeschlagen.' },
      { status: 502 },
    )
  }
}

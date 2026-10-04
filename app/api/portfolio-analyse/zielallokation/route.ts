import { NextResponse } from 'next/server'
import { ladeLivePortfolioServer } from '@/lib/portfolio-analyse/depot-gewichte-server'
import {
  berechneRebalancingTrades,
  ladeZielallokation,
  speichereZielgewichte,
  type ZielDimension,
} from '@/lib/portfolio-analyse/zielallokation-server'
import { jsonMitOwner } from '@/lib/request-owner'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    const ziele = await ladeZielallokation()
    const livePaket = await ladeLivePortfolioServer()
    const live = livePaket?.live
    const trades =
      live && ziele.length > 0
        ? berechneRebalancingTrades(live.positionen, ziele, live.kennzahlen.depotwertEur)
        : []
    return { ok: true, ziele, trades, depotwertEur: live?.kennzahlen.depotwertEur ?? null }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}

export async function POST(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    let body: { ziele?: unknown }
    try {
      body = (await req.json()) as { ziele?: unknown }
    } catch {
      return { ok: false, message: 'Kein JSON' }
    }
    if (!Array.isArray(body.ziele)) return { ok: false, message: 'ziele[] erwartet' }
    const zeilen = body.ziele.map((z) => {
      const row = z as Record<string, unknown>
      return {
        dimension: String(row.dimension ?? 'assetklasse') as ZielDimension,
        schluessel: String(row.schluessel ?? ''),
        label: String(row.label ?? row.schluessel ?? ''),
        zielPct: Number(row.zielPct) || 0,
      }
    }).filter((z) => z.schluessel && z.zielPct >= 0)
    await speichereZielgewichte(zeilen)
    const ziele = await ladeZielallokation()
    const livePaket = await ladeLivePortfolioServer()
    const live = livePaket?.live
    const trades =
      live && ziele.length > 0
        ? berechneRebalancingTrades(live.positionen, ziele, live.kennzahlen.depotwertEur)
        : []
    return { ok: true, ziele, trades }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}

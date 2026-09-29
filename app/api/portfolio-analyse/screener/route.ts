import { NextResponse } from 'next/server'
import {
  erneuereScreenerSnapshot,
  ladeScreenerSnapshot,
} from '@/lib/portfolio-analyse/screener/screener-snapshot-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 180

function paketFuerClient(snap: NonNullable<Awaited<ReturnType<typeof ladeScreenerSnapshot>>>) {
  return {
    ok: true as const,
    leer: false as const,
    periode: snap.periode,
    aktualisiertAm: snap.aktualisiertAm,
    n: snap.n,
    zeilen: snap.zeilen.map(({ hist: _hist, ...z }) => z),
  }
}

export async function GET() {
  try {
    const snap = await ladeScreenerSnapshot()
    if (!snap) {
      return NextResponse.json({
        ok: true,
        leer: true,
        periode: null,
        aktualisiertAm: null,
        n: 0,
        zeilen: [],
      })
    }
    return NextResponse.json(paketFuerClient(snap))
  } catch (e) {
    console.error('[screener] GET', e)
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : 'Screener konnte nicht geladen werden.' },
      { status: 500 },
    )
  }
}

export async function POST() {
  try {
    const snap = await erneuereScreenerSnapshot()
    return NextResponse.json(paketFuerClient(snap))
  } catch (e) {
    console.error('[screener] POST', e)
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : 'Universum konnte nicht geladen werden.' },
      { status: 500 },
    )
  }
}

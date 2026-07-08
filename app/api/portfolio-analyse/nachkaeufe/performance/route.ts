import { NextResponse } from 'next/server'

import { ladeNachkaufPerformance } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-performance-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** GET — Empfehlungs-Performance (6M/12M vs. SPY) + Score-Signal-Backtest. */
export async function GET() {
  try {
    const daten = await ladeNachkaufPerformance()
    return NextResponse.json({ ok: true, daten })
  } catch (e) {
    console.error('[nachkauf-performance]', e)
    return NextResponse.json({ ok: false, fehler: 'Performance konnte nicht geladen werden.' }, { status: 502 })
  }
}

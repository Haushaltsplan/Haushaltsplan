import { NextResponse } from 'next/server'

import { ladeNachkaufPerformance } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-performance-server'
import { jsonMitOwner } from '@/lib/request-owner'
import { ownerUserIdAusRequest } from '@/lib/supabase-user'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** GET — Empfehlungs-Performance (Live seit Empfehlung + 6M/12M vs. SPY). */
export async function GET(req: Request) {
  return jsonMitOwner(req, async () => {
    try {
      const ownerUserId = ownerUserIdAusRequest(req)
      const daten = await ladeNachkaufPerformance(ownerUserId)
      return NextResponse.json({ ok: true, daten })
    } catch (e) {
      console.error('[nachkauf-performance]', e)
      return NextResponse.json({ ok: false, fehler: 'Performance konnte nicht geladen werden.' }, { status: 502 })
    }
  })
}

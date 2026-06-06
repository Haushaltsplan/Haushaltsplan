import { holeGueltigenAccessToken, ladeVollstaendigerCloudSync } from '@/lib/fitnessdaten/whoop-cloud-server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const token = await holeGueltigenAccessToken()
    if (!token) {
      return NextResponse.json(
        { ok: false, message: 'Nicht verbunden', fehler: 'WHOOP-Konto nicht verbunden.' },
        { status: 401 },
      )
    }
    const payload = await ladeVollstaendigerCloudSync(token, 35)
    const mitSpo2 = payload.recoveries.filter((r) => r.spo2Percent != null).length
    return NextResponse.json({
      ok: true,
      payload,
      syncedAt: new Date().toISOString(),
      message: `Recovery ${payload.recoveries.length}, Schlaf ${payload.sleeps.length}, Workouts ${payload.workouts.length}`,
      stats: {
        recoveries: payload.recoveries.length,
        sleeps: payload.sleeps.length,
        cycles: payload.cycles.length,
        workouts: payload.workouts.length,
        mitSpo2,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Sync fehlgeschlagen'
    return NextResponse.json({ ok: false, message: msg, fehler: msg }, { status: 502 })
  }
}

import { NextResponse } from 'next/server'
import { erneuereScreenerSnapshot } from '@/lib/portfolio-analyse/screener/screener-snapshot-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 180

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, fehler: 'Unauthorized' }, { status: 401 })
  }
  try {
    const snap = await erneuereScreenerSnapshot()
    return NextResponse.json({
      ok: true,
      n: snap.n,
      periode: snap.periode,
      zeitstempel: snap.aktualisiertAm,
    })
  } catch (e) {
    console.error('[screener-cron]', e)
    return NextResponse.json({ ok: false, fehler: String(e) }, { status: 500 })
  }
}

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
    const ergebnis = await erneuereScreenerSnapshot()
    return NextResponse.json({
      ok: true,
      n: ergebnis.n,
      periode: ergebnis.periode,
      zeitstempel: ergebnis.aktualisiertAm,
      cloudGespeichert: ergebnis.cloudGespeichert,
      cloudWarnung: ergebnis.cloudWarnung,
    })
  } catch (e) {
    console.error('[screener-cron]', e)
    return NextResponse.json({ ok: false, fehler: String(e) }, { status: 500 })
  }
}

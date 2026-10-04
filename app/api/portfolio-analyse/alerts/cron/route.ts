import { NextResponse } from 'next/server'
import { generierePortfolioAlerts } from '@/lib/portfolio-analyse/portfolio-alerts-server'
import { runWithPrimaeremOwner } from '@/lib/request-owner'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, fehler: 'Unauthorized' }, { status: 401 })
  }

  try {
    return await runWithPrimaeremOwner(async () => {
      const r = await generierePortfolioAlerts()
      return NextResponse.json({ ok: true, ...r, zeitstempel: new Date().toISOString() })
    })
  } catch (e) {
    console.error('alerts cron', e)
    return NextResponse.json(
      { ok: false, fehler: e instanceof Error ? e.message : 'Cron fehlgeschlagen' },
      { status: 500 },
    )
  }
}

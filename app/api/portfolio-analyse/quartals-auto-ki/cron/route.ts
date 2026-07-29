/**
 * Vercel Cron: Neue Quartalsberichte & Earnings Calls erkennen und per KI zusammenfassen.
 * Schedule: Di + Fr 05:00 UTC (siehe vercel.json).
 *
 * Gesichert durch CRON_SECRET.
 */
import { NextResponse } from 'next/server'
import { laufeQuartalsAutoKi } from '@/lib/portfolio-analyse/quartals-auto-ki-cron-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function cronErlaubt(req: Request): boolean {
  const secret = (process.env.CRON_SECRET || '').trim()
  if (!secret) return true // lokal ohne Secret
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!cronErlaubt(req)) {
    return NextResponse.json({ ok: false, fehler: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const startOffset = Math.max(0, Number(url.searchParams.get('offset')) || 0)

  try {
    let offset = startOffset
    let runden = 0
    const MAX_RUNDEN = 10
    const aggregiert = {
      kandidaten: 0,
      geprueft: 0,
      secNeu: 0,
      earningsNeu: 0,
      diffsNeu: 0,
      uebersprungen: 0,
      fehler: [] as string[],
      details: [] as Awaited<ReturnType<typeof laufeQuartalsAutoKi>>['details'],
    }

    while (runden < MAX_RUNDEN) {
      const teil = await laufeQuartalsAutoKi({
        offset,
        maxTicker: 3,
        maxKiJobs: 3,
        zeitBudgetMs: 100_000,
      })
      aggregiert.kandidaten = teil.kandidaten
      aggregiert.geprueft += teil.geprueft
      aggregiert.secNeu += teil.secNeu
      aggregiert.earningsNeu += teil.earningsNeu
      aggregiert.diffsNeu += teil.diffsNeu
      aggregiert.uebersprungen += teil.uebersprungen
      aggregiert.fehler.push(...teil.fehler)
      aggregiert.details.push(...teil.details)
      offset = teil.offset
      runden++
      if (teil.verbleibend === 0) break
      if (teil.secNeu + teil.earningsNeu + teil.diffsNeu === 0 && teil.geprueft === 0) break
      if (aggregiert.secNeu + aggregiert.earningsNeu + aggregiert.diffsNeu >= 5) break
    }

    return NextResponse.json({
      ok: true,
      ...aggregiert,
      runden,
      zeitstempel: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[quartals-auto-ki-cron]', e)
    return NextResponse.json({ ok: false, fehler: String(e) }, { status: 500 })
  }
}

/**
 * Wöchentlicher Etsy-Cron: CEO-Briefing für alle verbundenen Shops.
 * vercel.json: Sonntag 07:00 UTC.
 */
import { baueCeoBriefing, speichereCeoBriefing } from '@/lib/etsy/etsy-strategie-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 180

function cronErlaubt(req: Request): boolean {
  const secret = (process.env.CRON_SECRET || '').trim()
  if (!secret) return process.env.NODE_ENV !== 'production'
  return (req.headers.get('authorization') || '') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!cronErlaubt(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createSupabaseAdmin()
  const { data: owners } = await admin.from('etsy_oauth_tokens').select('owner_user_id')
  const userIds = [...new Set((owners ?? []).map((o) => String(o.owner_user_id)).filter(Boolean))]
  const report: Array<Record<string, unknown>> = []
  for (const ownerUserId of userIds) {
    try {
      const briefing = await baueCeoBriefing(ownerUserId, admin)
      await speichereCeoBriefing(ownerUserId, briefing)
      report.push({
        ownerUserId,
        woche: briefing.woche,
        umsatz30: briefing.umsatz30,
        aktionen: briefing.aktionen.length,
        algoAlarme: briefing.algoAlarme.length,
      })
    } catch (e) {
      report.push({
        ownerUserId,
        fehler: e instanceof Error ? e.message.slice(0, 160) : 'Fehler',
      })
    }
  }
  console.info('[etsy-wochen-cron]', JSON.stringify(report))
  return NextResponse.json({ ok: true, report })
}

export async function POST(req: Request) {
  return GET(req)
}

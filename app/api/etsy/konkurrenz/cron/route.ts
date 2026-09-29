/**
 * Täglicher Konkurrenz-Snapshot (vercel.json: 04:00 UTC).
 * GET/POST mit Authorization: Bearer CRON_SECRET. Kein Gemini — nur Etsy-API (~15–60 Calls).
 */
import { aktualisiereEtsyKonkurrenz } from '@/lib/etsy/etsy-konkurrenz-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

function cronErlaubt(req: Request): boolean {
  const secret = (process.env.CRON_SECRET || '').trim()
  if (!secret) return process.env.NODE_ENV !== 'production'
  return (req.headers.get('authorization') || '') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!cronErlaubt(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: owners } = await createSupabaseAdmin().from('etsy_oauth_tokens').select('owner_user_id')
  const userIds = [...new Set((owners ?? []).map((o) => String(o.owner_user_id)).filter(Boolean))]
  const report: Array<{ ownerUserId: string; entdeckt?: boolean; snapshots?: number; fehler?: string }> = []
  for (const ownerUserId of userIds) {
    try {
      const lauf = await aktualisiereEtsyKonkurrenz(ownerUserId)
      report.push({ ownerUserId, ...lauf })
    } catch (e) {
      report.push({ ownerUserId, fehler: e instanceof Error ? e.message.slice(0, 160) : 'Fehler' })
    }
  }
  console.info('[etsy-konkurrenz-cron]', JSON.stringify(report))
  return NextResponse.json({ ok: true, report })
}

export async function POST(req: Request) {
  return GET(req)
}

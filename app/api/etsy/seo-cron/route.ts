/**
 * Cron: Schwachstellen (Score ≤69) melden und optional re-auditen.
 * GET/POST mit Authorization: Bearer CRON_SECRET
 *
 * Query: ?reaudit=1 → bis zu 5 schwache Listings pro Owner frisch auditen (Cache-Bypass)
 */
import { auditiereEtsyListing } from '@/lib/etsy/etsy-seo-audit-engine'
import {
  ladeEtsySeoSchwachstellen,
  speichereEtsySeoAudit,
} from '@/lib/etsy/etsy-seo-audit-cache'
import { listingFingerprint } from '@/lib/etsy/etsy-seo-diff'
import { ladeEtsyListingDetail } from '@/lib/etsy/etsy-listings-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function cronErlaubt(req: Request): boolean {
  const secret = (process.env.CRON_SECRET || '').trim()
  // Wie Strava: ohne CRON_SECRET in Dev durchlassen; in Prod immer setzen.
  if (!secret) return process.env.NODE_ENV !== 'production'
  const auth = req.headers.get('authorization') || ''
  return auth === `Bearer ${secret}`
}

async function run(reaudit: boolean) {
  const { data: owners } = await createSupabaseAdmin()
    .from('etsy_oauth_tokens')
    .select('owner_user_id')
  const userIds = [...new Set((owners ?? []).map((o) => String(o.owner_user_id)).filter(Boolean))]

  const report: Array<{
    ownerUserId: string
    weak: Array<{ listingId: number; score: number; title: string }>
    reaudited?: Array<{ listingId: number; score: number; error?: string }>
  }> = []

  for (const ownerUserId of userIds) {
    const weak = await ladeEtsySeoSchwachstellen(ownerUserId, 69)
    if (weak.length === 0) continue

    const entry: (typeof report)[number] = {
      ownerUserId,
      weak: weak.map((w) => ({
        listingId: w.listingId,
        score: w.overallScore,
        title: w.listingTitle,
      })),
    }

    if (reaudit) {
      entry.reaudited = []
      for (const w of weak.slice(0, 5)) {
        try {
          const { listing } = await ladeEtsyListingDetail(ownerUserId, w.listingId)
          const fingerprint = listingFingerprint(listing)
          const audit = await auditiereEtsyListing(listing)
          await speichereEtsySeoAudit({
            ownerUserId,
            listingId: w.listingId,
            fingerprint,
            audit,
            listingTitle: listing.title,
            state: listing.state,
          })
          entry.reaudited.push({ listingId: w.listingId, score: audit.overall_score })
        } catch (e) {
          entry.reaudited.push({
            listingId: w.listingId,
            score: w.overallScore,
            error: e instanceof Error ? e.message.slice(0, 120) : 'Fehler',
          })
        }
      }
    }

    report.push(entry)
    console.info(
      `[etsy-seo-cron] owner=${ownerUserId} schwachstellen=${weak.length}` +
        (reaudit ? ` reaudit=${entry.reaudited?.length ?? 0}` : ''),
      weak.map((w) => `#${w.listingId}:${w.overallScore}`).join(', '),
    )
  }

  return {
    ok: true,
    owners: userIds.length,
    reports: report.length,
    reaudit,
    report,
  }
}

export async function GET(req: Request) {
  if (!cronErlaubt(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const reaudit = new URL(req.url).searchParams.get('reaudit') === '1'
  try {
    return NextResponse.json(await run(reaudit))
  } catch (e) {
    console.error('[etsy-seo-cron]', e)
    return NextResponse.json({ error: 'Cron fehlgeschlagen' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  return GET(req)
}

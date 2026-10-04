/**
 * Täglicher Etsy-Cron (vercel.json: 04:00 UTC). GET/POST mit Authorization: Bearer CRON_SECRET.
 * 1) Eigene Listings: Aufrufe/Favoriten-Snapshot + Verkäufe (Wirkungsmessung, Cockpit-KPIs)
 * 2) Bestell-Receipts sync (Betrieb-Pipeline)
 * 3) Konkurrenz-Verkaufschart (Top-Drechsler-Shops)
 * 4) Keyword-Auto-Scan (Nachfrage zu den eigenen Produkten, 24h-Cache)
 * Kein Gemini — nur Etsy-/Google-/Amazon-Daten.
 */
import { syncEtsyBestellungen } from '@/lib/etsy/etsy-bestellung-server'
import { syncEtsyFeeLedger } from '@/lib/etsy/etsy-fee-ledger-server'
import { scanneEtsyKeywordsFuerShop } from '@/lib/etsy/etsy-keyword-auto-server'
import { aktualisiereEtsyKonkurrenz } from '@/lib/etsy/etsy-konkurrenz-server'
import { syncEtsyHtmlCircuitFromDb } from '@/lib/etsy/etsy-scraping'
import { erfasseEtsyListingStatistik } from '@/lib/etsy/etsy-statistik-server'
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
  await syncEtsyHtmlCircuitFromDb().catch(() => undefined)
  const { data: owners } = await createSupabaseAdmin().from('etsy_oauth_tokens').select('owner_user_id')
  const userIds = [...new Set((owners ?? []).map((o) => String(o.owner_user_id)).filter(Boolean))]
  const report: Array<Record<string, unknown>> = []
  for (const ownerUserId of userIds) {
    const [statistik, bestellungen, ledger, konkurrenz] = await Promise.all([
      erfasseEtsyListingStatistik(ownerUserId).catch((e) => ({
        fehler: e instanceof Error ? e.message.slice(0, 160) : 'Fehler',
      })),
      syncEtsyBestellungen(ownerUserId).catch((e) => ({
        anzahl: 0,
        fehler: e instanceof Error ? e.message.slice(0, 160) : 'Fehler',
      })),
      syncEtsyFeeLedger(ownerUserId).catch((e) => ({
        ledger: 0,
        payments: 0,
        fehler: e instanceof Error ? e.message.slice(0, 160) : 'Fehler',
      })),
      aktualisiereEtsyKonkurrenz(ownerUserId).catch((e) => ({
        fehler: e instanceof Error ? e.message.slice(0, 160) : 'Fehler',
      })),
    ])
    const keywords = await scanneEtsyKeywordsFuerShop(ownerUserId)
      .then((s) => ({ chancen: s.chancen.length, seeds: s.seeds.length, ausCache: s.ausCache }))
      .catch((e) => ({
        fehler: e instanceof Error ? e.message.slice(0, 160) : 'Fehler',
      }))
    report.push({ ownerUserId, statistik, bestellungen, ledger, konkurrenz, keywords })
  }
  console.info('[etsy-tages-cron]', JSON.stringify(report))
  return NextResponse.json({ ok: true, report })
}

export async function POST(req: Request) {
  return GET(req)
}

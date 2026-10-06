import { NextResponse } from 'next/server'
import { batchJournalAutoFill } from '@/lib/portfolio-analyse/investment-journal-ki-server'
import { jsonMitOwner } from '@/lib/request-owner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    let ticker: string | undefined
    try {
      const body = (await req.json()) as { ticker?: string }
      ticker = body.ticker?.trim() || undefined
    } catch {
      /* kein Body = alle Depot-Titel */
    }
    try {
      const result = await batchJournalAutoFill({ ticker })
      return { ok: true, ...result }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Auto-Fill fehlgeschlagen'
      console.error('[journal/auto-fill]', msg)
      return { ok: false, message: msg }
    }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}

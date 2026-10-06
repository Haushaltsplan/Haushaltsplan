import { NextResponse } from 'next/server'
import { batchJournalGegenpruefung } from '@/lib/portfolio-analyse/investment-journal-ki-server'
import { ladeJournalGegenpruefungen } from '@/lib/portfolio-analyse/investment-journal-server'
import { jsonMitOwner } from '@/lib/request-owner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    const url = new URL(req.url)
    const ticker = url.searchParams.get('ticker') || undefined
    const eintraege = await ladeJournalGegenpruefungen({ ticker, limit: 50 })
    return { ok: true, eintraege }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}

export async function POST(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    let ticker: string | undefined
    try {
      const body = (await req.json()) as { ticker?: string }
      ticker = body.ticker?.trim() || undefined
    } catch {
      /* alle */
    }
    try {
      const result = await batchJournalGegenpruefung({ ticker })
      return { ok: true, ...result }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gegenprüfung fehlgeschlagen'
      console.error('[journal/gegenpruefung]', msg)
      return { ok: false, message: msg }
    }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}

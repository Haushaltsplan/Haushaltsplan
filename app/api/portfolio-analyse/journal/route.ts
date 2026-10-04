import { NextResponse } from 'next/server'
import {
  ladeJournalEintraege,
  speichereJournalEintrag,
} from '@/lib/portfolio-analyse/investment-journal-server'
import { jsonMitOwner } from '@/lib/request-owner'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    const url = new URL(req.url)
    const ticker = url.searchParams.get('ticker') || undefined
    const eintraege = await ladeJournalEintraege({ ticker })
    return { ok: true, eintraege }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}

export async function POST(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return { ok: false, message: 'Kein JSON' }
    }
    const ticker = String(body.ticker ?? '').trim()
    if (!ticker) return { ok: false, message: 'ticker fehlt' }
    const eintrag = await speichereJournalEintrag({
      id: body.id != null ? String(body.id) : undefined,
      isin: body.isin != null ? String(body.isin) : null,
      ticker,
      name: body.name != null ? String(body.name) : undefined,
      these: body.these != null ? String(body.these) : undefined,
      kaufgrund: body.kaufgrund != null ? String(body.kaufgrund) : undefined,
      watchpoints: body.watchpoints != null ? String(body.watchpoints) : undefined,
      status: body.status === 'geschlossen' ? 'geschlossen' : 'aktiv',
      reviewAm: body.reviewAm != null ? String(body.reviewAm) : null,
    })
    return { ok: true, eintrag }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}

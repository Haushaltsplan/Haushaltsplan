import { NextResponse } from 'next/server'
import { jsonMitOwner } from '@/lib/request-owner'
import { ladeNotizen, speichereNotiz } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-db-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

export async function GET(req: Request) {
  return jsonMitOwner(req, async () => {
    try {
      const map = await ladeNotizen()
      return NextResponse.json({ ok: true, notizen: Object.fromEntries(map) })
    } catch (e) {
      return NextResponse.json({ ok: false, fehler: String(e) }, { status: 500 })
    }
  })
}

export async function POST(req: Request) {
  return jsonMitOwner(req, async () => {
    try {
      const body = (await req.json()) as { ticker?: string; notiz?: string }
      if (!body.ticker?.trim()) {
        return NextResponse.json({ ok: false, fehler: 'ticker fehlt' }, { status: 400 })
      }
      await speichereNotiz(body.ticker.trim(), body.notiz ?? '')
      return NextResponse.json({ ok: true })
    } catch (e) {
      return NextResponse.json({ ok: false, fehler: String(e) }, { status: 500 })
    }
  })
}

import { NextResponse } from 'next/server'
import { ladeNotizen, speichereNotiz } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-db-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

export async function GET() {
  try {
    const map = await ladeNotizen()
    return NextResponse.json({ ok: true, notizen: Object.fromEntries(map) })
  } catch (e) {
    return NextResponse.json({ ok: false, fehler: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
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
}

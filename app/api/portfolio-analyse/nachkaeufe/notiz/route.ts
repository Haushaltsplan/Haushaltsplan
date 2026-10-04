import { NextResponse } from 'next/server'
import { parseJsonBody } from '@/lib/api/parse-json-body'
import { nachkaufNotizBodySchema } from '@/lib/api/schemas/nachkauf'
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
      const parsed = await parseJsonBody(req, nachkaufNotizBodySchema, { fehlerPrefix: 'Notiz ungültig' })
      if (!parsed.ok) return parsed.response
      await speichereNotiz(parsed.data.ticker, parsed.data.notiz)
      return NextResponse.json({ ok: true })
    } catch (e) {
      return NextResponse.json({ ok: false, fehler: String(e) }, { status: 500 })
    }
  })
}

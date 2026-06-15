import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 180

export async function POST(req: Request) {
  try {
    const { ladeQuartalsKiDiff } = await import('@/lib/portfolio-analyse/quartals-ki-diff-server')
    const body = (await req.json()) as Record<string, unknown>
    const ticker = body.ticker != null ? String(body.ticker).trim() : ''
    const typ = body.typ === 'sec_bericht' ? 'sec_bericht' : 'earnings_call'
    const aktuellId = body.aktuellId != null ? String(body.aktuellId).trim() : ''
    const vorherId = body.vorherId != null ? String(body.vorherId).trim() : ''
    if (!ticker || !aktuellId || !vorherId) {
      return NextResponse.json({ ok: false, fehler: 'ticker, aktuellId, vorherId erforderlich.' }, { status: 400 })
    }
    const paket = await ladeQuartalsKiDiff({
      ticker,
      firmenname: body.firmenname != null ? String(body.firmenname) : null,
      typ,
      aktuellId,
      vorherId,
      force: Boolean(body.force),
    })
    return NextResponse.json(paket)
  } catch (e) {
    console.error('quartals-ki-diff', e)
    return NextResponse.json({ ok: false, fehler: e instanceof Error ? e.message : 'Fehler' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const { ladeTitelVergleich } = await import('@/lib/portfolio-analyse/titel-vergleich-server')
    const body = (await req.json()) as {
      titel?: Array<{ isin?: string | null; symbolYahoo?: string | null; name?: string | null }>
    }
    const titel = Array.isArray(body.titel) ? body.titel : []
    const paket = await ladeTitelVergleich(titel)
    return NextResponse.json(paket)
  } catch (e) {
    console.error('titel-vergleich', e)
    return NextResponse.json(
      { ok: false, spalten: [], zeilen: [], geladenAm: new Date().toISOString(), fehler: e instanceof Error ? e.message : 'Fehler' },
      { status: 500 },
    )
  }
}

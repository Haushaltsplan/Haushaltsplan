import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 })
    }

    const row = body as Record<string, unknown>
    const etfs = Array.isArray(row.etfs)
      ? (row.etfs as Array<{ isin?: string; symbolYahoo?: string | null }>)
      : []

    const { ladeEtfBreakdownsBatch } = await import('@/lib/portfolio-analyse/etf-breakdown-server')
    const breakdowns = await ladeEtfBreakdownsBatch(
      etfs.map((e) => ({
        isin: e.isin != null ? String(e.isin) : '',
        symbolYahoo: e.symbolYahoo != null ? String(e.symbolYahoo) : null,
      })),
    )

    return NextResponse.json({ ok: true, breakdowns })
  } catch (e) {
    console.error('etf-breakdown', e)
    return NextResponse.json(
      { ok: false, fehler: e instanceof Error ? e.message : 'Abruf fehlgeschlagen' },
      { status: 500 },
    )
  }
}

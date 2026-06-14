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
    const symbols = Array.isArray(row.symbols)
      ? row.symbols.map((s) => String(s).trim()).filter(Boolean)
      : []

    if (symbols.length === 0) {
      return NextResponse.json({ ok: true, sectors: {} })
    }

    const { holeSektorenFuerSymbole } = await import(
      '@/lib/portfolio-analyse/etf-scraper/yahoo-sector-enrichment-server'
    )
    const sectors = await holeSektorenFuerSymbole(symbols.slice(0, 80))

    return NextResponse.json({ ok: true, sectors })
  } catch (e) {
    console.error('portfolio-analyse/sektor', e)
    return NextResponse.json(
      { ok: false, fehler: e instanceof Error ? e.message : 'Abruf fehlgeschlagen' },
      { status: 500 },
    )
  }
}

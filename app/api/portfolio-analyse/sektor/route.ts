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

    if (Array.isArray(row.items)) {
      const items = (row.items as Array<{ isin?: string; symbolYahoo?: string; name?: string }>).map((e) => ({
        isin: e.isin != null ? String(e.isin).trim() || null : null,
        symbolYahoo: e.symbolYahoo != null ? String(e.symbolYahoo).trim() || null : null,
        name: e.name != null ? String(e.name).trim() || null : null,
      }))
      const { holeSektorenBatch } = await import('@/lib/portfolio-analyse/sektor-batch-server')
      const sektoren = await holeSektorenBatch(items)
      return NextResponse.json({ ok: true, sektoren })
    }

    const symbols = Array.isArray(row.symbols)
      ? row.symbols.map((s) => String(s).trim()).filter(Boolean)
      : []

    if (symbols.length === 0) {
      return NextResponse.json({ ok: true, sectors: {}, sektoren: {} })
    }

    const { holeSektorenBatch } = await import('@/lib/portfolio-analyse/sektor-batch-server')
    const sektoren = await holeSektorenBatch(
      symbols.slice(0, 80).map((symbolYahoo) => ({ symbolYahoo })),
    )

    const sectors: Record<string, string> = {}
    for (const [sym, entry] of Object.entries(sektoren)) {
      const label = entry.sektor ?? entry.branche
      if (label) sectors[sym] = label
    }

    return NextResponse.json({ ok: true, sectors, sektoren })
  } catch (e) {
    console.error('portfolio-analyse/sektor', e)
    return NextResponse.json(
      { ok: false, fehler: e instanceof Error ? e.message : 'Abruf fehlgeschlagen' },
      { status: 500 },
    )
  }
}

import { NextResponse } from 'next/server'
import { kursFuerSymbol, ladeYahooKurse } from '@/lib/portfolio-analyse/yahoo-kurse-server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const raw = (body as { symbols?: unknown })?.symbols
  if (!Array.isArray(raw)) {
    return NextResponse.json({ ok: false, message: 'symbols[] erwartet.' }, { status: 400 })
  }

  const symbols = [...new Set(raw.map((s) => String(s).trim()).filter(Boolean))].slice(0, 60)
  if (symbols.length === 0) {
    return NextResponse.json({ ok: true, kurse: {}, stand: new Date().toISOString() })
  }

  try {
    const map = await ladeYahooKurse(symbols)
    const kurse: Record<string, { preis: number | null; aenderungTagProzent: number | null }> = {}
    for (const sym of symbols) {
      const hit = kursFuerSymbol(map, sym)
      if (hit) kurse[sym] = hit
    }
    return NextResponse.json({ ok: true, kurse, stand: new Date().toISOString() })
  } catch (e) {
    console.error('portfolio kurse', e)
    return NextResponse.json({ ok: false, message: 'Kursabfrage fehlgeschlagen.' }, { status: 502 })
  }
}

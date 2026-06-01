import { NextResponse } from 'next/server'
import { teileArray } from '@/lib/portfolio-analyse/batch-hilfen'
import { kursFuerSymbol, ladeYahooKurse, type YahooKursZeile } from '@/lib/portfolio-analyse/yahoo-kurse-server'

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

  const symbols = [...new Set(raw.map((s) => String(s).trim()).filter(Boolean))].slice(0, 200)
  if (symbols.length === 0) {
    return NextResponse.json({ ok: true, kurse: {}, stand: new Date().toISOString() })
  }

  try {
    const map = new Map<string, YahooKursZeile>()
    for (const batch of teileArray(symbols, 80)) {
      const part = await ladeYahooKurse(batch)
      for (const [k, v] of part) map.set(k, v)
    }
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

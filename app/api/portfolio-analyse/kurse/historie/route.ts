import { NextResponse } from 'next/server'
import { ladeYahooHistorieBatchTaeglich } from '@/lib/portfolio-analyse/yahoo-historie-server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const raw = (body as { symbols?: unknown })?.symbols
  const vonDatum = String((body as { vonDatum?: string })?.vonDatum ?? '').trim()
  const bisDatum = String((body as { bisDatum?: string })?.bisDatum ?? '').trim()

  if (!Array.isArray(raw) || !vonDatum || !bisDatum) {
    return NextResponse.json(
      { ok: false, message: 'symbols[], vonDatum und bisDatum erwartet.' },
      { status: 400 },
    )
  }

  const symbols = [...new Set(raw.map((s) => String(s).trim()).filter(Boolean))].slice(0, 60)
  if (symbols.length === 0) {
    return NextResponse.json({ ok: true, serien: {}, stand: new Date().toISOString() })
  }

  try {
    const serienMap = await ladeYahooHistorieBatchTaeglich(symbols, vonDatum, bisDatum)
    const serien: Record<string, Record<string, number>> = {}
    for (const [sym, tage] of serienMap) {
      serien[sym] = Object.fromEntries(tage)
    }

    return NextResponse.json({
      ok: true,
      serien,
      stand: new Date().toISOString(),
    })
  } catch (e) {
    console.error('portfolio historie', e)
    return NextResponse.json({ ok: false, message: 'Kurshistorie fehlgeschlagen.' }, { status: 502 })
  }
}

import { NextResponse } from 'next/server'
import { ladeYahooHistorieBatch } from '@/lib/portfolio-analyse/yahoo-historie-server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const raw = (body as { symbols?: unknown; vonMonat?: unknown; bisMonat?: unknown })?.symbols
  const vonMonat = String((body as { vonMonat?: string })?.vonMonat ?? '').trim()
  const bisMonat = String((body as { bisMonat?: string })?.bisMonat ?? '').trim()

  if (!Array.isArray(raw) || !vonMonat || !bisMonat) {
    return NextResponse.json(
      { ok: false, message: 'symbols[], vonMonat und bisMonat erwartet.' },
      { status: 400 },
    )
  }

  const symbols = [...new Set(raw.map((s) => String(s).trim()).filter(Boolean))].slice(0, 60)
  if (symbols.length === 0) {
    return NextResponse.json({ ok: true, serien: {}, stand: new Date().toISOString() })
  }

  try {
    const serienMap = await ladeYahooHistorieBatch(symbols, vonMonat, bisMonat)
    const serien: Record<string, Record<string, number>> = {}
    for (const [sym, monate] of serienMap) {
      serien[sym] = Object.fromEntries(monate)
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

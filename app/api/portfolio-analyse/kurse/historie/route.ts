import { NextResponse } from 'next/server'
import { mergeKursHistorie } from '@/lib/portfolio-analyse/kurs-historie-merge'
import { ladeStooqHistorieBatchTaeglich } from '@/lib/portfolio-analyse/stooq-historie-server'
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
  const rawStooq = (body as { stooqSymbols?: unknown })?.stooqSymbols
  const vonDatum = String((body as { vonDatum?: string })?.vonDatum ?? '').trim()
  const bisDatum = String((body as { bisDatum?: string })?.bisDatum ?? '').trim()

  if (!Array.isArray(raw) || !vonDatum || !bisDatum) {
    return NextResponse.json(
      { ok: false, message: 'symbols[], vonDatum und bisDatum erwartet.' },
      { status: 400 },
    )
  }

  const symbols = [...new Set(raw.map((s) => String(s).trim()).filter(Boolean))].slice(0, 60)
  const stooqSymbols = Array.isArray(rawStooq)
    ? [...new Set(rawStooq.map((s) => String(s).trim().toLowerCase()).filter(Boolean))].slice(0, 40)
    : []

  if (symbols.length === 0 && stooqSymbols.length === 0) {
    return NextResponse.json({ ok: true, serien: {}, stand: new Date().toISOString() })
  }

  try {
    const yahooMap =
      symbols.length > 0
        ? await ladeYahooHistorieBatchTaeglich(symbols, vonDatum, bisDatum)
        : new Map<string, Map<string, number>>()
    const stooqMap =
      stooqSymbols.length > 0
        ? await ladeStooqHistorieBatchTaeglich(stooqSymbols, vonDatum, bisDatum)
        : new Map<string, Map<string, number>>()
    const serienMap = mergeKursHistorie(yahooMap, stooqMap)
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

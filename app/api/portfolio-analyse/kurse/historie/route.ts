import { NextResponse } from 'next/server'
import { teileArray } from '@/lib/portfolio-analyse/batch-hilfen'
import { FX_SYMBOLE } from '@/lib/portfolio-analyse/kurs-aufloesung'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { lookupIsinMetadaten } from '@/lib/portfolio-analyse/isin-lookup-server'
import { mergeKursHistorieMitStooqAliase } from '@/lib/portfolio-analyse/kurs-historie-merge'
import { ladeStooqHistorieBatchTaeglich, yahooZuStooqSymbol } from '@/lib/portfolio-analyse/stooq-historie-server'
import { ladeYahooHistorieBatchTaeglich } from '@/lib/portfolio-analyse/yahoo-historie-server'

export const dynamic = 'force-dynamic'

function normIsin(s: string): string | null {
  const x = s.trim().toUpperCase()
  return /^[A-Z]{2}[A-Z0-9]{10}$/.test(x) ? x : null
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const raw = (body as { symbols?: unknown })?.symbols
  const rawStooq = (body as { stooqSymbols?: unknown })?.stooqSymbols
  const rawIsins = (body as { isins?: unknown })?.isins
  const vonDatum = String((body as { vonDatum?: string })?.vonDatum ?? '').trim()
  const bisDatum = String((body as { bisDatum?: string })?.bisDatum ?? '').trim()

  if (!Array.isArray(raw) || !vonDatum || !bisDatum) {
    return NextResponse.json(
      { ok: false, message: 'symbols[], vonDatum und bisDatum erwartet.' },
      { status: 400 },
    )
  }

  const symbolSet = new Set<string>()
  for (const s of raw) {
    const sym = String(s).trim().toUpperCase()
    if (sym && !sym.startsWith('STOOQ:')) symbolSet.add(sym)
  }

  const isins = Array.isArray(rawIsins)
    ? [...new Set(rawIsins.map((x) => normIsin(String(x))).filter((x): x is string => Boolean(x)))].slice(0, 200)
    : []

  if (isins.length > 0) {
    const meta = await lookupIsinMetadaten(isins)
    for (const m of meta) {
      if (m.symbolYahoo) symbolSet.add(m.symbolYahoo.trim().toUpperCase())
      for (const c of m.symbolCandidates ?? []) {
        const sym = c.trim().toUpperCase()
        if (sym) symbolSet.add(sym)
      }
      const k = isinKenntnis(m.isin)
      if (k?.kursNurSymbol) symbolSet.add(k.kursNurSymbol.trim().toUpperCase())
    }
  }

  for (const fx of FX_SYMBOLE) symbolSet.add(fx)

  const symbols = [...symbolSet]
  const stooqSet = new Set<string>()
  if (Array.isArray(rawStooq)) {
    for (const s of rawStooq) {
      const st = String(s).trim().toLowerCase()
      if (st) stooqSet.add(st)
    }
  }
  for (const sym of symbols) {
    const st = yahooZuStooqSymbol(sym)
    if (st) stooqSet.add(st)
  }
  for (const isin of isins) {
    const k = isinKenntnis(isin)
    if (k?.stooqSymbol) stooqSet.add(k.stooqSymbol.trim().toLowerCase())
  }
  const stooqSymbols = [...stooqSet]

  if (symbols.length === 0 && stooqSymbols.length === 0) {
    return NextResponse.json({ ok: true, serien: {}, stand: new Date().toISOString() })
  }

  try {
    const yahooMap = new Map<string, Map<string, number>>()
    for (const batch of teileArray(symbols, 40)) {
      const part = await ladeYahooHistorieBatchTaeglich(batch, vonDatum, bisDatum)
      for (const [sym, serie] of part) yahooMap.set(sym, serie)
    }

    const stooqMap = new Map<string, Map<string, number>>()
    for (const batch of teileArray(stooqSymbols, 30)) {
      const part = await ladeStooqHistorieBatchTaeglich(batch, vonDatum, bisDatum)
      for (const [sym, serie] of part) stooqMap.set(sym, serie)
    }

    const serienMap = mergeKursHistorieMitStooqAliase(yahooMap, stooqMap, symbols)
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

import { NextResponse } from 'next/server'
import { ladeFondsKurseNachIsin } from '@/lib/finanz-fonds-kurs-server'
import { ISIN_MUSTER } from '@/lib/finanz-vermoegen'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const raw = (body as { isins?: unknown })?.isins
  if (!Array.isArray(raw)) {
    return NextResponse.json({ ok: false, message: 'isins[] erwartet.' }, { status: 400 })
  }

  const isins = [...new Set(raw.map((x) => String(x).trim().toUpperCase()).filter((s) => ISIN_MUSTER.test(s)))].slice(
    0,
    20,
  )
  if (isins.length === 0) {
    return NextResponse.json({ ok: true, kurse: [] })
  }

  try {
    const kurse = await ladeFondsKurseNachIsin(isins)
    return NextResponse.json({ ok: true, kurse })
  } catch (e) {
    console.error('[fonds-kurs]', e)
    return NextResponse.json({ ok: false, message: 'Fonds-Kursabfrage fehlgeschlagen.' }, { status: 502 })
  }
}

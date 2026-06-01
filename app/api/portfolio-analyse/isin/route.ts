import { NextResponse } from 'next/server'
import { lookupIsinMetadaten } from '@/lib/portfolio-analyse/isin-lookup-server'

export const dynamic = 'force-dynamic'

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/

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

  const isins = [
    ...new Set(
      raw
        .map((x) => String(x).trim().toUpperCase())
        .filter((s) => ISIN_RE.test(s)),
    ),
  ].slice(0, 120)

  if (isins.length === 0) {
    return NextResponse.json({ ok: true, metadaten: [] })
  }

  try {
    const metadaten = await lookupIsinMetadaten(isins)
    return NextResponse.json({ ok: true, metadaten })
  } catch (e) {
    console.error('isin lookup', e)
    return NextResponse.json({ ok: false, message: 'ISIN-Abfrage fehlgeschlagen.' }, { status: 502 })
  }
}

import { NextResponse } from 'next/server'
import { lookupOpenFoodFacts } from '@/lib/open-food-facts'

export const runtime = 'nodejs'

/** Barcode → Produktname + vorgeschlagene Warengruppe (Open Food Facts). */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code') || url.searchParams.get('barcode') || ''
  if (!code.trim()) {
    return NextResponse.json({ error: 'Parameter code fehlt.' }, { status: 400 })
  }

  try {
    const treffer = await lookupOpenFoodFacts(code)
    if (!treffer) {
      return NextResponse.json({ gefunden: false })
    }
    return NextResponse.json({ gefunden: true, produkt: treffer })
  } catch (e) {
    console.error('barcode-lookup', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Lookup fehlgeschlagen.' },
      { status: 502 },
    )
  }
}

import { NextResponse } from 'next/server'
import {
  istGueltigeIsinEingabe,
  loeseAktieAusSuche,
  sucheAktien,
} from '@/lib/portfolio-analyse/aktien-suche-server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const b = body as { query?: unknown; symbol?: unknown; name?: unknown }

  const symbol = typeof b.symbol === 'string' ? b.symbol.trim() : ''
  if (symbol) {
    try {
      const aufgeloest = await loeseAktieAusSuche(symbol, typeof b.name === 'string' ? b.name : undefined)
      if (!aufgeloest) {
        return NextResponse.json({ ok: false, message: 'Aktie nicht gefunden.' }, { status: 404 })
      }
      return NextResponse.json({ ok: true, meta: aufgeloest.meta, isin: aufgeloest.isin })
    } catch (e) {
      console.error('aktien-suche aufloesen', e)
      return NextResponse.json({ ok: false, message: 'Auflösung fehlgeschlagen.' }, { status: 502 })
    }
  }

  const query = typeof b.query === 'string' ? b.query.trim() : ''
  if (query.length < 2) {
    return NextResponse.json({ ok: false, message: 'Mindestens 2 Zeichen eingeben.' }, { status: 400 })
  }

  if (istGueltigeIsinEingabe(query)) {
    return NextResponse.json({
      ok: true,
      treffer: [{ symbol: query, name: query, exchange: null, sector: null }],
      istIsin: true,
    })
  }

  try {
    const treffer = await sucheAktien(query)
    return NextResponse.json({ ok: true, treffer })
  } catch (e) {
    console.error('aktien-suche', e)
    return NextResponse.json({ ok: false, message: 'Suche fehlgeschlagen.' }, { status: 502 })
  }
}

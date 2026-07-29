import { NextResponse } from 'next/server'
import { generiereNewsTerminalKiFazite } from '@/lib/portfolio-analyse/news-terminal-ki-fazit-server'
import type { NewsTerminalZeile } from '@/lib/portfolio-analyse/portfolio-news-terminal-types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Pro Client-Batch (ca. 6 Titel) — genug Headlines, ohne Riesen-Payload. */
const MAX_ZEILEN = 120

function parseZeilen(raw: unknown): NewsTerminalZeile[] {
  if (!Array.isArray(raw)) return []
  const out: NewsTerminalZeile[] = []
  for (const row of raw.slice(0, MAX_ZEILEN)) {
    const r = row as Record<string, unknown>
    const titel = String(r.titel ?? '').trim()
    if (!titel) continue
    const unternehmenRaw = Array.isArray(r.unternehmen) ? r.unternehmen : []
    const unternehmen = unternehmenRaw
      .map((u) => {
        const x = u as Record<string, unknown>
        const name = String(x.name ?? '').trim()
        const symbol = x.symbol != null ? String(x.symbol).trim().toUpperCase() || null : null
        const isin = x.isin != null ? String(x.isin).trim().toUpperCase() || null : null
        const id = String(x.id ?? isin ?? symbol ?? name).trim()
        if (!id || !name) return null
        return { id, name, symbol, isin }
      })
      .filter(Boolean) as NewsTerminalZeile['unternehmen']

    out.push({
      id: String(r.id ?? `${titel}-${out.length}`),
      titel,
      href: String(r.href ?? '#'),
      quelle: String(r.quelle ?? 'News'),
      veroeffentlichtAm: r.veroeffentlichtAm != null ? String(r.veroeffentlichtAm) : null,
      unternehmen,
      kategorie: (r.kategorie as NewsTerminalZeile['kategorie']) || 'sonstiges',
      istHeute: r.istHeute === true,
    })
  }
  return out
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const b = body as { zeilen?: unknown; nurHeute?: boolean }
  const zeilen = parseZeilen(b.zeilen)
  if (zeilen.length === 0) {
    return NextResponse.json({ ok: false, message: 'Keine Meldungen zum Zusammenfassen.' }, { status: 400 })
  }

  try {
    const paket = await generiereNewsTerminalKiFazite({
      zeilen,
      nurHeute: b.nurHeute === true,
    })
    return NextResponse.json({ ok: true, ...paket })
  } catch (e) {
    console.error('news-terminal summary', e)
    return NextResponse.json(
      { ok: false, message: 'KI-Zusammenfassung fehlgeschlagen.' },
      { status: 502 },
    )
  }
}

import { NextResponse } from 'next/server'
import type { DepotPositionAnfrage } from '@/lib/portfolio-analyse/ankuendigte-dividenden'
import { berechneAnkuendigteEarningsDepot } from '@/lib/portfolio-analyse/ankuendigte-earnings'

export const dynamic = 'force-dynamic'
/** DivvyDiary-Scrape: seriell, ~3–5 s pro ISIN. */
export const maxDuration = 300

const MAX_POSITIONEN = 80

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const raw = (body as { positionen?: unknown })?.positionen
  if (!Array.isArray(raw)) {
    return NextResponse.json({ ok: false, message: 'positionen[] erwartet.' }, { status: 400 })
  }

  const positionen: DepotPositionAnfrage[] = raw
    .slice(0, MAX_POSITIONEN)
    .map((p) => {
      const row = p as Record<string, unknown>
      const symCands = row.symbolCandidates
      return {
        isin: row.isin != null ? String(row.isin).trim() || null : null,
        name: String(row.name ?? 'Wertpapier').trim() || 'Wertpapier',
        stueck: Number(row.stueck) || 0,
        symbolYahoo: row.symbolYahoo != null ? String(row.symbolYahoo).trim() || null : null,
        symbolCandidates: Array.isArray(symCands)
          ? symCands.map((s) => String(s).trim()).filter(Boolean)
          : undefined,
      }
    })
    .filter((p) => p.stueck > 0)

  try {
    const ergebnis = await berechneAnkuendigteEarningsDepot(positionen)
    return NextResponse.json({
      ok: true,
      stand: new Date().toISOString(),
      ...ergebnis,
    })
  } catch (e) {
    console.error('ankuendig earnings', e)
    return NextResponse.json(
      { ok: false, message: 'Abruf der Quartalstermine fehlgeschlagen.' },
      { status: 502 },
    )
  }
}

import { NextResponse } from 'next/server'
import type { DepotPositionAnfrage } from '@/lib/portfolio-analyse/ankuendigte-dividenden'
import { baueEarningsBriefingDepot } from '@/lib/portfolio-analyse/earnings-briefing-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_POSITIONEN = 80

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const raw = body as { positionen?: unknown; horizonTage?: unknown }
  if (!Array.isArray(raw.positionen)) {
    return NextResponse.json({ ok: false, message: 'positionen[] erwartet.' }, { status: 400 })
  }

  const horizonTage =
    typeof raw.horizonTage === 'number' && raw.horizonTage > 0 && raw.horizonTage <= 30
      ? Math.round(raw.horizonTage)
      : 7

  const positionen: DepotPositionAnfrage[] = raw.positionen
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
    const ergebnis = await baueEarningsBriefingDepot(positionen, { horizonTage })
    return NextResponse.json({
      ok: true,
      stand: new Date().toISOString(),
      ...ergebnis,
    })
  } catch (e) {
    console.error('earnings briefing-tag', e)
    return NextResponse.json(
      { ok: false, message: 'Earnings-Briefing fehlgeschlagen.' },
      { status: 502 },
    )
  }
}

import { NextResponse } from 'next/server'

import { findeGuenstigstesAngebot, volleBezeichnung } from '@/lib/angebote/einkaufsliste'
import { normalisierePlz } from '@/lib/angebote/http'
import { marktguruSuche } from '@/lib/angebote/marktguru'
import type { Angebot, HaendlerId } from '@/lib/angebote/types'
import { HAENDLER_IDS, HAENDLER_LABELS } from '@/lib/angebote/types'
import { jsonMitOwner } from '@/lib/request-owner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Sucht zu einem Freitext (z. B. „Butter“) je Supermarkt das günstigste Angebot
 * und liefert volle Bezeichnung + Marke + Bild.
 */
export async function POST(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Ungültiges JSON.' }, { status: 400 })
    }
    const roh = body as { plz?: unknown; q?: unknown; haendler?: unknown }
    const plz = normalisierePlz(typeof roh.plz === 'string' ? roh.plz : '')
    const q = typeof roh.q === 'string' ? roh.q.trim() : ''
    if (!plz) {
      return NextResponse.json({ ok: false, error: 'PLZ ungültig.' }, { status: 400 })
    }
    if (q.length < 2) {
      return NextResponse.json({ ok: false, error: 'Suchbegriff zu kurz.' }, { status: 400 })
    }
    const haendler = Array.isArray(roh.haendler)
      ? roh.haendler.filter((h): h is HaendlerId =>
          typeof h === 'string' && (HAENDLER_IDS as readonly string[]).includes(h),
        )
      : undefined

    let angebote: Angebot[] = []
    try {
      angebote = await marktguruSuche({ query: q, plz, limit: 300, allowed: haendler })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ ok: false, error: msg }, { status: 502 })
    }

    const targets =
      haendler?.length ?? 0
        ? haendler!
        : ([...new Set(angebote.map((a) => a.haendler))] as HaendlerId[])

    const proHaendler = targets.map((h) => {
      const best = findeGuenstigstesAngebot(q, angebote, h)
      return {
        haendler: h,
        label: HAENDLER_LABELS[h] ?? h,
        angebot: best,
        bezeichnung: best ? volleBezeichnung(best) : null,
        marke: best?.marke ?? null,
        preisEur: best?.preisEur ?? null,
        bildUrl: best?.bildUrl ?? null,
      }
    })

    return {
      ok: true as const,
      q,
      plz,
      anzahlKandidaten: angebote.length,
      angebote,
      proHaendler,
    }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}

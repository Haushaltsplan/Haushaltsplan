import { NextResponse } from 'next/server'

import { volleBezeichnung, suchvarianten } from '@/lib/angebote/einkaufsliste'
import { normalisierePlz } from '@/lib/angebote/http'
import { marktguruSuche } from '@/lib/angebote/marktguru'
import { findeGuenstigstesAngebot } from '@/lib/angebote/produkt-match'
import type { Angebot, HaendlerId } from '@/lib/angebote/types'
import { HAENDLER_IDS, HAENDLER_LABELS } from '@/lib/angebote/types'
import { jsonMitOwner } from '@/lib/request-owner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Sucht zu einem Freitext (z. B. „Butter“ / „Bananen“) je Supermarkt
 * das günstigste korrekt passende Angebot (Wortgrenzen, Eigenmarken).
 */
export async function POST(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Ungültiges JSON.' }, { status: 400 })
    }
    const roh = body as { plz?: unknown; q?: unknown; haendler?: unknown; queries?: unknown }
    const plz = normalisierePlz(typeof roh.plz === 'string' ? roh.plz : '')
    const q = typeof roh.q === 'string' ? roh.q.trim() : ''
    const batchQueries = Array.isArray(roh.queries)
      ? roh.queries.filter((x): x is string => typeof x === 'string' && x.trim().length >= 2)
      : q
        ? [q]
        : []
    if (!plz) {
      return NextResponse.json({ ok: false, error: 'PLZ ungültig.' }, { status: 400 })
    }
    if (!batchQueries.length) {
      return NextResponse.json({ ok: false, error: 'Suchbegriff zu kurz.' }, { status: 400 })
    }
    const haendler = Array.isArray(roh.haendler)
      ? roh.haendler.filter((h): h is HaendlerId =>
          typeof h === 'string' && (HAENDLER_IDS as readonly string[]).includes(h),
        )
      : undefined

    const seen = new Set<string>()
    const angebote: Angebot[] = []
    const suchworte = new Set<string>()
    for (const query of batchQueries) {
      for (const v of suchvarianten(query)) suchworte.add(v)
    }

    for (const wort of suchworte) {
      try {
        const batch = await marktguruSuche({
          query: wort,
          plz,
          limit: 250,
          allowed: haendler,
        })
        for (const a of batch) {
          if (seen.has(a.id)) continue
          seen.add(a.id)
          angebote.push(a)
        }
      } catch (e) {
        console.warn(`[angebote:produktsuche] ${wort}:`, e)
      }
    }

    const targets: HaendlerId[] =
      haendler && haendler.length
        ? haendler
        : ([...new Set(angebote.map((a) => a.haendler))] as HaendlerId[])

    const ergebnisse = batchQueries.map((query) => {
      const proHaendler = targets.map((h) => {
        const best = findeGuenstigstesAngebot(query, angebote, h)
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
      return { q: query, proHaendler }
    })

    return {
      ok: true as const,
      plz,
      anzahlKandidaten: angebote.length,
      angebote,
      ergebnisse,
      // Rückwärtskompatibel für Einzel-Suche
      q: batchQueries[0],
      proHaendler: ergebnisse[0]?.proHaendler ?? [],
    }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}

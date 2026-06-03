'use client'

import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import type { AnkuendigteDividendenErgebnis } from '@/lib/portfolio-analyse/ankuendigte-dividenden'

export async function ladeAnkuendigteDividendenDepot(
  positionen: LivePosition[],
  meta: Map<string, IsinMetadata>,
): Promise<AnkuendigteDividendenErgebnis | null> {
  const payload = positionen
    .filter((p) => p.stueck > 0)
    .map((p) => {
      const m = p.isin ? meta.get(p.isin) : undefined
      return {
        isin: p.isin,
        name: p.anzeigeName ?? p.name,
        stueck: p.stueck,
        symbolYahoo: p.symbolYahoo ?? m?.symbolYahoo ?? null,
        symbolCandidates: m?.symbolCandidates,
      }
    })

  if (payload.length === 0) {
    return {
      monate: [],
      eintraege: [],
      hinweise: ['Keine offenen Positionen im Depot.'],
      abgefragteSymbole: 0,
      treffer: 0,
    }
  }

  const res = await fetch('/api/portfolio-analyse/dividenden/ankuendig', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ positionen: payload }),
  })
  const j = (await res.json()) as AnkuendigteDividendenErgebnis & {
    ok?: boolean
    message?: string
  }
  if (!res.ok || j.ok === false) {
    throw new Error(j.message ?? 'Abruf fehlgeschlagen')
  }
  return {
    monate: j.monate ?? [],
    eintraege: j.eintraege ?? [],
    hinweise: j.hinweise ?? [],
    abgefragteSymbole: j.abgefragteSymbole ?? 0,
    treffer: j.treffer ?? 0,
  }
}

'use client'

import type { EarningsSchaetzungen } from '@/lib/portfolio-analyse/earnings-schaetzungen'
import type { AnkuendigtesEarningsEintrag } from '@/lib/portfolio-analyse/ankuendigte-earnings'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'

export async function ladeEarningsSchaetzungenFuerEintrag(
  eintrag: AnkuendigtesEarningsEintrag,
  meta: Map<string, IsinMetadata>,
): Promise<EarningsSchaetzungen | null> {
  const isin = eintrag.isin?.trim().toUpperCase() ?? ''
  const m = isin.length >= 10 ? meta.get(isin) : undefined
  const k = isin.length >= 10 ? isinKenntnis(isin) : null

  const res = await fetch('/api/portfolio-analyse/earnings/schaetzungen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      isin: eintrag.isin,
      name: eintrag.name,
      symbolYahoo: eintrag.symbol ?? k?.symbolYahoo ?? m?.symbolYahoo ?? null,
      symbolCandidates: k?.symbolCandidates ?? m?.symbolCandidates,
      terminDatumIso: eintrag.terminDatumIso,
    }),
    signal: AbortSignal.timeout(25_000),
  })

  const j = (await res.json()) as { ok?: boolean; schaetzungen?: EarningsSchaetzungen | null; message?: string }
  if (!res.ok || j.ok === false) {
    throw new Error(j.message ?? 'Prognosen konnten nicht geladen werden.')
  }
  return j.schaetzungen ?? null
}

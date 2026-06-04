'use client'

import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'
import { isinAusYahooSymbol, isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import type { AnkuendigteEarningsErgebnis } from '@/lib/portfolio-analyse/ankuendigte-earnings'

const LS_KEY = 'pa-earnings-kalender-v1'
const LS_MAX_AGE_MS = 6 * 60 * 60 * 1000

function depotKeyAusPayload(
  payload: { isin: string | null; stueck: number }[],
): string {
  return payload
    .map((p) => `${(p.isin ?? '').toUpperCase()}:${p.stueck}`)
    .sort()
    .join('|')
}

function leseLocalCache(depotKey: string): AnkuendigteEarningsErgebnis | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const j = JSON.parse(raw) as AnkuendigteEarningsErgebnis & { depotKey?: string; cachedAt?: number }
    if (j.depotKey !== depotKey || !j.cachedAt || Date.now() - j.cachedAt > LS_MAX_AGE_MS) return null
    return j
  } catch {
    return null
  }
}

function schreibeLocalCache(depotKey: string, daten: AnkuendigteEarningsErgebnis): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ ...daten, depotKey, cachedAt: Date.now() }),
    )
  } catch {
    /* Speicher voll */
  }
}

/** Sofort aus Browser-Cache (Anzeige), danach API-Aktualisierung. */
export function ladeAnkuendigteEarningsDepotAusLocalCache(
  positionen: LivePosition[],
  meta: Map<string, IsinMetadata>,
): AnkuendigteEarningsErgebnis | null {
  const payload = positionen
    .filter((p) => p.stueck > 0)
    .map((p) => {
      let isin = p.isin?.trim().toUpperCase() ?? ''
      if (isin.length < 10) isin = isinAusYahooSymbol(p.symbolYahoo) ?? ''
      return { isin: isin.length >= 10 ? isin : p.isin, stueck: p.stueck }
    })
  return leseLocalCache(depotKeyAusPayload(payload))
}

export async function ladeAnkuendigteEarningsDepot(
  positionen: LivePosition[],
  meta: Map<string, IsinMetadata>,
): Promise<AnkuendigteEarningsErgebnis | null> {
  const payload = positionen
    .filter((p) => p.stueck > 0)
    .map((p) => {
      let isin = p.isin?.trim().toUpperCase() ?? ''
      if (isin.length < 10) isin = isinAusYahooSymbol(p.symbolYahoo) ?? ''
      if (isin.length < 10 && p.symbolYahoo) {
        const sym = p.symbolYahoo.toUpperCase()
        for (const [metaIsin, metaRow] of meta) {
          if (metaRow.symbolYahoo?.toUpperCase() === sym) {
            isin = metaIsin
            break
          }
        }
      }
      const m = isin.length >= 10 ? meta.get(isin) : undefined
      const k = isin.length >= 10 ? isinKenntnis(isin) : null
      return {
        isin: isin.length >= 10 ? isin : p.isin,
        name: p.anzeigeName ?? p.name,
        stueck: p.stueck,
        symbolYahoo: p.symbolYahoo ?? k?.symbolYahoo ?? m?.symbolYahoo ?? null,
        symbolCandidates: k?.symbolCandidates ?? m?.symbolCandidates,
      }
    })

  if (payload.length === 0) {
    return {
      monate: [],
      eintraege: [],
      hinweise: ['Keine offenen Positionen im Depot.'],
      abgefragtePositionen: 0,
      treffer: 0,
      statistik: { yahoo: 0, finnhub: 0, divvydiary: 0, prognose: 0, ohneTreffer: 0 },
    }
  }

  const res = await fetch('/api/portfolio-analyse/earnings/ankuendig', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ positionen: payload }),
    signal: AbortSignal.timeout(280_000),
  })
  const j = (await res.json()) as AnkuendigteEarningsErgebnis & {
    ok?: boolean
    message?: string
  }
  if (!res.ok || j.ok === false) {
    throw new Error(j.message ?? 'Abruf fehlgeschlagen')
  }
  const ergebnis: AnkuendigteEarningsErgebnis = {
    monate: j.monate ?? [],
    eintraege: j.eintraege ?? [],
    hinweise: j.hinweise ?? [],
    abgefragtePositionen: j.abgefragtePositionen ?? 0,
    treffer: j.treffer ?? 0,
    statistik: j.statistik ?? { yahoo: 0, finnhub: 0, divvydiary: 0, prognose: 0, ohneTreffer: 0 },
  }
  schreibeLocalCache(depotKeyAusPayload(payload), ergebnis)
  return ergebnis
}

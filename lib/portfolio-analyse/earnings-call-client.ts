'use client'

import type { EarningsCallAnfrage, EarningsCallPaket } from '@/lib/portfolio-analyse/earnings-call-types'

const LS_KEY = 'pa-earnings-call-v2'
const LS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function cacheKey(anfrage: EarningsCallAnfrage): string {
  return anfrage.ticker.trim().toUpperCase()
}

function mergePakete(prev: EarningsCallPaket | null, next: EarningsCallPaket): EarningsCallPaket {
  if (!prev?.quartale.length) return next
  const summaryById = new Map(next.quartale.map((q) => [q.id, q.zusammenfassung]))
  const mergedQuartale = next.quartale.map((q) => ({
    ...q,
    zusammenfassung: q.zusammenfassung ?? prev.quartale.find((p) => p.id === q.id)?.zusammenfassung ?? null,
  }))
  for (const p of prev.quartale) {
    if (!mergedQuartale.some((q) => q.id === p.id) && p.zusammenfassung) {
      mergedQuartale.push(p)
    }
  }
  for (const q of mergedQuartale) {
    if (!q.zusammenfassung && summaryById.get(q.id)) {
      q.zusammenfassung = summaryById.get(q.id) ?? null
    }
  }
  return { ...next, quartale: mergedQuartale }
}

export function ladeEarningsCallAusLocalCache(anfrage: EarningsCallAnfrage): EarningsCallPaket | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const j = JSON.parse(raw) as EarningsCallPaket & { cacheKey?: string; cachedAt?: number }
    if (j.cacheKey !== cacheKey(anfrage) || !j.cachedAt || Date.now() - j.cachedAt > LS_MAX_AGE_MS) return null
    if (!j.ok || !j.quartale?.length) return null
    return j
  } catch {
    return null
  }
}

function schreibeLocalCache(anfrage: EarningsCallAnfrage, daten: EarningsCallPaket, prev?: EarningsCallPaket | null): void {
  if (typeof window === 'undefined' || !daten.quartale.length) return
  const merged = mergePakete(prev ?? null, daten)
  if (!merged.ok && !merged.quartale.length) return
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ ...merged, ok: true, cacheKey: cacheKey(anfrage), cachedAt: Date.now() }),
    )
  } catch {
    /* voll */
  }
}

export async function ladeEarningsCallClient(
  anfrage: EarningsCallAnfrage & { isin?: string | null },
  prev?: EarningsCallPaket | null,
): Promise<EarningsCallPaket> {
  const res = await fetch('/api/portfolio-analyse/earnings-call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticker: anfrage.ticker,
      firmenname: anfrage.firmenname,
      isin: anfrage.isin,
      force: anfrage.force,
      quartalId: anfrage.quartalId,
    }),
  })
  const j = (await res.json()) as EarningsCallPaket & { message?: string }
  if (!res.ok && !j.ticker && !j.quartale?.length) {
    throw new Error(j.fehler ?? j.message ?? 'Earnings Call konnte nicht geladen werden.')
  }
  const merged = mergePakete(prev ?? null, j)
  if (merged.quartale.length) schreibeLocalCache(anfrage, merged, prev)
  return merged
}

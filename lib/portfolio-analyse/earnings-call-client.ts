'use client'

import type { EarningsCallAnfrage, EarningsCallPaket } from '@/lib/portfolio-analyse/earnings-call-types'

const LS_KEY = 'pa-earnings-call-v1'
const LS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function cacheKey(anfrage: EarningsCallAnfrage): string {
  return anfrage.ticker.trim().toUpperCase()
}

export function ladeEarningsCallAusLocalCache(anfrage: EarningsCallAnfrage): EarningsCallPaket | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const j = JSON.parse(raw) as EarningsCallPaket & { cacheKey?: string; cachedAt?: number }
    if (j.cacheKey !== cacheKey(anfrage) || !j.cachedAt || Date.now() - j.cachedAt > LS_MAX_AGE_MS) return null
    if (!j.ok) return null
    return j
  } catch {
    return null
  }
}

function schreibeLocalCache(anfrage: EarningsCallAnfrage, daten: EarningsCallPaket): void {
  if (typeof window === 'undefined' || !daten.ok) return
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ ...daten, cacheKey: cacheKey(anfrage), cachedAt: Date.now() }),
    )
  } catch {
    /* voll */
  }
}

export async function ladeEarningsCallClient(anfrage: EarningsCallAnfrage): Promise<EarningsCallPaket> {
  const res = await fetch('/api/portfolio-analyse/earnings-call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(anfrage),
  })
  const j = (await res.json()) as EarningsCallPaket & { message?: string }
  if (!res.ok && !j.ticker) {
    throw new Error(j.fehler ?? j.message ?? 'Earnings Call konnte nicht geladen werden.')
  }
  if (j.ok) schreibeLocalCache(anfrage, j)
  return j
}

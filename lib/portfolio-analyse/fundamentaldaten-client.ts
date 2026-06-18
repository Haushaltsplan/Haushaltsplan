'use client'

import type {
  FundamentaldatenAnfrage,
  FundamentaldatenPaket,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

const LS_KEY = 'pa-fundamentaldaten-v24'
const LS_MAX_AGE_MS = 24 * 60 * 60 * 1000

function cacheKey(anfrage: FundamentaldatenAnfrage): string {
  return [
    anfrage.isin ?? '',
    anfrage.symbolYahoo ?? '',
    anfrage.tickerOverride ?? '',
    anfrage.name ?? '',
    anfrage.frequenz ?? 'jahr',
  ].join('|')
}

export function ladeFundamentaldatenAusLocalCache(
  anfrage: FundamentaldatenAnfrage,
): FundamentaldatenPaket | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const j = JSON.parse(raw) as FundamentaldatenPaket & { cacheKey?: string; cachedAt?: number }
    if (j.cacheKey !== cacheKey(anfrage) || !j.cachedAt || Date.now() - j.cachedAt > LS_MAX_AGE_MS) return null
    return j
  } catch {
    return null
  }
}

function schreibeLocalCache(anfrage: FundamentaldatenAnfrage, daten: FundamentaldatenPaket): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ ...daten, cacheKey: cacheKey(anfrage), cachedAt: Date.now() }),
    )
  } catch {
    /* Speicher voll */
  }
}

export async function ladeFundamentaldatenClient(
  anfrage: FundamentaldatenAnfrage,
): Promise<FundamentaldatenPaket> {
  const res = await fetch('/api/portfolio-analyse/fundamentaldaten', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(anfrage),
  })
  const j = (await res.json()) as FundamentaldatenPaket & { message?: string }
  if (!res.ok || !j.ok) {
    throw new Error(j.fehler ?? j.message ?? 'Fundamentaldaten konnten nicht geladen werden.')
  }
  schreibeLocalCache(anfrage, j)
  return j
}

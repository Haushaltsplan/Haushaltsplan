'use client'

import type {
  FundamentaldatenAnfrage,
  FundamentaldatenPaket,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

const LS_KEY = 'pa-fundamentaldaten-v56'
const LS_MAX_AGE_MS = 24 * 60 * 60 * 1000
const LS_MAX_TITEL = 8

function anfrageCacheKey(anfrage: FundamentaldatenAnfrage): string {
  return [
    anfrage.isin ?? '',
    anfrage.symbolYahoo ?? '',
    anfrage.tickerOverride ?? '',
    anfrage.frequenz ?? 'jahr',
  ].join('|')
}

type StoreEintrag = { paket: FundamentaldatenPaket; cachedAt: number }
type Store = Record<string, StoreEintrag>

function leseStore(): Store {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    const j = JSON.parse(raw) as Store
    return j && typeof j === 'object' ? j : {}
  } catch {
    return {}
  }
}

export function ladeFundamentaldatenAusLocalCache(
  anfrage: FundamentaldatenAnfrage,
): FundamentaldatenPaket | null {
  const e = leseStore()[anfrageCacheKey(anfrage)]
  if (!e?.paket?.ok || !e.cachedAt || Date.now() - e.cachedAt > LS_MAX_AGE_MS) return null
  return e.paket
}

function schreibeLocalCache(anfrage: FundamentaldatenAnfrage, daten: FundamentaldatenPaket): void {
  if (typeof window === 'undefined' || !daten.ok) return
  try {
    const store = leseStore()
    store[anfrageCacheKey(anfrage)] = { paket: daten, cachedAt: Date.now() }
    const keys = Object.keys(store)
    if (keys.length > LS_MAX_TITEL) {
      const sortiert = keys.sort((a, b) => (store[a]?.cachedAt ?? 0) - (store[b]?.cachedAt ?? 0))
      for (const k of sortiert.slice(0, keys.length - LS_MAX_TITEL)) delete store[k]
    }
    localStorage.setItem(LS_KEY, JSON.stringify(store))
  } catch {
    try {
      localStorage.removeItem(LS_KEY)
    } catch {
      /* Speicher voll */
    }
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
  const raw = await res.text()
  let j: FundamentaldatenPaket & { message?: string }
  try {
    j = JSON.parse(raw) as FundamentaldatenPaket & { message?: string }
  } catch {
    throw new Error(
      raw.trim().slice(0, 180) || 'Fundamentaldaten konnten nicht geladen werden (keine JSON-Antwort).',
    )
  }
  if (!res.ok || !j.ok) {
    throw new Error(j.fehler ?? j.message ?? 'Fundamentaldaten konnten nicht geladen werden.')
  }
  schreibeLocalCache(anfrage, j)
  return j
}

export type MantraVerlaufPunktClient = {
  periodeIso: string
  periodeLabel: string
  ampel: string
  ampelScorePct: number | null
  scoreMantra: number | null
  sellTriggerOk: boolean
  erfuellt: number
  nichtErfuellt: number
  erfasstAm: string
}

export async function ladeMantraVerlaufClient(ticker: string): Promise<MantraVerlaufPunktClient[]> {
  const t = ticker.trim().toUpperCase()
  if (!t) return []
  const res = await fetch(
    `/api/portfolio-analyse/fundamentaldaten/mantra-verlauf?ticker=${encodeURIComponent(t)}`,
    { cache: 'no-store' },
  )
  const j = (await res.json()) as { ok?: boolean; verlauf?: MantraVerlaufPunktClient[] }
  if (!res.ok || !j.ok || !j.verlauf) return []
  return j.verlauf
}

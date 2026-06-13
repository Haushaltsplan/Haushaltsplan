'use client'

import type { SecBerichtAnfrage, SecBerichtePaket } from '@/lib/portfolio-analyse/sec-berichte-types'

const LS_STORE_KEY = 'pa-sec-berichte-unternehmen-v1'

type UnternehmenStore = Record<
  string,
  SecBerichtePaket & { cacheKey: string; cachedAt: number }
>

export function secBerichteUnternehmenKey(
  anfrage: Pick<SecBerichtAnfrage, 'ticker' | 'isin' | 'firmenname'>,
): string {
  return [
    anfrage.isin?.trim().toUpperCase() ?? '',
    anfrage.ticker.trim().toUpperCase(),
    anfrage.firmenname?.trim() ?? '',
  ].join('|')
}

function ladeStore(): UnternehmenStore {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LS_STORE_KEY)
    if (!raw) return {}
    const j = JSON.parse(raw) as UnternehmenStore
    return j && typeof j === 'object' ? j : {}
  } catch {
    return {}
  }
}

function schreibeStore(store: UnternehmenStore): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LS_STORE_KEY, JSON.stringify(store))
  } catch {
    /* voll */
  }
}

export function ladeSecBerichteAusLocalCache(
  anfrage: Pick<SecBerichtAnfrage, 'ticker' | 'isin' | 'firmenname'>,
): SecBerichtePaket | null {
  const key = secBerichteUnternehmenKey(anfrage)
  const hit = ladeStore()[key]
  if (!hit?.berichte?.length) return null
  return hit
}

function speicherePaket(anfrage: SecBerichtAnfrage, paket: SecBerichtePaket): void {
  const key = secBerichteUnternehmenKey(anfrage)
  const store = ladeStore()
  store[key] = { ...paket, cacheKey: key, cachedAt: Date.now() }
  schreibeStore(store)
}

export async function ladeSecBerichte(
  anfrage: SecBerichtAnfrage,
  prev: SecBerichtePaket | null,
): Promise<SecBerichtePaket> {
  const res = await fetch('/api/portfolio-analyse/sec-berichte', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(anfrage),
  })
  const data = (await res.json().catch(() => ({}))) as SecBerichtePaket & { fehler?: string }
  if (!res.ok && !data.ticker) {
    throw new Error(typeof data.fehler === 'string' ? data.fehler : 'Abruf fehlgeschlagen')
  }

  if (anfrage.accession && prev) {
    const neu = data.berichte[0]
    const merged: SecBerichtePaket = {
      ...prev,
      berichte: prev.berichte.map((b) =>
        neu && b.accession === anfrage.accession ? { ...b, ...neu } : b,
      ),
    }
    speicherePaket(anfrage, merged)
    return merged
  }

  speicherePaket(anfrage, data)
  return data
}

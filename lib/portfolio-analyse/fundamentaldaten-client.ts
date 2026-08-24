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
  opts?: { signal?: AbortSignal },
): Promise<FundamentaldatenPaket> {
  const res = await fetch('/api/portfolio-analyse/fundamentaldaten', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(anfrage),
    signal: opts?.signal,
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

function zielSchluessel(z: FundamentaldatenAnfrage): string | null {
  const isin = z.isin?.trim().toUpperCase()
  if (isin) return `isin:${isin}`
  const sym = z.symbolYahoo?.trim().toUpperCase()
  if (sym) return `sym:${sym}`
  const name = z.name?.trim().toUpperCase()
  return name ? `name:${name}` : null
}

export function mergenFundamentaldatenZiele(
  ...listen: Array<FundamentaldatenAnfrage[] | null | undefined>
): FundamentaldatenAnfrage[] {
  const map = new Map<string, FundamentaldatenAnfrage>()
  for (const liste of listen) {
    for (const z of liste ?? []) {
      const key = zielSchluessel(z)
      if (!key) continue
      const prev = map.get(key)
      if (!prev) {
        map.set(key, { ...z, frequenz: 'jahr', cacheModus: 'erneuern' })
        continue
      }
      const candidates = [...(prev.symbolCandidates ?? []), ...(z.symbolCandidates ?? [])]
      map.set(key, {
        ...prev,
        name: prev.name || z.name,
        symbolYahoo: prev.symbolYahoo || z.symbolYahoo,
        symbolCandidates: [...new Set(candidates.filter(Boolean))],
      })
    }
  }
  return [...map.values()]
}

export async function ladeFundamentaldatenCacheZiele(opts?: {
  signal?: AbortSignal
}): Promise<FundamentaldatenAnfrage[]> {
  const res = await fetch('/api/portfolio-analyse/fundamentaldaten/cache-ziele', {
    cache: 'no-store',
    signal: opts?.signal,
  })
  const j = (await res.json()) as { ok?: boolean; ziele?: FundamentaldatenAnfrage[]; message?: string }
  if (!res.ok || !j.ok || !Array.isArray(j.ziele)) {
    throw new Error(j.message ?? 'Cache-Ziele konnten nicht geladen werden.')
  }
  return j.ziele
}

export type AlleAktualisierenFortschritt = {
  index: number
  gesamt: number
  name: string
  ok: boolean
  abgebrochen?: boolean
  fehlgeschlagen: number
}

export async function aktualisiereAlleFundamentaldaten(
  ziele: FundamentaldatenAnfrage[],
  opts: {
    signal?: AbortSignal
    onFortschritt?: (info: AlleAktualisierenFortschritt) => void
    onPaket?: (anfrage: FundamentaldatenAnfrage, paket: FundamentaldatenPaket) => void
  },
): Promise<{ ok: number; fehlgeschlagen: number; abgebrochen: boolean }> {
  let ok = 0
  let fehlgeschlagen = 0
  for (let i = 0; i < ziele.length; i++) {
    if (opts.signal?.aborted) {
      return { ok, fehlgeschlagen, abgebrochen: true }
    }
    const ziel = ziele[i]!
    const name = ziel.name ?? ziel.symbolYahoo ?? ziel.isin ?? 'Unbekannt'
    try {
      const paket = await ladeFundamentaldatenClient(
        { ...ziel, frequenz: 'jahr', cacheModus: 'erneuern' },
        { signal: opts.signal },
      )
      if (paket.ok) {
        ok += 1
        opts.onPaket?.(ziel, paket)
      } else {
        fehlgeschlagen += 1
      }
      opts.onFortschritt?.({
        index: i + 1,
        gesamt: ziele.length,
        name,
        ok: paket.ok,
        fehlgeschlagen,
      })
    } catch (e) {
      if (opts.signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
        return { ok, fehlgeschlagen, abgebrochen: true }
      }
      fehlgeschlagen += 1
      opts.onFortschritt?.({
        index: i + 1,
        gesamt: ziele.length,
        name,
        ok: false,
        fehlgeschlagen,
      })
    }
    if (i < ziele.length - 1) {
      await new Promise((r) => setTimeout(r, 400))
    }
  }
  return { ok, fehlgeschlagen, abgebrochen: false }
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

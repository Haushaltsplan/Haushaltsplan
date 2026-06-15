'use client'

import type { QuartalsKiDiffPaket, QuartalsKiDiffTyp } from '@/lib/portfolio-analyse/quartals-ki-diff-types'
import { syncQuartalsKiDiffAusLocal } from '@/lib/portfolio-analyse/portfolio-ki-cache-sync-client'

const LS_STORE_KEY = 'pa-quartals-ki-diff-v1'

type DiffStore = Record<
  string,
  QuartalsKiDiffPaket & { cacheKey: string; cachedAt: number }
>

export function quartalsKiDiffSpeicherKey(
  ticker: string,
  typ: QuartalsKiDiffTyp,
  aktuellId: string,
  vorherId: string,
): string {
  return [ticker.trim().toUpperCase(), typ, aktuellId.trim(), vorherId.trim()].join('|')
}

function ladeStore(): DiffStore {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LS_STORE_KEY)
    if (!raw) return {}
    const j = JSON.parse(raw) as DiffStore
    return j && typeof j === 'object' ? j : {}
  } catch {
    return {}
  }
}

function schreibeStore(store: DiffStore): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LS_STORE_KEY, JSON.stringify(store))
  } catch {
    /* voll */
  }
}

export function ladeQuartalsKiDiffAusLocalCache(opts: {
  ticker: string
  typ: QuartalsKiDiffTyp
  aktuellId: string
  vorherId: string
  aktuellLabel?: string
  vorherLabel?: string
}): QuartalsKiDiffPaket | null {
  const key = quartalsKiDiffSpeicherKey(opts.ticker, opts.typ, opts.aktuellId, opts.vorherId)
  const hit = ladeStore()[key]
  if (!hit?.diff?.trim()) return null

  const paket: QuartalsKiDiffPaket = {
    ok: true,
    ticker: hit.ticker,
    typ: hit.typ,
    aktuellId: hit.aktuellId,
    vorherId: hit.vorherId,
    aktuellLabel: opts.aktuellLabel ?? hit.aktuellLabel,
    vorherLabel: opts.vorherLabel ?? hit.vorherLabel,
    diff: hit.diff,
    geladenAm: hit.geladenAm,
    ausCache: true,
  }
  syncQuartalsKiDiffAusLocal(paket)
  return paket
}

export function speichereQuartalsKiDiffLocal(paket: QuartalsKiDiffPaket): void {
  if (typeof window === 'undefined' || !paket.diff?.trim()) return
  const key = quartalsKiDiffSpeicherKey(paket.ticker, paket.typ, paket.aktuellId, paket.vorherId)
  const store = ladeStore()
  store[key] = { ...paket, cacheKey: key, cachedAt: Date.now() }
  schreibeStore(store)
  syncQuartalsKiDiffAusLocal(paket)
}

/** Alle lokal gespeicherten Quartals-Diffs (Bulk-Sync). */
export function listeQuartalsKiDiffAusLocal(): QuartalsKiDiffPaket[] {
  return Object.values(ladeStore()).filter((p) => Boolean(p?.ticker && p.diff?.trim()))
}

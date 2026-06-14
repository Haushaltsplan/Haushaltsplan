'use client'

import type { EarningsCallAnfrage, EarningsCallPaket } from '@/lib/portfolio-analyse/earnings-call-types'
import { syncEarningsCallKiAusLocal } from '@/lib/portfolio-analyse/portfolio-ki-cache-sync-client'

/** Pro Unternehmen (ISIN|Ticker|Name) — wie Fundamentaldaten, ohne Überschreiben anderer Titel. */
const LS_STORE_KEY = 'pa-earnings-call-unternehmen-v1'

type UnternehmenStore = Record<
  string,
  EarningsCallPaket & { cacheKey: string; cachedAt: number }
>

export function earningsCallUnternehmenKey(anfrage: Pick<EarningsCallAnfrage, 'ticker' | 'isin' | 'firmenname'>): string {
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
    if (raw) {
      const j = JSON.parse(raw) as UnternehmenStore
      if (j && typeof j === 'object') return j
    }
    return migriereLegacyLocalStorage()
  } catch {
    return {}
  }
}

function migriereLegacyLocalStorage(): UnternehmenStore {
  const store: UnternehmenStore = {}
  try {
    const legacyPaket = localStorage.getItem('pa-earnings-call-v3')
    if (legacyPaket) {
      const p = JSON.parse(legacyPaket) as EarningsCallPaket & { cacheKey?: string; cachedAt?: number }
      if (p.ticker && p.quartale?.length) {
        const key = [
          '',
          p.ticker.trim().toUpperCase(),
          '',
        ].join('|')
        store[key] = { ...p, ok: true, cacheKey: key, cachedAt: Date.now() }
      }
    }
    const legacyKi = localStorage.getItem('pa-earnings-call-ki-v1')
    if (legacyKi) {
      const ki = JSON.parse(legacyKi) as Record<
        string,
        Record<string, { zusammenfassung: string; transcriptUrl: string }>
      >
      for (const [ticker, quartale] of Object.entries(ki)) {
        const key = ['', ticker.trim().toUpperCase(), ''].join('|')
        const prev = store[key]
        if (!prev) continue
        store[key] = {
          ...prev,
          quartale: prev.quartale.map((q) => ({
            ...q,
            zusammenfassung: quartale[q.id]?.zusammenfassung ?? q.zusammenfassung,
          })),
        }
      }
    }
    if (Object.keys(store).length) schreibeStore(store)
  } catch {
    /* ignore */
  }
  return store
}

function schreibeStore(store: UnternehmenStore): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LS_STORE_KEY, JSON.stringify(store))
  } catch {
    /* voll */
  }
}

function gleichesUnternehmen(a: EarningsCallPaket | null | undefined, anfrage: EarningsCallAnfrage): boolean {
  if (!a) return false
  return a.ticker.trim().toUpperCase() === anfrage.ticker.trim().toUpperCase()
}

function mergePaketeGleichesUnternehmen(
  prev: EarningsCallPaket | null,
  next: EarningsCallPaket,
  anfrage: EarningsCallAnfrage,
): EarningsCallPaket {
  if (!prev || !gleichesUnternehmen(prev, anfrage)) return next

  const mergedQuartale = next.quartale.map((q) => ({
    ...q,
    zusammenfassung: q.zusammenfassung ?? prev.quartale.find((p) => p.id === q.id)?.zusammenfassung ?? null,
  }))

  return { ...next, quartale: mergedQuartale }
}

export function ladeEarningsCallAusLocalCache(anfrage: EarningsCallAnfrage): EarningsCallPaket | null {
  if (typeof window === 'undefined') return null
  const key = earningsCallUnternehmenKey(anfrage)
  const hit = ladeStore()[key]
  if (!hit?.quartale?.length) return null
  if (hit.ticker.trim().toUpperCase() !== anfrage.ticker.trim().toUpperCase()) return null
  const paket = { ...hit, ok: true, ausCache: true }
  syncEarningsCallKiAusLocal(paket)
  return paket
}

function schreibeUnternehmenCache(anfrage: EarningsCallAnfrage, daten: EarningsCallPaket): void {
  if (typeof window === 'undefined' || !daten.quartale.length) return
  if (daten.ticker.trim().toUpperCase() !== anfrage.ticker.trim().toUpperCase()) return

  const store = ladeStore()
  const key = earningsCallUnternehmenKey(anfrage)
  store[key] = {
    ...daten,
    ok: true,
    cacheKey: key,
    cachedAt: Date.now(),
  }
  schreibeStore(store)
  syncEarningsCallKiAusLocal(daten)
}

function istHtmlAntwort(text: string): boolean {
  const s = text.trimStart().slice(0, 32).toLowerCase()
  return s.startsWith('<!doctype') || s.startsWith('<html')
}

async function parseApiAntwort(res: Response): Promise<EarningsCallPaket & { message?: string }> {
  const text = await res.text()
  if (istHtmlAntwort(text)) {
    if (res.status === 504 || res.status === 502) {
      throw new Error('Server-Timeout — Earnings Call dauert zu lange. Bitte erneut versuchen.')
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error('Anmeldung erforderlich — bitte neu einloggen.')
    }
    throw new Error(`Serverfehler (${res.status}) — keine gültige Antwort.`)
  }
  try {
    return JSON.parse(text) as EarningsCallPaket & { message?: string }
  } catch {
    throw new Error('Ungültige Server-Antwort (kein JSON).')
  }
}

export async function ladeEarningsCallClient(
  anfrage: EarningsCallAnfrage & { isin?: string | null },
  prev?: EarningsCallPaket | null,
): Promise<EarningsCallPaket> {
  const prevOk = prev && gleichesUnternehmen(prev, anfrage) ? prev : null

  let res: Response
  try {
    res = await fetch('/api/portfolio-analyse/earnings-call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticker: anfrage.ticker,
      firmenname: anfrage.firmenname,
      isin: anfrage.isin,
      force: anfrage.force,
      quartalId: anfrage.quartalId,
      forceKi: anfrage.forceKi,
    }),
    signal: AbortSignal.timeout(120_000),
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') {
      throw new Error('Zeitüberschreitung — Transkript-Suche dauert zu lange. Bitte erneut versuchen.')
    }
    throw e
  }
  const j = await parseApiAntwort(res)
  if (!j.ticker && !j.quartale?.length && (j.fehler || !res.ok)) {
    throw new Error(j.fehler ?? j.message ?? 'Earnings Call konnte nicht geladen werden.')
  }

  const merged = mergePaketeGleichesUnternehmen(prevOk, j, anfrage)
  if (merged.quartale.length) schreibeUnternehmenCache(anfrage, merged)
  return merged
}

export async function ladeEarningsCallTranskripte(
  anfrage: Omit<EarningsCallAnfrage, 'quartalId' | 'forceKi'> & { isin?: string | null },
  prev?: EarningsCallPaket | null,
): Promise<EarningsCallPaket> {
  const prevOk = prev && gleichesUnternehmen(prev, anfrage) ? prev : null
  return ladeEarningsCallClient({ ...anfrage, quartalId: null, forceKi: false }, prevOk)
}

export async function ladeEarningsCallKiFuerQuartal(
  anfrage: EarningsCallAnfrage & { isin?: string | null; quartalId: string },
  prev?: EarningsCallPaket | null,
): Promise<EarningsCallPaket> {
  const prevOk = prev && gleichesUnternehmen(prev, anfrage) ? prev : null
  return ladeEarningsCallClient({ ...anfrage, force: false, forceKi: false }, prevOk)
}

export async function erneuereEarningsCallKi(
  anfrage: EarningsCallAnfrage & { isin?: string | null; quartalId: string },
  prev?: EarningsCallPaket | null,
): Promise<EarningsCallPaket> {
  const prevOk = prev && gleichesUnternehmen(prev, anfrage) ? prev : null
  return ladeEarningsCallClient({ ...anfrage, force: false, forceKi: true }, prevOk)
}

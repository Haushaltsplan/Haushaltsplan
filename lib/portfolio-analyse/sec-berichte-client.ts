'use client'

import type { SecBerichtAnfrage, SecBerichtePaket } from '@/lib/portfolio-analyse/sec-berichte-types'
import { syncSecBerichteKiAusLocal } from '@/lib/portfolio-analyse/portfolio-ki-cache-sync-client'

const LS_STORE_KEY = 'pa-sec-berichte-unternehmen-v4'

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
    if (raw) {
      const j = JSON.parse(raw) as UnternehmenStore
      if (j && typeof j === 'object') return j
    }
    return migriereLegacyStore()
  } catch {
    return {}
  }
}

function migriereLegacyStore(): UnternehmenStore {
  const store: UnternehmenStore = {}
  try {
    const raw = localStorage.getItem('pa-sec-berichte-unternehmen-v1')
    if (!raw) return store
    const legacy = JSON.parse(raw) as UnternehmenStore
    for (const [key, hit] of Object.entries(legacy)) {
      if (!hit?.berichte?.length) continue
      store[key] = {
        ...hit,
        berichte: hit.berichte.map((b) => ({ ...b, zusammenfassung: b.zusammenfassung ?? null })),
        aktiverBerichtId: hit.aktiverBerichtId ?? null,
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

function gleichesUnternehmen(a: SecBerichtePaket | null | undefined, anfrage: SecBerichtAnfrage): boolean {
  if (!a) return false
  return a.ticker.trim().toUpperCase() === anfrage.ticker.trim().toUpperCase()
}

function ohneBerichtstext(b: SecBerichtePaket['berichte'][number]) {
  return { ...b, textAuszug: '', textVollstaendig: false, textZeichen: 0 }
}

function ohneBerichtstextPaket(paket: SecBerichtePaket): SecBerichtePaket {
  return { ...paket, berichte: paket.berichte.map(ohneBerichtstext) }
}

function mergePakete(
  prev: SecBerichtePaket | null,
  next: SecBerichtePaket,
  anfrage: SecBerichtAnfrage,
): SecBerichtePaket {
  if (!prev || !gleichesUnternehmen(prev, anfrage)) return ohneBerichtstextPaket(next)

  const mergedBerichte = next.berichte.map((b) => {
    const alt = prev.berichte.find((p) => p.id === b.id)
    return ohneBerichtstext({
      ...alt,
      ...b,
      zusammenfassung: b.zusammenfassung ?? alt?.zusammenfassung ?? null,
    })
  })

  return ohneBerichtstextPaket({ ...next, berichte: mergedBerichte })
}

export function ladeSecBerichteAusLocalCache(
  anfrage: Pick<SecBerichtAnfrage, 'ticker' | 'isin' | 'firmenname'>,
): SecBerichtePaket | null {
  const key = secBerichteUnternehmenKey(anfrage)
  const hit = ladeStore()[key]
  if (!hit?.berichte?.length) return null
  syncSecBerichteKiAusLocal(hit)
  return hit
}

function speicherePaket(anfrage: SecBerichtAnfrage, paket: SecBerichtePaket): void {
  const key = secBerichteUnternehmenKey(anfrage)
  const store = ladeStore()
  store[key] = { ...paket, cacheKey: key, cachedAt: Date.now() }
  schreibeStore(store)
  syncSecBerichteKiAusLocal(paket)
}

async function parseApiAntwort(res: Response): Promise<SecBerichtePaket & { fehler?: string }> {
  const text = await res.text()
  const s = text.trimStart().slice(0, 32).toLowerCase()
  if (s.startsWith('<!doctype') || s.startsWith('<html')) {
    if (res.status === 504 || res.status === 502) {
      throw new Error('Server-Timeout — SEC-Bericht dauert zu lange. Bitte erneut versuchen.')
    }
    throw new Error(`Serverfehler (${res.status}) — keine gültige Antwort.`)
  }
  try {
    return JSON.parse(text) as SecBerichtePaket & { fehler?: string }
  } catch {
    throw new Error('Ungültige Server-Antwort (kein JSON).')
  }
}

async function ladeSecBerichteClient(
  anfrage: SecBerichtAnfrage,
  prev: SecBerichtePaket | null,
): Promise<SecBerichtePaket> {
  const prevOk = prev && gleichesUnternehmen(prev, anfrage) ? prev : null
  const timeoutMs = anfrage.berichtId ? 180_000 : 90_000

  let res: Response
  try {
    res = await fetch('/api/portfolio-analyse/sec-berichte', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(anfrage),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') {
      throw new Error('Zeitüberschreitung — bitte erneut versuchen.')
    }
    throw e
  }

  const data = await parseApiAntwort(res)
  if (!data.ticker && !data.berichte?.length && (data.fehler || !res.ok)) {
    throw new Error(data.fehler ?? 'Abruf fehlgeschlagen')
  }

  // Fehlgeschlagener Refresh darf gespeicherte Berichte + KI-Summaries nicht verwerfen.
  if (!data.berichte?.length && prevOk?.berichte?.length) {
    return {
      ...prevOk,
      fehler: data.fehler?.trim() || 'Aktualisierung fehlgeschlagen — gespeicherte Berichte behalten.',
      geladenAm: data.geladenAm || prevOk.geladenAm,
      ausCache: true,
    }
  }

  const merged = mergePakete(prevOk, data, anfrage)
  if (merged.berichte.length) speicherePaket(anfrage, merged)
  return merged
}

export async function ladeSecBerichte(
  anfrage: SecBerichtAnfrage,
  prev: SecBerichtePaket | null,
): Promise<SecBerichtePaket> {
  return ladeSecBerichteClient(anfrage, prev)
}

export async function ladeSecBerichteListe(
  anfrage: Omit<SecBerichtAnfrage, 'accession' | 'berichtId' | 'forceKi'>,
  prev?: SecBerichtePaket | null,
): Promise<SecBerichtePaket> {
  return ladeSecBerichteClient({ ...anfrage, accession: null, berichtId: null, forceKi: false }, prev ?? null)
}

export async function ladeSecBerichteKiFuerBericht(
  anfrage: SecBerichtAnfrage & { berichtId: string },
  prev?: SecBerichtePaket | null,
): Promise<SecBerichtePaket> {
  return ladeSecBerichteClient({ ...anfrage, force: false, forceKi: false }, prev ?? null)
}

export async function erneuereSecBerichteKi(
  anfrage: SecBerichtAnfrage & { berichtId: string },
  prev?: SecBerichtePaket | null,
): Promise<SecBerichtePaket> {
  return ladeSecBerichteClient({ ...anfrage, force: false, forceKi: true }, prev ?? null)
}

/** Alle lokal gespeicherten Pakete mit mindestens einer KI-Zusammenfassung. */
export function listeSecBerichtePaketeMitKiAusLocal(): SecBerichtePaket[] {
  return Object.values(ladeStore()).filter((p) =>
    Boolean(p?.ticker && p.berichte?.some((b) => b.zusammenfassung?.trim())),
  )
}

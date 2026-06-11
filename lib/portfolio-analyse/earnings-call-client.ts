'use client'

import type { EarningsCallAnfrage, EarningsCallPaket } from '@/lib/portfolio-analyse/earnings-call-types'

const LS_KEY = 'pa-earnings-call-v3'
const LS_KI_KEY = 'pa-earnings-call-ki-v1'
const LS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

type KiSpeicher = Record<
  string,
  Record<string, { zusammenfassung: string; transcriptUrl: string; savedAt: number }>
>

function cacheKey(anfrage: EarningsCallAnfrage): string {
  return anfrage.ticker.trim().toUpperCase()
}

function ladeKiSpeicher(): KiSpeicher {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LS_KI_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as KiSpeicher
  } catch {
    return {}
  }
}

function schreibeKiSpeicher(data: KiSpeicher): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LS_KI_KEY, JSON.stringify(data))
  } catch {
    /* voll */
  }
}

function mergeKiAusLocal(ticker: string, paket: EarningsCallPaket): EarningsCallPaket {
  const ki = ladeKiSpeicher()[ticker.trim().toUpperCase()]
  if (!ki) return paket
  const quartale = paket.quartale.map((q) => {
    const hit = ki[q.id]
    if (!hit) return q
    if (hit.transcriptUrl && hit.transcriptUrl !== q.transcriptUrl) return q
    return { ...q, zusammenfassung: q.zusammenfassung ?? hit.zusammenfassung }
  })
  return { ...paket, quartale }
}

function persistKiAusPaket(ticker: string, paket: EarningsCallPaket): void {
  const t = ticker.trim().toUpperCase()
  const store = ladeKiSpeicher()
  const byQ = { ...(store[t] ?? {}) }
  for (const q of paket.quartale) {
    if (!q.zusammenfassung) continue
    byQ[q.id] = {
      zusammenfassung: q.zusammenfassung,
      transcriptUrl: q.transcriptUrl,
      savedAt: Date.now(),
    }
  }
  store[t] = byQ
  schreibeKiSpeicher(store)
}

function mergePakete(prev: EarningsCallPaket | null, next: EarningsCallPaket): EarningsCallPaket {
  if (!prev?.quartale.length) return next
  const mergedQuartale = next.quartale.map((q) => ({
    ...q,
    zusammenfassung: q.zusammenfassung ?? prev.quartale.find((p) => p.id === q.id)?.zusammenfassung ?? null,
  }))
  for (const p of prev.quartale) {
    if (!mergedQuartale.some((q) => q.id === p.id) && p.zusammenfassung) {
      mergedQuartale.push(p)
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
    return mergeKiAusLocal(anfrage.ticker, j)
  } catch {
    return null
  }
}

function schreibeLocalCache(anfrage: EarningsCallAnfrage, daten: EarningsCallPaket, prev?: EarningsCallPaket | null): void {
  if (typeof window === 'undefined' || !daten.quartale.length) return
  const merged = mergePakete(prev ?? null, daten)
  const withKi = mergeKiAusLocal(anfrage.ticker, merged)
  persistKiAusPaket(anfrage.ticker, withKi)
  if (!withKi.ok && !withKi.quartale.length) return
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ ...withKi, ok: true, cacheKey: cacheKey(anfrage), cachedAt: Date.now() }),
    )
  } catch {
    /* voll */
  }
}

function istHtmlAntwort(text: string): boolean {
  const s = text.trimStart().slice(0, 32).toLowerCase()
  return s.startsWith('<!doctype') || s.startsWith('<html')
}

async function parseApiAntwort(res: Response): Promise<EarningsCallPaket & { message?: string }> {
  const text = await res.text()
  if (istHtmlAntwort(text)) {
    if (res.status === 504 || res.status === 502) {
      throw new Error('Server-Timeout — Earnings Call dauert zu lange. Bitte „Aktualisieren“ erneut versuchen.')
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
  const res = await fetch('/api/portfolio-analyse/earnings-call', {
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
  })
  const j = await parseApiAntwort(res)
  if (!j.ticker && !j.quartale?.length && (j.fehler || !res.ok)) {
    throw new Error(j.fehler ?? j.message ?? 'Earnings Call konnte nicht geladen werden.')
  }
  const merged = mergePakete(prev ?? null, j)
  const withKi = mergeKiAusLocal(anfrage.ticker, merged)
  if (withKi.quartale.length) schreibeLocalCache(anfrage, withKi, prev)
  return withKi
}

/** Nur Transkript-Liste — ohne KI (beim ersten Öffnen). */
export async function ladeEarningsCallTranskripte(
  anfrage: Omit<EarningsCallAnfrage, 'quartalId' | 'forceKi'> & { isin?: string | null },
  prev?: EarningsCallPaket | null,
): Promise<EarningsCallPaket> {
  return ladeEarningsCallClient({ ...anfrage, quartalId: null, forceKi: false }, prev)
}

/** KI-Zusammenfassung für ein Quartal — nur wenn noch nicht gespeichert. */
export async function ladeEarningsCallKiFuerQuartal(
  anfrage: EarningsCallAnfrage & { isin?: string | null; quartalId: string },
  prev?: EarningsCallPaket | null,
): Promise<EarningsCallPaket> {
  return ladeEarningsCallClient({ ...anfrage, force: false, forceKi: false }, prev)
}

/** KI-Analyse bewusst neu erzeugen. */
export async function erneuereEarningsCallKi(
  anfrage: EarningsCallAnfrage & { isin?: string | null; quartalId: string },
  prev?: EarningsCallPaket | null,
): Promise<EarningsCallPaket> {
  return ladeEarningsCallClient({ ...anfrage, force: false, forceKi: true }, prev)
}

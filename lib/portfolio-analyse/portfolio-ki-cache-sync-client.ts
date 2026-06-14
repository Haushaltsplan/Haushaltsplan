'use client'

import { listeEarningsCallPaketeMitKiAusLocal } from '@/lib/portfolio-analyse/earnings-call-client'
import { listeSecBerichtePaketeMitKiAusLocal } from '@/lib/portfolio-analyse/sec-berichte-client'
import type { EarningsCallPaket } from '@/lib/portfolio-analyse/earnings-call-types'
import type { SecBerichtePaket } from '@/lib/portfolio-analyse/sec-berichte-types'

const syncInFlight = new Set<string>()
const SESSION_BULK_KEY = 'pa-ki-bulk-sync-ok-v1'
let bulkLaeuft = false

function syncKey(typ: 'sec' | 'earnings', ticker: string): string {
  return `${typ}:${ticker.trim().toUpperCase()}`
}

async function postSync(body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch('/api/portfolio-analyse/ki-cache/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    })
    const j = (await res.json()) as { ok?: boolean }
    return res.ok && j.ok === true
  } catch {
    return false
  }
}

function baueSecBulkPayload(pakete: SecBerichtePaket[]) {
  const byTicker = new Map<string, { berichtId: string; accession: string; zusammenfassung: string }[]>()
  for (const paket of pakete) {
    const ticker = paket.ticker?.trim().toUpperCase()
    if (!ticker) continue
    const map = new Map((byTicker.get(ticker) ?? []).map((e) => [e.berichtId, e]))
    for (const b of paket.berichte) {
      if (!b.zusammenfassung?.trim()) continue
      map.set(b.id, {
        berichtId: b.id,
        accession: b.accession,
        zusammenfassung: b.zusammenfassung,
      })
    }
    byTicker.set(ticker, [...map.values()])
  }
  return [...byTicker.entries()].map(([ticker, eintraege]) => ({ ticker, eintraege }))
}

function baueEarningsBulkPayload(pakete: EarningsCallPaket[]) {
  const byTicker = new Map<
    string,
    { quartalId: string; transcriptUrl: string; zusammenfassung: string }[]
  >()
  for (const paket of pakete) {
    const ticker = paket.ticker?.trim().toUpperCase()
    if (!ticker) continue
    const map = new Map((byTicker.get(ticker) ?? []).map((e) => [e.quartalId, e]))
    for (const q of paket.quartale) {
      if (!q.zusammenfassung?.trim()) continue
      map.set(q.id, {
        quartalId: q.id,
        transcriptUrl: q.transcriptUrl,
        zusammenfassung: q.zusammenfassung,
      })
    }
    byTicker.set(ticker, [...map.values()])
  }
  return [...byTicker.entries()].map(([ticker, eintraege]) => ({ ticker, eintraege }))
}

/** Bestehende localStorage-Zusammenfassungen einmalig in die Cloud hochladen. */
export function syncSecBerichteKiAusLocal(paket: SecBerichtePaket): void {
  const ticker = paket.ticker?.trim()
  if (!ticker) return
  const eintraege = paket.berichte
    .filter((b) => b.zusammenfassung?.trim())
    .map((b) => ({
      berichtId: b.id,
      accession: b.accession,
      zusammenfassung: b.zusammenfassung as string,
    }))
  if (!eintraege.length) return

  const key = syncKey('sec', ticker)
  if (syncInFlight.has(key)) return
  syncInFlight.add(key)
  void postSync({ typ: 'sec', ticker, eintraege }).finally(() => syncInFlight.delete(key))
}

export function syncEarningsCallKiAusLocal(paket: EarningsCallPaket): void {
  const ticker = paket.ticker?.trim()
  if (!ticker) return
  const eintraege = paket.quartale
    .filter((q) => q.zusammenfassung?.trim())
    .map((q) => ({
      quartalId: q.id,
      transcriptUrl: q.transcriptUrl,
      zusammenfassung: q.zusammenfassung as string,
    }))
  if (!eintraege.length) return

  const key = syncKey('earnings', ticker)
  if (syncInFlight.has(key)) return
  syncInFlight.add(key)
  void postSync({ typ: 'earnings', ticker, eintraege }).finally(() => syncInFlight.delete(key))
}

/**
 * Alle vorhandenen KI-Zusammenfassungen (localStorage + Server-Dateien) in Supabase hochladen.
 * Wird beim Öffnen der Portfolioanalyse ausgelöst — Laptop → Handy.
 */
export function syncAlleKiZusammenfassungenAusLocalStorage(): void {
  if (typeof window === 'undefined' || bulkLaeuft) return
  if (sessionStorage.getItem(SESSION_BULK_KEY)) return

  const sec = baueSecBulkPayload(listeSecBerichtePaketeMitKiAusLocal())
  const earnings = baueEarningsBulkPayload(listeEarningsCallPaketeMitKiAusLocal())
  if (!sec.length && !earnings.length) {
    void postSync({ bulk: true, sec: [], earnings: [] }).then((ok) => {
      if (ok) sessionStorage.setItem(SESSION_BULK_KEY, '1')
    })
    return
  }

  bulkLaeuft = true
  void postSync({ bulk: true, sec, earnings })
    .then((ok) => {
      if (ok) sessionStorage.setItem(SESSION_BULK_KEY, '1')
    })
    .finally(() => {
      bulkLaeuft = false
    })
}

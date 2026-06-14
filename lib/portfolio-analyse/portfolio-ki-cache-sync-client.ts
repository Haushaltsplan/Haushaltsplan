'use client'

import type { EarningsCallPaket } from '@/lib/portfolio-analyse/earnings-call-types'
import type { SecBerichtePaket } from '@/lib/portfolio-analyse/sec-berichte-types'

const syncInFlight = new Set<string>()

function syncKey(typ: 'sec' | 'earnings', ticker: string): string {
  return `${typ}:${ticker.trim().toUpperCase()}`
}

async function postSync(body: Record<string, unknown>): Promise<void> {
  try {
    await fetch('/api/portfolio-analyse/ki-cache/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    /* still offline or no service role — localStorage bleibt Quelle auf dem Gerät */
  }
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

/**
 * Client: nach Depot-/Watchlist-Änderung Radar-Universum anstoßen.
 */

export type UniversumSyncErgebnis = {
  ok: boolean
  anzahl?: number
  depot?: number
  watchlist?: number
  entfernt?: number
  message?: string
}

/** Fire-and-forget — darf UI nie blockieren. */
export function syncNachkaufUniversum(): void {
  if (typeof window === 'undefined') return
  void fetch('/api/portfolio-analyse/universum-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }).catch(() => {
    /* offline / Auth */
  })
}

export async function syncNachkaufUniversumAwait(): Promise<UniversumSyncErgebnis> {
  if (typeof window === 'undefined') return { ok: false, message: 'Nur im Browser.' }
  try {
    const res = await fetch('/api/portfolio-analyse/universum-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    const j = (await res.json()) as UniversumSyncErgebnis
    if (!res.ok || !j.ok) return { ok: false, message: j.message ?? 'Universum-Sync fehlgeschlagen.' }
    return j
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Universum-Sync fehlgeschlagen.' }
  }
}

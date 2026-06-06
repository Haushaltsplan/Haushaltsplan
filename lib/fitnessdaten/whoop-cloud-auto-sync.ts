/** Automatischer WHOOP-Cloud-Sync — Hintergrund, gedrosselt. */

import {
  WHOOP_CLOUD_META_KEY,
  syncWhoopCloudVomServer,
  type WhoopCloudMeta,
} from '@/lib/fitnessdaten/whoop-cloud-merge'

const MIN_INTERVAL_MS = 10 * 60_000
const DEFAULT_INTERVAL_MS = 15 * 60_000

function autoSyncMs(): number {
  const raw = process.env.NEXT_PUBLIC_WHOOP_CLOUD_SYNC_MS
  const n = raw != null && raw !== '' ? Number(raw) : NaN
  if (Number.isFinite(n) && n >= MIN_INTERVAL_MS) return Math.floor(n)
  return DEFAULT_INTERVAL_MS
}

function letzterSyncMs(): number | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(WHOOP_CLOUD_META_KEY)
    if (!raw) return null
    const meta = JSON.parse(raw) as Partial<WhoopCloudMeta>
    if (!meta.lastSyncedAt) return null
    const t = Date.parse(meta.lastSyncedAt)
    return Number.isFinite(t) ? t : null
  } catch {
    return null
  }
}

export function whoopCloudSyncFaellig(force = false): boolean {
  if (force) return true
  const last = letzterSyncMs()
  if (last == null) return true
  return Date.now() - last >= MIN_INTERVAL_MS
}

let laufend = false

/** Sync ausführen, wenn WHOOP verbunden und Intervall abgelaufen. */
export async function versucheWhoopCloudAutoSync(force = false): Promise<boolean> {
  if (typeof window === 'undefined' || laufend) return false
  if (!whoopCloudSyncFaellig(force)) return false

  laufend = true
  try {
    const statusRes = await fetch('/api/fitnessdaten/whoop/status', { credentials: 'include' })
    if (!statusRes.ok) return false
    const status = (await statusRes.json()) as { connected?: boolean; configured?: boolean }
    if (!status.configured || !status.connected) return false

    const res = await syncWhoopCloudVomServer()
    return res.ok
  } catch {
    return false
  } finally {
    laufend = false
  }
}

export function whoopCloudAutoSyncIntervallMs(): number {
  return autoSyncMs()
}

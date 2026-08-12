/**
 * Client-Sync für Führung: localStorage + Supabase (pro Account).
 */
import {
  ladeFuehrungState,
  parseFuehrungState,
  speichereFuehrungState,
  type FuehrungMitarbeiter,
  type FuehrungMitarbeiterTag,
  type FuehrungState,
} from '@/lib/fuehrung/store'

const SYNC_DEBOUNCE_MS = 600
let syncTimer: ReturnType<typeof setTimeout> | null = null
let syncInFlight = false
let pendingState: FuehrungState | null = null

function mitarbeiterKey(m: FuehrungMitarbeiter): string {
  return m.id
}

function tagKey(t: FuehrungMitarbeiterTag): string {
  return `${t.mitarbeiterId}|${t.datum}`
}

/** Vereinigt Mitarbeiter-Listen (Union nach id). */
export function mergeMitarbeiterListen(
  a: FuehrungMitarbeiter[],
  b: FuehrungMitarbeiter[],
): FuehrungMitarbeiter[] {
  const map = new Map<string, FuehrungMitarbeiter>()
  for (const m of a) map.set(mitarbeiterKey(m), m)
  for (const m of b) {
    const cur = map.get(mitarbeiterKey(m))
    if (!cur) {
      map.set(mitarbeiterKey(m), m)
      continue
    }
    // Neuerer Eintrag (createdAt) bzw. längerer Name gewinnt nicht — Name vom später erstellten behalten
    map.set(
      mitarbeiterKey(m),
      (m.createdAt || '') >= (cur.createdAt || '') ? { ...cur, ...m } : { ...m, ...cur },
    )
  }
  return [...map.values()].sort((x, y) => (y.createdAt || '').localeCompare(x.createdAt || ''))
}

/** Tagesstände: neueres updatedAt gewinnt. */
export function mergeMitarbeiterTageListen(
  a: FuehrungMitarbeiterTag[],
  b: FuehrungMitarbeiterTag[],
): FuehrungMitarbeiterTag[] {
  const map = new Map<string, FuehrungMitarbeiterTag>()
  for (const t of [...a, ...b]) {
    const k = tagKey(t)
    const cur = map.get(k)
    if (!cur || (t.updatedAt || '') >= (cur.updatedAt || '')) map.set(k, t)
  }
  return [...map.values()]
}

/**
 * Cloud + lokal mergen: Skalare/Listen per neuerem aktualisiertAm,
 * Mitarbeiter & MitarbeiterTage immer union-mergen (kein Datenverlust zwischen Geräten).
 */
export function mergeFuehrungStates(lokal: FuehrungState, cloud: FuehrungState): FuehrungState {
  const lokalAt = lokal.aktualisiertAm || '1970-01-01T00:00:00.000Z'
  const cloudAt = cloud.aktualisiertAm || '1970-01-01T00:00:00.000Z'
  const basis = cloudAt > lokalAt ? cloud : lokal
  const am = cloudAt > lokalAt ? cloudAt : lokalAt
  return {
    ...basis,
    mitarbeiter: mergeMitarbeiterListen(lokal.mitarbeiter, cloud.mitarbeiter),
    mitarbeiterTage: mergeMitarbeiterTageListen(lokal.mitarbeiterTage, cloud.mitarbeiterTage),
    aktualisiertAm: am,
  }
}

/** Fire-and-forget Upload (debounced). */
export function syncFuehrungZurCloud(state: FuehrungState): void {
  if (typeof window === 'undefined') return
  pendingState = state
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    syncTimer = null
    void flushFuehrungSync()
  }, SYNC_DEBOUNCE_MS)
}

async function flushFuehrungSync(): Promise<void> {
  if (syncInFlight) return
  const state = pendingState
  if (!state) return
  pendingState = null
  syncInFlight = true
  try {
    const aktualisiertAm = state.aktualisiertAm || new Date().toISOString()
    await fetch('/api/fuehrung/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: state, aktualisiertAm }),
    })
  } catch {
    /* offline — lokaler Stand bleibt */
  } finally {
    syncInFlight = false
    if (pendingState) void flushFuehrungSync()
  }
}

/**
 * Lokal laden, mit Cloud mergen, zurückschreiben und spiegeln.
 */
export async function ladeFuehrungMitCloudMerge(): Promise<FuehrungState> {
  const lokal = ladeFuehrungState()
  try {
    const res = await fetch('/api/fuehrung/sync')
    if (!res.ok) {
      syncFuehrungZurCloud(lokal)
      return lokal
    }
    const j = (await res.json()) as {
      ok?: boolean
      vorhanden?: boolean
      payload?: unknown
      aktualisiertAm?: string | null
    }
    if (!j.ok || !j.vorhanden || !j.payload) {
      syncFuehrungZurCloud(lokal)
      return lokal
    }
    const cloudRoh = parseFuehrungState(j.payload)
    if (j.aktualisiertAm && !cloudRoh.aktualisiertAm) {
      cloudRoh.aktualisiertAm = j.aktualisiertAm
    }
    const merged = mergeFuehrungStates(lokal, cloudRoh)
    speichereFuehrungState(merged)
    syncFuehrungZurCloud(merged)
    return merged
  } catch {
    syncFuehrungZurCloud(lokal)
    return lokal
  }
}

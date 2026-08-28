/**
 * Geräteübergreifender Abgleich: Cloud ziehen, lokal anwenden, Änderungen hochladen.
 * Letzter Schreibzeitpunkt gewinnt (außer Fitness-Tage: Union-Merge).
 */
import {
  CLIENT_STATE_KEYS,
  CLIENT_STATE_READY_EVENT,
  type ClientStateEintrag,
  type ClientStateKey,
} from '@/lib/client-state/client-state-keys'
import { istCloudApplyAktiv } from '@/lib/client-state/client-state-guard'
import { leseClientStateRev, setzeClientStateRev } from '@/lib/client-state/client-state-rev'
import {
  ALLE_UPLOAD_KEYS,
  leseLocalPayload,
  wendeClientStateAn,
} from '@/lib/client-state/client-state-local'

const DEFAULT_DEBOUNCE_MS: Record<string, number> = {
  [CLIENT_STATE_KEYS.fitnessDaily]: 8000,
  [CLIENT_STATE_KEYS.modeberaterFotos]: 1600,
  [CLIENT_STATE_KEYS.modeberater]: 700,
}

let cloudCache = new Map<string, ClientStateEintrag>()
let pullPromise: Promise<void> | null = null
let pullErledigt = false
const pending = new Map<string, { payload: unknown; aktualisiertAm: string }>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()

export function istClientStatePullErledigt(): boolean {
  return pullErledigt
}

export function holeClientStateCache(schluessel: string): ClientStateEintrag | null {
  return cloudCache.get(schluessel) ?? null
}

async function postEintraege(eintraege: ClientStateEintrag[]): Promise<boolean> {
  if (eintraege.length === 0) return true
  try {
    const res = await fetch('/api/client-state/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eintraege }),
    })
    const j = (await res.json()) as { ok?: boolean }
    return res.ok && j.ok === true
  } catch {
    return false
  }
}

async function flushKey(schluessel: string): Promise<void> {
  const p = pending.get(schluessel)
  if (!p) return
  pending.delete(schluessel)
  const ok = await postEintraege([
    { schluessel, payload: p.payload, aktualisiertAm: p.aktualisiertAm },
  ])
  if (ok) {
    cloudCache.set(schluessel, {
      schluessel,
      payload: p.payload,
      aktualisiertAm: p.aktualisiertAm,
    })
  }
}

/**
 * Lokal geänderten Schlüssel in die Cloud legen (debounced).
 * No-op während `mitCloudApply` (sonst Endlosschleife).
 */
export function pushClientState(schluessel: string, payload: unknown, opts?: { debounceMs?: number }): void {
  if (typeof window === 'undefined' || istCloudApplyAktiv()) return
  if (!pullErledigt) return
  const am = setzeClientStateRev(schluessel)
  pending.set(schluessel, { payload, aktualisiertAm: am })
  const wait = opts?.debounceMs ?? DEFAULT_DEBOUNCE_MS[schluessel] ?? 500
  const prev = timers.get(schluessel)
  if (prev) clearTimeout(prev)
  timers.set(
    schluessel,
    setTimeout(() => {
      timers.delete(schluessel)
      void flushKey(schluessel)
    }, wait),
  )
}

function cloudIstNeuer(cloudAm: string, lokalAm: string | null): boolean {
  if (!lokalAm) return true
  return cloudAm >= lokalAm
}

/**
 * Cloud laden, aufs Gerät schreiben, lokale Lücken hochladen.
 * Ein Aufruf gleichzeitig (weitere warten auf dasselbe Promise).
 */
export function pullClientState(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (pullPromise) return pullPromise
  pullPromise = (async () => {
    try {
      const res = await fetch('/api/client-state/sync')
      if (res.status === 401) return
      const j = (await res.json()) as { ok?: boolean; eintraege?: ClientStateEintrag[] }
      if (!j.ok || !Array.isArray(j.eintraege)) return

      cloudCache = new Map(j.eintraege.map((e) => [e.schluessel, e]))
      const gesehen = new Set<string>()
      const rang = (s: string) =>
        s === CLIENT_STATE_KEYS.modeberater ? 0 : s === CLIENT_STATE_KEYS.modeberaterFotos ? 1 : 2
      const geordnet = [...j.eintraege].sort((a, b) => rang(a.schluessel) - rang(b.schluessel))

      for (const e of geordnet) {
        gesehen.add(e.schluessel)
        const lokalAm = leseClientStateRev(e.schluessel)
        const immerMerge = e.schluessel === CLIENT_STATE_KEYS.fitnessDaily
        if (!immerMerge && !cloudIstNeuer(e.aktualisiertAm, lokalAm)) continue
        await wendeClientStateAn(e)
        setzeClientStateRev(e.schluessel, e.aktualisiertAm)
      }

      const uploads: ClientStateEintrag[] = []
      for (const key of ALLE_UPLOAD_KEYS) {
        if (gesehen.has(key) && key !== CLIENT_STATE_KEYS.fitnessDaily) continue
        const payload = await leseLocalPayload(key)
        if (payload == null) continue
        const am = leseClientStateRev(key) || setzeClientStateRev(key)
        uploads.push({ schluessel: key, payload, aktualisiertAm: am })
      }
      if (uploads.length > 0) {
        const ok = await postEintraege(uploads)
        if (ok) {
          for (const u of uploads) cloudCache.set(u.schluessel, u)
        }
      }
    } catch {
      /* offline */
    } finally {
      pullErledigt = true
      try {
        window.dispatchEvent(new Event(CLIENT_STATE_READY_EVENT))
      } catch {
        /* ignore */
      }
    }
  })().finally(() => {
    pullPromise = null
  })
  return pullPromise
}

/** Fire-and-forget Push aus Fachmodulen (dynamic import, keine Zyklen). */
export function pushClientStateKey(schluessel: ClientStateKey, payload: unknown, opts?: { debounceMs?: number }): void {
  pushClientState(schluessel, payload, opts)
}

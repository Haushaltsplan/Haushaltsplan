/**
 * Offline-Sync: Band speichert bei fehlender Verbindung — Gen5-Historie + lokaler Puffer.
 */

import {
  createEmptyDayRecord,
  ladeDailyStore,
  speichereDailyStore,
  type WhoopDayRecord,
} from '@/lib/fitnessdaten/daily-records'
import { ladeFitnessHistory, ladeFitnessSnapshot, mergeLiveSnapshot, speichereFitnessHistory, speichereFitnessSnapshot } from '@/lib/fitnessdaten/history-storage'
import { heuteIsoLocal, maxHr, ruhepulsSchaetzung } from '@/lib/fitnessdaten/scores'
import type { FitnessSnapshot } from '@/lib/fitnessdaten/types'
import type { Gen5EventSample, R22Sample } from '@/lib/fitnessdaten/whoop-gen5-protocol'

export const SYNC_STATE_KEY = 'mein-haushalt:fitnessdaten-sync'
export const SYNC_BUFFER_KEY = 'mein-haushalt:fitnessdaten-sync-buffer'

export type SyncState = {
  version: 1
  lastConnectedAt: string | null
  lastSyncedAt: string | null
  lastDisconnectedAt: string | null
  historicalPacketsTotal: number
  pendingBufferCount: number
  status: 'idle' | 'syncing' | 'live' | 'offline'
  message: string | null
}

type BufferedSample = {
  kind: 'r22' | 'event'
  t: number
  bpm?: number
  accel?: { x: number; y: number; z: number } | null
  skinTempC?: number | null
}

function defaultSyncState(): SyncState {
  return {
    version: 1,
    lastConnectedAt: null,
    lastSyncedAt: null,
    lastDisconnectedAt: null,
    historicalPacketsTotal: 0,
    pendingBufferCount: 0,
    status: 'idle',
    message: null,
  }
}

export function ladeSyncState(): SyncState {
  if (typeof window === 'undefined') return defaultSyncState()
  try {
    const raw = window.localStorage.getItem(SYNC_STATE_KEY)
    if (!raw) return defaultSyncState()
    const p = JSON.parse(raw) as SyncState
    return p.version === 1 ? p : defaultSyncState()
  } catch {
    return defaultSyncState()
  }
}

export function speichereSyncState(state: SyncState): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state))
}

function ladeBuffer(): BufferedSample[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(SYNC_BUFFER_KEY)
    if (!raw) return []
    return JSON.parse(raw) as BufferedSample[]
  } catch {
    return []
  }
}

function speichereBuffer(buf: BufferedSample[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SYNC_BUFFER_KEY, JSON.stringify(buf.slice(-2000)))
  const st = ladeSyncState()
  st.pendingBufferCount = buf.length
  speichereSyncState(st)
}

export function r22ZuTimestampMs(tsSec: number): number {
  if (tsSec > 1_000_000_000) return tsSec * 1000
  if (tsSec > 1_000_000) return tsSec
  return Date.now() - Math.min(tsSec, 86_400) * 1000
}

export function markiereVerbunden(): SyncState {
  const st = ladeSyncState()
  st.lastConnectedAt = new Date().toISOString()
  st.status = 'live'
  st.message = null
  speichereSyncState(st)
  return st
}

export function markiereGetrennt(): SyncState {
  const st = ladeSyncState()
  st.lastDisconnectedAt = new Date().toISOString()
  st.status = 'offline'
  st.message = 'Band getrennt — Daten werden beim nächsten Verbinden nachgeladen.'
  speichereSyncState(st)
  return st
}

export function markiereSyncStart(): SyncState {
  const st = ladeSyncState()
  st.status = 'syncing'
  st.message = 'Synchronisiere gespeicherte Band-Daten …'
  speichereSyncState(st)
  return st
}

export function markiereHistoriePaket(): SyncState {
  const st = ladeSyncState()
  st.historicalPacketsTotal++
  st.status = 'syncing'
  speichereSyncState(st)
  return st
}

export function markiereSyncFertig(): SyncState {
  const st = ladeSyncState()
  st.lastSyncedAt = new Date().toISOString()
  st.status = 'live'
  st.message = null
  st.pendingBufferCount = 0
  speichereSyncState(st)
  return st
}

/** r22-Historie vom Band in Historie + Tageswerte mergen. */
export function mergeHistoricalR22(
  sample: R22Sample,
  deviceName: string,
  deviceInfo: FitnessSnapshot['deviceInfo'],
): FitnessSnapshot | null {
  if (sample.heartRateBpm <= 0) return null
  const t = r22ZuTimestampMs(sample.tsSec)
  const history = ladeFitnessHistory()
  const isoDate = new Date(t).toISOString().slice(0, 10)

  history.hrSeries.push({ t, bpm: sample.heartRateBpm })
  if (history.hrSeries.length > 600) history.hrSeries = history.hrSeries.slice(-600)
  speichereFitnessHistory(history)

  aktualisiereTagAusHistorie(isoDate, {
    restingHr: ruhepulsSchaetzung(history.hrSeries.filter((p) => new Date(p.t).toISOString().slice(0, 10) === isoDate)),
    maxHr: maxHr(history.hrSeries.filter((p) => new Date(p.t).toISOString().slice(0, 10) === isoDate)),
  })

  const partial: FitnessSnapshot = {
    updatedAt: new Date().toISOString(),
    deviceName,
    connectionState: 'syncing',
    live: {
      heartRateBpm: sample.heartRateBpm,
      rrIntervalsMs: [],
      skinTempC: null,
      accel: sample.accel,
      recordedAt: new Date(t).toISOString(),
    },
    hrHistory: [{ t, bpm: sample.heartRateBpm }],
  }

  if (isoDate === heuteIsoLocal()) {
    const snap = mergeLiveSnapshot(partial, deviceInfo)
    return { ...snap, syncBackfill: true }
  }

  const existing = ladeFitnessSnapshot()
  const merged: FitnessSnapshot = {
    ...(existing ?? {}),
    ...partial,
    deviceInfo: deviceInfo ?? partial.deviceInfo ?? existing?.deviceInfo,
  }
  speichereFitnessSnapshot(merged)
  return { ...merged, syncBackfill: true }
}

export function mergeHistoricalEvent(
  ev: Gen5EventSample,
  snapshot: FitnessSnapshot,
): FitnessSnapshot {
  const t = r22ZuTimestampMs(ev.tsSec)
  const isoDate = new Date(t).toISOString().slice(0, 10)
  if (ev.skinTempC != null) {
    aktualisiereTagAusHistorie(isoDate, { skinTempC: ev.skinTempC })
  }
  return {
    ...snapshot,
    updatedAt: new Date().toISOString(),
    connectionState: 'syncing',
    live: snapshot.live
      ? {
          ...snapshot.live,
          skinTempC: ev.skinTempC ?? snapshot.live.skinTempC,
          recordedAt: new Date(t).toISOString(),
        }
      : snapshot.live,
    deviceInfo: {
      ...snapshot.deviceInfo,
      batteryPercent: ev.batteryPercent ?? snapshot.deviceInfo?.batteryPercent,
    },
  }
}

function aktualisiereTagAusHistorie(
  isoDate: string,
  partial: Partial<WhoopDayRecord>,
): void {
  const store = ladeDailyStore()
  let rec = store.days.find((d) => d.date === isoDate)
  if (!rec) {
    rec = leeresTag(isoDate)
    store.days.push(rec)
  }
  Object.assign(rec, partial)
  store.days.sort((a, b) => a.date.localeCompare(b.date))
  if (store.days.length > 35) store.days = store.days.slice(-35)
  speichereDailyStore(store)
}

function leeresTag(date: string): WhoopDayRecord {
  return createEmptyDayRecord(date)
}

/** Puffer für Samples, die während kurzer Disconnects nicht gemergt wurden. */
export function puffereSample(sample: BufferedSample): void {
  const buf = ladeBuffer()
  buf.push(sample)
  speichereBuffer(buf)
}

export function verarbeiteSyncPuffer(
  deviceName: string,
  deviceInfo: FitnessSnapshot['deviceInfo'],
): number {
  const buf = ladeBuffer()
  if (buf.length === 0) return 0
  let n = 0
  for (const s of buf.sort((a, b) => a.t - b.t)) {
    if (s.kind === 'r22' && s.bpm && s.bpm > 0) {
      mergeHistoricalR22(
        { tsSec: Math.floor(s.t / 1000), heartRateBpm: s.bpm, heartRate2Bpm: 0, accel: s.accel ?? null },
        deviceName,
        deviceInfo,
      )
      n++
    }
  }
  speichereBuffer([])
  markiereSyncFertig()
  return n
}

export function loescheSyncDaten(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(SYNC_STATE_KEY)
  window.localStorage.removeItem(SYNC_BUFFER_KEY)
}

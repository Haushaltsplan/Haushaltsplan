/** Manuelle Vitalwerte (Blutdruck etc.) — lokal. */

import {
  createEmptyDayRecord,
  ladeDailyStore,
  speichereDailyStore,
  type VitalLogEntry,
} from '@/lib/fitnessdaten/daily-records'

export function fuegeVitalEintragHinzu(entry: Omit<VitalLogEntry, 'id' | 'recordedAt'> & { recordedAt?: string }): VitalLogEntry {
  const store = ladeDailyStore()
  const voll: VitalLogEntry = {
    id: crypto.randomUUID(),
    recordedAt: entry.recordedAt ?? new Date().toISOString(),
    date: entry.date,
    bpSystolic: entry.bpSystolic,
    bpDiastolic: entry.bpDiastolic,
    spo2Manual: entry.spo2Manual,
    note: entry.note,
  }
  store.vitals.push(voll)
  store.vitals.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
  if (store.vitals.length > 200) store.vitals = store.vitals.slice(0, 200)

  if (voll.bpSystolic != null || voll.bpDiastolic != null) {
    const idx = store.days.findIndex((d) => d.date === voll.date)
    const tag = idx >= 0 ? store.days[idx]! : createEmptyDayRecord(voll.date)
    tag.bpSystolic = voll.bpSystolic ?? tag.bpSystolic
    tag.bpDiastolic = voll.bpDiastolic ?? tag.bpDiastolic
    if (idx >= 0) store.days[idx] = tag
    else store.days.push(tag)
    store.days.sort((a, b) => a.date.localeCompare(b.date))
  }

  speichereDailyStore(store)
  return voll
}

export function loescheVitalEintrag(id: string): void {
  const store = ladeDailyStore()
  store.vitals = store.vitals.filter((v) => v.id !== id)
  speichereDailyStore(store)
}

export function letzteVitalEintraege(limit = 10): VitalLogEntry[] {
  return ladeDailyStore().vitals.slice(0, limit)
}

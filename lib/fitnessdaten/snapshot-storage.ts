import type { FitnessSnapshot } from '@/lib/fitnessdaten/types'
import { FITNESS_SNAPSHOT_STORAGE_KEY } from '@/lib/fitnessdaten/types'

export function ladeFitnessSnapshot(): FitnessSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(FITNESS_SNAPSHOT_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as FitnessSnapshot
  } catch {
    return null
  }
}

export function speichereFitnessSnapshot(snapshot: FitnessSnapshot): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(FITNESS_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot))
}

export function parseFitnessSnapshotJson(text: string): FitnessSnapshot {
  const parsed = JSON.parse(text) as FitnessSnapshot
  if (!parsed || typeof parsed.updatedAt !== 'string') {
    throw new Error('Ungültiges Format: Feld „updatedAt“ (ISO-Datum) fehlt.')
  }
  return parsed
}

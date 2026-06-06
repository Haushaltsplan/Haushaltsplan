/** Live-Werte aus dem WHOOP-BLE-Stream (Flutter-App → Sync). */
export type FitnessLiveSample = {
  heartRateBpm: number | null
  rrIntervalsMs: number[]
  skinTempC: number | null
  accel: { x: number; y: number; z: number } | null
  recordedAt: string
}

/** Lokal berechnete Scores (ohne WHOOP-Cloud). */
export type FitnessScores = {
  hrvRmssdMs?: number | null
  strain?: number | null
  sleepMinutes?: number | null
}

/** Gespeicherter Stand für die Web-Ansicht. */
export type FitnessSnapshot = {
  updatedAt: string
  deviceName?: string
  connectionState?: 'disconnected' | 'connecting' | 'syncing' | 'live'
  live?: FitnessLiveSample | null
  scores?: FitnessScores | null
}

export const FITNESS_SNAPSHOT_STORAGE_KEY = 'mein-haushalt:fitnessdaten-snapshot'

/** Live-Werte aus dem WHOOP-BLE-Stream. */
export type FitnessLiveSample = {
  heartRateBpm: number | null
  rrIntervalsMs: number[]
  skinTempC: number | null
  accel: { x: number; y: number; z: number } | null
  /** Kontakt Sensor–Haut (Standard-HR-Flags). */
  sensorContact?: boolean | null
  /** Energieverbrauch kumuliert (kJ), falls vom Band geliefert. */
  energyExpendedKj?: number | null
  recordedAt: string
}

/** Geräteinformationen (Standard GATT 0x180A + Battery). */
export type WhoopDeviceInfo = {
  manufacturer?: string | null
  model?: string | null
  hardwareRevision?: string | null
  firmwareRevision?: string | null
  batteryPercent?: number | null
  serialHint?: string | null
}

/** HR-Zeitpunkt für Verlaufsgrafik. */
export type FitnessHrPoint = {
  t: number
  bpm: number
}

/** Herzfrequenz-Zonen (Prozent der Max-HF). */
export type HrZoneKey = 'rest' | 'z1' | 'z2' | 'z3' | 'z4' | 'z5'

export type HrZoneMinutes = Record<HrZoneKey, number>

/** Lokal berechnete WHOOP-ähnliche Scores (ohne Cloud). */
export type FitnessScores = {
  hrvRmssdMs?: number | null
  /** Ruhepuls-Schätzung aus niedrigen HR-Werten. */
  restingHrBpm?: number | null
  /** Recovery 0–100 % (HRV + RHR vs. Baseline). */
  recoveryPercent?: number | null
  recoveryLabel?: 'optimal' | 'ausreichend' | 'niedrig' | null
  /** Strain 0–21 (kardiovaskuläre Belastung heute / Session). */
  strain?: number | null
  /** Tages-Strain akkumuliert. */
  dayStrain?: number | null
  /** Schlaf — nur mit Historie/IMU; sonst null. */
  sleepScore?: number | null
  sleepMinutes?: number | null
  sleepEfficiency?: number | null
  /** Geschätzte Kalorien (HR-basiert). */
  caloriesKcal?: number | null
  maxHrToday?: number | null
  avgHrSession?: number | null
  zoneMinutes?: HrZoneMinutes | null
}

/** Gen5 Custom-BLE (fd4b) Status. */
export type Gen5StreamStatus = {
  phase: string
  r22Count: number
  historyPackets: number
  lastError: string | null
  log: string[]
}

/** Gespeicherter Stand für die Web-Ansicht. */
export type FitnessSnapshot = {
  updatedAt: string
  deviceName?: string
  connectionState?: 'disconnected' | 'connecting' | 'syncing' | 'live' | 'waiting_hr'
  live?: FitnessLiveSample | null
  scores?: FitnessScores | null
  deviceInfo?: WhoopDeviceInfo | null
  /** Letzte ~120 HR-Punkte für Live-Chart. */
  hrHistory?: FitnessHrPoint[]
  sessionStartedAt?: string | null
  gen5?: Gen5StreamStatus | null
}

/** Persistierte Historie für Baselines & Tageswerte. */
export type FitnessHistoryState = {
  version: 1
  hrSeries: FitnessHrPoint[]
  hrvSamples: { t: number; rmssd: number }[]
  rhrSamples: { t: number; bpm: number }[]
  dayStrain: number
  dayStrainDate: string
  zoneSecondsToday: HrZoneMinutes
  caloriesToday: number
  baselines: {
    hrvRmssdMs: number
    restingHrBpm: number
  }
  maxHrEstimate: number
  userAge: number
}

export const FITNESS_SNAPSHOT_STORAGE_KEY = 'mein-haushalt:fitnessdaten-snapshot'
export const FITNESS_HISTORY_STORAGE_KEY = 'mein-haushalt:fitnessdaten-history'

export const HR_ZONE_LABELS: Record<HrZoneKey, string> = {
  rest: 'Ruhe',
  z1: 'Zone 1',
  z2: 'Zone 2',
  z3: 'Zone 3',
  z4: 'Zone 4',
  z5: 'Zone 5',
}

export const HR_ZONE_COLORS: Record<HrZoneKey, string> = {
  rest: '#3f3f46',
  z1: '#3b82f6',
  z2: '#22c55e',
  z3: '#eab308',
  z4: '#f97316',
  z5: '#ef4444',
}

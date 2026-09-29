/** Whoop Visual DNA — einzige Quelle für Farben im Omnia-Whoop-Dashboard. */

export const WHOOP_COLORS = {
  bg: '#0B0E14',
  surface: '#12161F',
  surfaceRaised: '#1A202C',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  track: 'rgba(255,255,255,0.08)',

  text: '#F4F5F7',
  textMuted: '#8B93A1',
  axis: '#6B7280',
  grid: 'rgba(255,255,255,0.05)',

  strain: '#00B2FE',
  strainBright: '#00E5FF',
  sleep: '#29B6F6',
  sleepDeep: '#00B8D4',
  hrv: '#E5E7EB',
  rhr: '#C4B5FD',
  respiratory: '#99F6E4',
  calories: '#FFB74D',

  recoveryGreen: '#00E676',
  recoveryYellow: '#FFD600',
  recoveryRed: '#FF1744',
  none: '#4B5563',
} as const

export const WHOOP_SLEEP_STAGES = {
  awake: { label: 'Wach', color: '#CBD5E1' },
  light: { label: 'Leicht', color: '#64B5F6' },
  rem: { label: 'REM', color: '#00B8D4' },
  deep: { label: 'Tief', color: '#7C6CFF' },
} as const

export type WhoopSleepStageKey = keyof typeof WHOOP_SLEEP_STAGES

/** HF-Zonen: kalt → heiß, gleiche Reihenfolge wie `HrZoneKey`. */
export const WHOOP_ZONE_COLORS = {
  rest: '#3A4150',
  z1: '#4FC3F7',
  z2: '#00E676',
  z3: '#FFD600',
  z4: '#FF9100',
  z5: '#FF1744',
} as const

export type RecoveryBand = 'green' | 'yellow' | 'red' | 'none'

export function recoveryBand(percent: number | null | undefined): RecoveryBand {
  if (percent == null) return 'none'
  if (percent >= 67) return 'green'
  if (percent >= 34) return 'yellow'
  return 'red'
}

const RECOVERY_SOLID: Record<RecoveryBand, string> = {
  green: WHOOP_COLORS.recoveryGreen,
  yellow: WHOOP_COLORS.recoveryYellow,
  red: WHOOP_COLORS.recoveryRed,
  none: WHOOP_COLORS.none,
}

/** Verlauf [Start, Ende] für Ringe — dunklere Basis, leuchtendes Ende. */
const RECOVERY_GRADIENT: Record<RecoveryBand, readonly [string, string]> = {
  green: ['#00B85C', '#69F0AE'],
  yellow: ['#FFAB00', '#FFEA00'],
  red: ['#C4001D', '#FF5A6E'],
  none: ['#374151', '#4B5563'],
}

export function recoveryColorToken(percent: number | null | undefined): string {
  return RECOVERY_SOLID[recoveryBand(percent)]
}

export function recoveryGradient(percent: number | null | undefined): readonly [string, string] {
  return RECOVERY_GRADIENT[recoveryBand(percent)]
}

export const STRAIN_GRADIENT = ['#0077FF', WHOOP_COLORS.strainBright] as const
export const SLEEP_GRADIENT = ['#0288D1', '#4FC3F7'] as const

/** Hex → rgba mit Alpha (für Glows / Flächen). */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return hex
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

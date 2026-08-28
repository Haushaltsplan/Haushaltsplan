/** Persönliche Angaben für Kalorien, HF-Zonen und Healthspan. */

import { maxHrSchaetzung } from '@/lib/fitnessdaten/scores'

export const FITNESS_PROFILE_STORAGE_KEY = 'mein-haushalt:fitnessdaten-profil'

export type FitnessGender = 'male' | 'female' | 'diverse'

export type FitnessUserProfile = {
  version: 1
  /** Geburtsjahr — Alter wird daraus berechnet. */
  birthYear: number | null
  gender: FitnessGender | null
  heightCm: number | null
  weightKg: number | null
  /** Optional: eigene Max-HF statt 220 − Alter. */
  maxHrOverride: number | null
}

export const DEFAULT_FITNESS_PROFILE: FitnessUserProfile = {
  version: 1,
  birthYear: null,
  gender: null,
  heightCm: null,
  weightKg: null,
  maxHrOverride: null,
}

export function profilAlter(profile: FitnessUserProfile, refDate = new Date()): number {
  if (profile.birthYear != null && profile.birthYear >= 1900 && profile.birthYear <= refDate.getFullYear()) {
    return Math.max(16, Math.min(100, refDate.getFullYear() - profile.birthYear))
  }
  return 30
}

export function profilMaennlich(profile: FitnessUserProfile): boolean {
  return profile.gender !== 'female'
}

export function profilGewichtKg(profile: FitnessUserProfile): number {
  return profile.weightKg != null && profile.weightKg > 0 ? profile.weightKg : 75
}

export function profilMaxHr(profile: FitnessUserProfile): number {
  if (profile.maxHrOverride != null && profile.maxHrOverride >= 100 && profile.maxHrOverride <= 230) {
    return Math.round(profile.maxHrOverride)
  }
  return maxHrSchaetzung(profilAlter(profile))
}

export function profilBmi(profile: FitnessUserProfile): number | null {
  if (
    profile.heightCm == null ||
    profile.weightKg == null ||
    profile.heightCm < 100 ||
    profile.heightCm > 250 ||
    profile.weightKg < 30 ||
    profile.weightKg > 300
  ) {
    return null
  }
  const m = profile.heightCm / 100
  return Math.round((profile.weightKg / (m * m)) * 10) / 10
}

export function ladeFitnessProfil(): FitnessUserProfile {
  if (typeof window === 'undefined') return { ...DEFAULT_FITNESS_PROFILE }
  try {
    const raw = window.localStorage.getItem(FITNESS_PROFILE_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_FITNESS_PROFILE }
    const parsed = JSON.parse(raw) as FitnessUserProfile
    if (parsed.version !== 1) return { ...DEFAULT_FITNESS_PROFILE }
    return normalisiereProfil(parsed)
  } catch {
    return { ...DEFAULT_FITNESS_PROFILE }
  }
}

export function speichereFitnessProfil(profile: FitnessUserProfile): void {
  if (typeof window === 'undefined') return
  const next = normalisiereProfil(profile)
  window.localStorage.setItem(FITNESS_PROFILE_STORAGE_KEY, JSON.stringify(next))
  void import('@/lib/client-state/client-state-sync').then(({ pushClientState }) => {
    pushClientState('fitness-profil', next)
  })
}

function normalisiereProfil(p: FitnessUserProfile): FitnessUserProfile {
  const clamp = (n: number | null, min: number, max: number): number | null =>
    n != null && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null

  return {
    version: 1,
    birthYear: clamp(p.birthYear, 1920, new Date().getFullYear()),
    gender: p.gender === 'male' || p.gender === 'female' || p.gender === 'diverse' ? p.gender : null,
    heightCm: clamp(p.heightCm, 100, 250),
    weightKg: clamp(p.weightKg, 30, 300),
    maxHrOverride: clamp(p.maxHrOverride, 100, 230),
  }
}

/** History-Felder aus Profil ableiten (Alter, Max-HF). */
export function wendeProfilAufHistory(
  history: { userAge: number; maxHrEstimate: number },
  profile = ladeFitnessProfil(),
): void {
  history.userAge = profilAlter(profile)
  history.maxHrEstimate = profilMaxHr(profile)
}

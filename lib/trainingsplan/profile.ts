/** Persönliches Trainingsprofil für den Omnia-Coach. */
export const TRAININGS_PROFIL = {
  alter: 27,
  groesseCm: 180,
  gewichtKg: 71,
  rennradKmJahr: '5.500–6.000',
  /** Fallback, wenn kein Name in Auth/localStorage. */
  defaultName: 'Champion',
} as const

/** Fixiertes Ziel: sichtbarer Sixpack & definierter Oberkörper bis Ende Februar 2027. */
export const TRAININGS_ZIEL = {
  datumIso: '2027-02-28',
  label: 'Ende Februar 2027',
  kernziele: [
    'Ausgeprägter Sixpack & definierter Oberkörper/Arme — ohne unnötiges Fett',
    'Relative Bergleistung (W/kg) am Rennrad halten',
    'Funktionelle Kraft für den Hausbau (Schultern, Brust, Rücken, Rumpf, Grip)',
  ] as const,
} as const

export const TRAININGS_EQUIPMENT = [
  'Kurzhanteln',
  'Rudergerät (SportPlus)',
  'Körpergewicht',
] as const

/** Planstart für Fortschrittsrechnung (Kalenderwochen bis Ziel). */
export const TRAININGS_PLAN_START_ISO = '2026-10-13'

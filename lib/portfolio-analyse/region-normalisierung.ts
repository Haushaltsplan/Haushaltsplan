const REGION_KANONISCH: Record<string, string> = {
  US: 'Vereinigte Staaten',
  USA: 'Vereinigte Staaten',
  'United States': 'Vereinigte Staaten',
  'United States of America': 'Vereinigte Staaten',
  DE: 'Deutschland',
  Germany: 'Deutschland',
  FR: 'Frankreich',
  France: 'Frankreich',
  GB: 'Vereinigtes Königreich',
  UK: 'Vereinigtes Königreich',
  'United Kingdom': 'Vereinigtes Königreich',
  CH: 'Schweiz',
  Switzerland: 'Schweiz',
  NL: 'Niederlande',
  Netherlands: 'Niederlande',
  IE: 'Irland',
  Ireland: 'Irland',
  CA: 'Kanada',
  Canada: 'Kanada',
  JP: 'Japan',
  Japan: 'Japan',
  CN: 'China',
  China: 'China',
  TW: 'Taiwan',
  Taiwan: 'Taiwan',
  'Nicht aufgelöst': 'Nicht aufgelöst',
  Unbekannt: 'Sonstige',
  Sonstige: 'Sonstige',
}

export function normalisiereRegion(codeOrName: string | null | undefined): string {
  const raw = codeOrName?.trim()
  if (!raw) return 'Sonstige'
  const upper = raw.toUpperCase()
  return REGION_KANONISCH[raw] ?? REGION_KANONISCH[upper] ?? raw
}

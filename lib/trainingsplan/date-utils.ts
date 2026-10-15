const WEEKDAY_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'] as const

export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y!, m! - 1, d!, 12, 0, 0, 0)
}

export function addDaysIso(iso: string, days: number): string {
  const d = parseIsoDate(iso)
  d.setDate(d.getDate() + days)
  return toIsoDate(d)
}

export function heuteIsoLocal(): string {
  return toIsoDate(new Date())
}

/** Montag der Woche (ISO-Woche, lokal). */
export function weekStartMontag(iso: string = heuteIsoLocal()): string {
  const d = parseIsoDate(iso)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toIsoDate(d)
}

export function weekdayName(iso: string): string {
  return WEEKDAY_DE[parseIsoDate(iso).getDay()] ?? ''
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = parseIsoDate(fromIso).getTime()
  const b = parseIsoDate(toIso).getTime()
  return Math.round((b - a) / 86_400_000)
}

export function formatDeDate(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

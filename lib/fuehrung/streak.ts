import { heuteIso, type FuehrungTagesEintrag } from '@/lib/fuehrung/store'

function addDaysIso(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + delta)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Aufeinanderfolgende Tage mit Abend-Check, endend heute oder gestern. */
export function berechneAbendCheckStreak(
  tage: Record<string, FuehrungTagesEintrag>,
  heute = heuteIso(),
): number {
  let start = heute
  if (!tage[heute]?.abendCheckErledigt) {
    const gestern = addDaysIso(heute, -1)
    if (!tage[gestern]?.abendCheckErledigt) return 0
    start = gestern
  }
  let streak = 0
  let cursor = start
  while (tage[cursor]?.abendCheckErledigt) {
    streak++
    cursor = addDaysIso(cursor, -1)
  }
  return streak
}

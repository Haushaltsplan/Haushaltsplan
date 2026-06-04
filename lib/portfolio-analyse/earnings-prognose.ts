import { addDaysIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import type { DivvydiaryEarningsRoh } from '@/lib/portfolio-analyse/divvydiary-scraper-server'

export type EarningsTerminTreffer = {
  terminDatumIso: string
  bestaetigt: boolean
}

const MONATE_NACH_FREQUENCY: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  biannually: 6,
  semiannually: 6,
  annually: 12,
  annual: 12,
  yearly: 12,
}

function addMonateIso(iso: string, monate: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1 + monate, d))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

function monateAusFrequency(freq: string | null): number {
  if (!freq) return 3
  const key = freq.trim().toLowerCase()
  return MONATE_NACH_FREQUENCY[key] ?? 3
}

/** Nächster Quartals-/Halbjahres-Termin im Horizont (DivvyDiary + Schätzung). */
export function naechsterEarningsTermin(
  roh: DivvydiaryEarningsRoh,
  heute: string,
  bis: string,
): EarningsTerminTreffer | null {
  let datum = roh.earningsDate
  let bestaetigt = !roh.earningsDateEstimated
  const schrittMonate = monateAusFrequency(roh.dividendFrequency)

  if (datum >= heute && datum <= bis) {
    return { terminDatumIso: datum, bestaetigt }
  }

  let guard = 0
  while (datum < heute && guard < 8) {
    datum = addMonateIso(datum, schrittMonate)
    bestaetigt = false
    guard++
  }

  if (datum >= heute && datum <= bis) {
    return { terminDatumIso: datum, bestaetigt }
  }

  if (datum > bis) return null

  guard = 0
  while (datum <= bis && guard < 6) {
    const next = addMonateIso(datum, schrittMonate)
    if (next > bis) break
    if (next >= heute) return { terminDatumIso: next, bestaetigt: false }
    datum = next
    guard++
  }

  const fallback = addDaysIso(heute, 90)
  if (fallback <= bis) {
    return { terminDatumIso: fallback, bestaetigt: false }
  }

  return null
}

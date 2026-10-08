/**
 * Persönliche Dividendenrendite (Yield on Cost) pro Position:
 * aktuelle Jahresausschüttung relativ zum Einstandskurs — nicht zum Marktpreis.
 */

import { gezahlteDividendeEur } from '@/lib/portfolio-analyse/dividenden-buchung'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function monatsKey(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(iso.trim())
  return m ? `${m[1]}-${m[2]}` : null
}

/** TTM Bardividenden je ISIN (letzte 12 Kalendermonate inkl. aktuellem). */
export function dividendenTtmJeIsin(buchungen: PortfolioBuchung[]): Map<string, number> {
  const jetzt = new Date()
  const ttmKeys = new Set<string>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(jetzt.getFullYear(), jetzt.getMonth() - i, 1)
    ttmKeys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const map = new Map<string, number>()
  const heute = new Date().toISOString().slice(0, 10)
  for (const b of buchungen) {
    if (!b.isin || b.datum > heute) continue
    const zahlung = gezahlteDividendeEur(b)
    if (zahlung <= 0) continue
    const k = monatsKey(b.datum)
    if (!k || !ttmKeys.has(k)) continue
    const key = b.isin.toUpperCase()
    map.set(key, round2((map.get(key) ?? 0) + zahlung))
  }
  return map
}

export type PersDivRenditeEingabe = {
  einstandEur: number
  stueck: number
  /** Marktpreis je Aktie (EUR), für Yield×Preis/Einstand */
  kursLiveEur?: number | null
  /** Unternehmens-Div-Rendite in Prozent (z. B. 1.2 = 1,2 %) */
  dividendYieldPct?: number | null
  /** Jahres-Div je Aktie (Yahoo trailingAnnualDividendRate) */
  trailingAnnualDividendRate?: number | null
  /** TTM erhaltene Div in EUR (Fallback) */
  ttmDividendenEur?: number | null
}

/**
 * Pers. Div-Rendite in % oder null.
 * Priorität: Marktrendite×(Kurs/Einstand) → DPS/Einstand → TTM-Cash/Einstand.
 */
export function berechnePersoenlicheDivRenditeProzent(e: PersDivRenditeEingabe): number | null {
  const einstand = e.einstandEur
  const stueck = e.stueck
  if (!(einstand > 0) || !(stueck > 0)) return null
  const einstandKurs = einstand / stueck
  if (!(einstandKurs > 0)) return null

  const yieldPct = e.dividendYieldPct
  const kurs = e.kursLiveEur
  if (
    yieldPct != null &&
    Number.isFinite(yieldPct) &&
    yieldPct > 0 &&
    kurs != null &&
    Number.isFinite(kurs) &&
    kurs > 0
  ) {
    return round2(yieldPct * (kurs / einstandKurs))
  }

  const dps = e.trailingAnnualDividendRate
  if (dps != null && Number.isFinite(dps) && dps > 0) {
    return round2((dps / einstandKurs) * 100)
  }

  const ttm = e.ttmDividendenEur
  if (ttm != null && Number.isFinite(ttm) && ttm > 0) {
    return round2((ttm / einstand) * 100)
  }

  return null
}

/** Aktuelle Div-Rendite auf Marktwert aus TTM-Cash (wenn keine Yahoo-Yield). */
export function berechneAktuelleDivRenditeAusTtm(
  ttmDividendenEur: number,
  marktwertEur: number,
): number | null {
  if (!(ttmDividendenEur > 0) || !(marktwertEur > 0)) return null
  return round2((ttmDividendenEur / marktwertEur) * 100)
}

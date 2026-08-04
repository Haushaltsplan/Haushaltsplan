/**
 * Parqet „Investiert“ / Einstand: Handelswert ohne doppelt gezählte Gebühren.
 * PDF-Kontoauszug: Brutto-Zahlungsausgang; Wertpapierabrechnung: Netto + separate Gebühr.
 */

import { istAktiendividendeAlsKauf } from '@/lib/portfolio-analyse/dividenden-buchung'
import { normalisiereHandelsBuchung } from '@/lib/portfolio-analyse/parqet-handelswerte'
import { irrBetragFuerKauf } from '@/lib/portfolio-analyse/parqet-xirr'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Einstand für Aktien-/Wahldividende (Parqet TransferIn / Wiederanlage). */
function aktiendividendeEinstandEur(b: PortfolioBuchung): number {
  if (b.betragEur > 0) return round2(b.betragEur)
  const stk = Math.abs(b.stueck ?? 0)
  if (stk > 0 && b.kursEur != null && b.kursEur > 0) return round2(stk * b.kursEur)
  return 0
}

/** Nur explizite Gebühr-Zeilen (keine Steuer) — für Abzug vom Brutto-Kauf. */
export function gebuehrIndex(buchungen: PortfolioBuchung[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const b of buchungen) {
    if (b.typ !== 'gebuehr') continue
    const isin = b.isin?.toUpperCase()
    if (!isin) continue
    const key = `${b.datum}|${isin}`
    map.set(key, round2((map.get(key) ?? 0) + b.betragEur))
  }
  return map
}

/** @deprecated Alias — früher inkl. Steuer (fehlerhaft für Einstand). */
export function gebuehrSteuerIndex(buchungen: PortfolioBuchung[]): Map<string, number> {
  return gebuehrIndex(buchungen)
}

/**
 * Einstandskosten für einen Kauf (ohne Cashflow — der bleibt brutto/geheilt).
 * Entspricht Parqet: zugeführtes Kapital steigt um Handelswert, nicht um Ordergebühr.
 */
export function kaufEinstandBetragEur(
  b: PortfolioBuchung,
  feeIndex: Map<string, number>,
): number {
  if (istAktiendividendeAlsKauf(b)) return aktiendividendeEinstandEur(b)

  const n = normalisiereHandelsBuchung(b)
  if (n.handelswertEur != null && n.handelswertEur > 0) {
    // Brutto-Kauf: Betrag > Handelswert → Einstand = HW
    if (n.handelswertEur < n.betragEur - 0.02) return n.handelswertEur
    // Netto-Kauf (Betrag ≈ HW): nie separate Gebühr vom Einstand abziehen
    if (Math.abs(n.handelswertEur - n.betragEur) <= 0.02) return n.handelswertEur
  }

  const netFromIrr = irrBetragFuerKauf({
    ...b,
    betragEur: n.betragEur,
    kursEur: n.kursEur,
    stueck: b.stueck != null && b.stueck < 0 ? -n.stueck : n.stueck || b.stueck,
  })
  if (netFromIrr < n.betragEur - 0.02) return netFromIrr

  // Nur wenn kein verlässlicher Kurs: Brutto-Betrag − explizite Gebühr desselben Tages
  const isin = b.isin?.toUpperCase()
  if (isin && n.handelswertEur == null) {
    const fees = feeIndex.get(`${b.datum}|${isin}`) ?? 0
    if (fees > 0 && n.betragEur > fees) {
      return round2(n.betragEur - fees)
    }
  }

  return n.betragEur
}

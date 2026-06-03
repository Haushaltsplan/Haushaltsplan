/**
 * Dividenden-Zufluss inkl. Wahldividende / Aktiendividende.
 * Parqet bucht Letztere oft als Buy oder TransferIn (nicht type=Dividend).
 */

import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function textProbe(b: PortfolioBuchung): string {
  return `${b.wertpapierName ?? ''} ${b.parqetTyp ?? ''}`.toLowerCase()
}

/** Explizit Wahldividende / Aktiendividende im Text. */
export function istWahldividendeText(b: PortfolioBuchung): boolean {
  const t = textProbe(b)
  return (
    /wahl[\s-]?dividend/.test(t) ||
    /aktiendividend/.test(t) ||
    /stock[\s_-]?dividend/.test(t) ||
    /dividende\s+in\s+aktien/.test(t) ||
    /ausschüttung\s+aktie/.test(t)
  )
}

/** Parqet-CSV: type=Dividend (auch wenn intern anders normalisiert). */
function istParqetDividendTyp(b: PortfolioBuchung): boolean {
  return /^dividend$/i.test((b.parqetTyp ?? '').trim())
}

/** Klassische Dividenden-Buchung. */
export function istKlassischeDividende(b: PortfolioBuchung): boolean {
  if (b.typ === 'dividende' || b.typ === 'zins') return true
  if (istParqetDividendTyp(b)) return true
  return false
}

/**
 * Aktien-/Wahldividende: Zufluss über Kauf/TransferIn (Stück + Gegenwert), nicht typ dividende.
 */
export function istAktiendividendeAlsKauf(b: PortfolioBuchung): boolean {
  if (!b.isin || b.typ !== 'kauf') return false
  if (istKlassischeDividende(b)) return false

  const parqet = (b.parqetTyp ?? '').trim()
  const stk = Math.abs(b.stueck ?? 0)

  if (istWahldividendeText(b)) return stk > 0

  /** Parqet: Wahldividende Aktienanteil oft als TransferIn mit amount + shares. */
  if (/^transferin$/i.test(parqet) && stk > 0 && b.betragEur > 0) return true

  /** Mensch und Maschine: Wahldividende oft als Kauf/Ertrag mit Stücken (0 € oder Gegenwert). */
  if (b.isin.toUpperCase() === 'DE0006580806' && stk > 0) {
    if (b.betragEur <= 0.01 && b.kursEur != null && b.kursEur > 0) return true
    if (/ertrag|dividend|ausschütt|wahl/i.test(textProbe(b))) return true
  }

  return false
}

/** EUR-Wert eines Dividenden-Zuflusses (Bar oder Aktienanteil). */
export function dividendenZuflussEur(b: PortfolioBuchung): number {
  if (istKlassischeDividende(b)) return round2(b.betragEur)

  if (!istAktiendividendeAlsKauf(b)) return 0

  if (b.betragEur > 0) return round2(b.betragEur)

  const stk = Math.abs(b.stueck ?? 0)
  if (stk > 0 && b.kursEur != null && b.kursEur > 0) {
    return round2(stk * b.kursEur)
  }
  return 0
}

/** Zählt zur Kaufsumme (Parqet-Dividenden-%), nicht bei Aktiendividende-Wiederanlage. */
export function zaehltAlsKaufVolumen(b: PortfolioBuchung): boolean {
  if (b.typ !== 'kauf' || !b.isin) return false
  if (istAktiendividendeAlsKauf(b)) return false
  return true
}

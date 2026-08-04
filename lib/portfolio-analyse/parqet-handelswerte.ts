/**
 * Handelswert / Cash-Betrag / eingebettete Ordergebühr — mit Heilung typischer Import-Fehler.
 *
 * Bekannter PDF-Bug (TR Wertpapierabrechnung): nur der Stückpreis landet in betragEur,
 * während stueck korrekt ist → Scheingebühren von Tausenden € und falsches Investiert.
 */

import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

export type NormalisierteHandelswerte = {
  stueck: number
  kursEur: number | null
  /** Cash-Betrag der Buchung (Kauf: Zahlungsausgang, Verkauf: -eingang). */
  betragEur: number
  handelswertEur: number | null
  geheilt: boolean
}

/**
 * Korrigiert offensichtliche Stück/Kurs/Betrag-Inkonsistenzen einer Kauf-/Verkauf-Buchung.
 * Andere Typen: unveränderte Beträge.
 */
export function normalisiereHandelsBuchung(
  b: Pick<PortfolioBuchung, 'typ' | 'stueck' | 'kursEur' | 'betragEur'>,
): NormalisierteHandelswerte {
  const stueck = Math.abs(b.stueck ?? 0)
  let kursEur = b.kursEur != null && b.kursEur > 0 ? b.kursEur : null
  let betragEur = round2(Math.abs(b.betragEur))
  let geheilt = false

  if ((b.typ === 'kauf' || b.typ === 'verkauf') && stueck > 0 && kursEur != null && betragEur > 0) {
    // Fall A: Mehrstück, Betrag == Stückpreis → Betrag war nur der Kurs (PDF)
    if (stueck > 1.01 && Math.abs(betragEur - kursEur) <= 0.05) {
      betragEur = round2(stueck * kursEur)
      geheilt = true
    }
    // Fall B: Bruchstück, Betrag == „Kurs“ → Kurs war der Cash-Betrag
    else if (stueck < 0.999 && Math.abs(betragEur - kursEur) <= 0.05) {
      kursEur = round4(betragEur / stueck)
      geheilt = true
    }
  }

  const handelswertEur =
    stueck > 0 && kursEur != null && kursEur > 0 ? round2(stueck * kursEur) : null

  return { stueck, kursEur, betragEur, handelswertEur, geheilt }
}

/** Cash-Delta-Betrag mit Heilung (positiv = Betrag der Buchung). */
export function cashBetragEur(b: PortfolioBuchung): number {
  if (b.typ === 'kauf' || b.typ === 'verkauf') {
    return normalisiereHandelsBuchung(b).betragEur
  }
  return round2(Math.abs(b.betragEur))
}

/**
 * Eingebettete Ordergebühr aus Kurs-Spread — nur wenn plausibel.
 * Keine Scheingebühren bei Dateninkonsistenz; Verkauf: Steuer nicht als Gebühr.
 */
export function eingebetteteOrdergebuehrEur(b: PortfolioBuchung): number {
  if (b.typ !== 'kauf' && b.typ !== 'verkauf') return 0
  const n = normalisiereHandelsBuchung(b)
  if (n.stueck <= 0 || n.handelswertEur == null || n.handelswertEur <= 0) return 0

  let gap =
    b.typ === 'kauf'
      ? round2(n.betragEur - n.handelswertEur)
      : round2(n.handelswertEur - n.betragEur)

  if (gap <= 0.01) return 0

  // Verkauf: Abzug Kapitalertragsteuer / Quellensteuer aus dem Spread
  if (b.typ === 'verkauf' && b.steuerEur != null && b.steuerEur > 0) {
    gap = round2(Math.max(0, gap - b.steuerEur))
    if (gap <= 0.01) return 0
  }

  // Unplausibel: >15 % vom Handelswert und >25 € → Importfehler, keine Gebühr
  if (gap > 25 && gap > n.handelswertEur * 0.15) return 0
  // Absolute Obergrenze für „eingebettete“ Retail-Gebühr (sonst explizite Gebühr-Zeile)
  if (gap > 80) return 0

  return gap
}

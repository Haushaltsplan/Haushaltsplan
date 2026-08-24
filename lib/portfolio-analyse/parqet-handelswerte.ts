/**
 * Handelswert / Cash-Betrag / eingebettete Ordergebühr — mit Heilung typischer Import-Fehler.
 *
 * PDF-Bugs (TR Wertpapierabrechnung):
 * - Nur der Stückpreis landet in betragEur → Scheingebühren / falsches Investiert.
 * - Inverse: 3-Nachkomma-Stückpreis (25,815 €) wird nicht gelesen, der Gesamtbetrag
 *   landet als Kurs, oft nochmal × Stück (6×154,89 statt 6×25,815).
 */

import type { ImportQuelle, PortfolioBuchung } from '@/lib/portfolio-analyse/types'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

function istZweiDezimalen(n: number): boolean {
  return Math.abs(n * 100 - Math.round(n * 100)) < 1e-6
}

/** TR-FX-Stückpreis: genau 3 Nachkommastellen, letzte Stelle ≠ 0 (z. B. 25,815). */
function istTrMillStueckpreis(unit: number): boolean {
  if (!(unit > 0) || !Number.isFinite(unit)) return false
  const mill = Math.round(unit * 1000)
  if (Math.abs(unit * 1000 - mill) > 1e-6) return false
  return mill % 10 !== 0
}

export type NormalisierteHandelswerte = {
  stueck: number
  kursEur: number | null
  /** Cash-Betrag der Buchung (Kauf: Zahlungsausgang, Verkauf: -eingang). */
  betragEur: number
  handelswertEur: number | null
  geheilt: boolean
}

type HandelsBuchungFelder = Pick<PortfolioBuchung, 'typ' | 'stueck' | 'kursEur' | 'betragEur'> & {
  quelle?: ImportQuelle | null
}

/**
 * Korrigiert offensichtliche Stück/Kurs/Betrag-Inkonsistenzen einer Kauf-/Verkauf-Buchung.
 * Andere Typen: unveränderte Beträge.
 */
export function normalisiereHandelsBuchung(b: HandelsBuchungFelder): NormalisierteHandelswerte {
  const stueck = Math.abs(b.stueck ?? 0)
  let kursEur = b.kursEur != null && b.kursEur > 0 ? b.kursEur : null
  let betragEur = round2(Math.abs(b.betragEur))
  let geheilt = false

  if ((b.typ === 'kauf' || b.typ === 'verkauf') && stueck > 0 && kursEur != null && betragEur > 0) {
    const ganzzahlig = Math.abs(stueck - Math.round(stueck)) < 0.001
    // Fall C vor A: gespeicherter „Kurs“ ist der Gesamtbetrag (3-Nachkomma-Preis verschluckt).
    if (
      b.quelle === 'pdf' &&
      ganzzahlig &&
      stueck > 1.01 &&
      istZweiDezimalen(kursEur) &&
      istTrMillStueckpreis(kursEur / stueck)
    ) {
      const echterBetrag = round2(kursEur)
      kursEur = round4(kursEur / stueck)
      betragEur = echterBetrag
      geheilt = true
    }
    // Fall A: Mehrstück, Betrag == Stückpreis → Betrag war nur der Kurs (PDF)
    else if (stueck > 1.01 && Math.abs(betragEur - kursEur) <= 0.05) {
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

/** Anzeige von Kauf/Verkauf: geheilt (Stückpreis + Gesamt), sonst Rohbetrag. */
export function anzeigeHandelsBuchung(b: HandelsBuchungFelder): {
  betragEur: number
  kursEur: number | null
  stueck: number
} {
  if (b.typ === 'kauf' || b.typ === 'verkauf') {
    const n = normalisiereHandelsBuchung(b)
    return { betragEur: n.betragEur, kursEur: n.kursEur, stueck: n.stueck }
  }
  return {
    betragEur: round2(Math.abs(b.betragEur)),
    kursEur: b.kursEur,
    stueck: Math.abs(b.stueck ?? 0),
  }
}

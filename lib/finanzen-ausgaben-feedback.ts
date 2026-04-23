/** Rückgabe für Monats-Ausgaben: Lob bei sparsamerem Monat, Warnung bei auffällig niedriger Erfassung. */

export type AusgabenFeedbackArt = 'keins' | 'lob' | 'warnung_zu_gering'

export type AusgabenFeedback = {
  art: AusgabenFeedbackArt
  /** Kurzzeile für UI */
  titel: string
  /** Ein Satz Erklärung */
  text: string
}

function parseIsoMonat(yyyymm: string): { jahr: number; monat: number } {
  const [y, mo] = yyyymm.split('-').map((x) => Number.parseInt(x, 10))
  return { jahr: y, monat: mo }
}

function isoMonatVerschieben(yyyymm: string, monateDelta: number): string {
  const { jahr, monat } = parseIsoMonat(yyyymm)
  const d = new Date(jahr, monat - 1 + monateDelta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function istMonatAmOderVorHeute(ansichtMonat: string, jetzt: Date): boolean {
  const heuteKey = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}`
  return ansichtMonat <= heuteKey
}

function istLaufenderKalendermonat(ansichtMonat: string, jetzt: Date): boolean {
  const heuteKey = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}`
  return ansichtMonat === heuteKey
}

function tagesfortschrittImMonat(jetzt: Date): number {
  const y = jetzt.getFullYear()
  const m = jetzt.getMonth()
  const tag = jetzt.getDate()
  const tageImMonat = new Date(y, m + 1, 0).getDate()
  return Math.min(1, Math.max(0, tag / tageImMonat))
}

/**
 * Vergleicht den Ansichtsmonat mit dem Durchschnitt der drei direkt vorangehenden Kalendermonate
 * (nur Monate mit Ausgaben > 0 zählen für den Schnitt; mindestens 2 solcher Monate nötig).
 *
 * - **Lob**: Ausgaben spürbar unter dem Referenz‑Schnitt, aber nicht so extrem, dass eher Untererfassung wahrscheinlich ist.
 * - **Warnung zu gering**: Summe fällt stark unter erwartete Bandbreite (Vormonate / Monatsfortschritt) — Hinweis auf fehlende Buchungen.
 */
export function berechneAusgabenMonatsFeedback(input: {
  ansichtMonat: string
  summeAusgaben: number
  anzahlBuchungen: number
  summenJeMonat: Record<string, number>
  jetzt?: Date
}): AusgabenFeedback {
  const jetzt = input.jetzt ?? new Date()
  const { ansichtMonat, summeAusgaben, anzahlBuchungen, summenJeMonat } = input

  const prevKeys = [isoMonatVerschieben(ansichtMonat, -1), isoMonatVerschieben(ansichtMonat, -2), isoMonatVerschieben(ansichtMonat, -3)]
  const prevWerte = prevKeys.map((k) => Number(summenJeMonat[k] ?? 0)).filter((v) => v > 0)

  if (prevWerte.length < 2) {
    return {
      art: 'keins',
      titel: '',
      text: '',
    }
  }

  const referenzMittel = prevWerte.reduce((a, b) => a + b, 0) / prevWerte.length
  if (!Number.isFinite(referenzMittel) || referenzMittel < 80) {
    return { art: 'keins', titel: '', text: '' }
  }

  const laufend = istLaufenderKalendermonat(ansichtMonat, jetzt)
  const erwartungMinLaufend = referenzMittel * tagesfortschrittImMonat(jetzt) * 0.38
  const zuGeringAbsolutGeschlossen = summeAusgaben < referenzMittel * 0.32
  const zuGeringLaufend =
    laufend &&
    jetzt.getDate() >= 10 &&
    summeAusgaben < erwartungMinLaufend &&
    summeAusgaben < referenzMittel * 0.55

  const monatInVergangenheitOderAktuell = istMonatAmOderVorHeute(ansichtMonat, jetzt)
  const zuGeringGeschlossenerMonat = !laufend && monatInVergangenheitOderAktuell && zuGeringAbsolutGeschlossen

  const warnungZuGering =
    (zuGeringGeschlossenerMonat || zuGeringLaufend) && (anzahlBuchungen <= 3 || summeAusgaben < referenzMittel * 0.45)

  if (warnungZuGering) {
    const schnittFmt = referenzMittel.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return {
      art: 'warnung_zu_gering',
      titel: 'Ausgaben wirken ungewöhnlich niedrig',
      text: `Im Vergleich zu deinen Vor‑Monaten (Ø ca. ${schnittFmt} €) sind die gebuchten Ausgaben hier sehr gering. Prüfe, ob noch Rechnungen oder Kartenzahlungen fehlen — sonst ist das natürlich auch okay.`,
    }
  }

  const obereSchwelleLob = referenzMittel * 0.88
  const untereBand = referenzMittel * 0.34

  if (summeAusgaben <= obereSchwelleLob && summeAusgaben >= untereBand) {
    const diff = referenzMittel - summeAusgaben
    if (diff < 15) {
      return { art: 'keins', titel: '', text: '' }
    }
    const schnittFmt = referenzMittel.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const summeFmt = summeAusgaben.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return {
      art: 'lob',
      titel: 'Gut gemacht',
      text: `Du hast in diesem Monat mit ${summeFmt} € weniger ausgegeben als im Schnitt deiner letzten Monate mit Buchungen (ca. ${schnittFmt} €). Weiter so — spürbar unter Kontrolle.`,
    }
  }

  return { art: 'keins', titel: '', text: '' }
}

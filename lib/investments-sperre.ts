/**
 * Aktienpause: Sperre nach Kalendertag Europe/Berlin.
 * Gesperrt bis einschließlich `SPERRE_BIS_YMD`, ab dem Folgetag wieder offen.
 */
const SPERRE_BIS_YMD = '2026-06-13' as const

function isoDatumEuropeBerlin(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
}

/** Solange heute (Berlin) noch auf oder vor dem letzten Sperrtag liegt. */
export function istInvestmentsGesperrt(): boolean {
  return isoDatumEuropeBerlin(new Date()) <= SPERRE_BIS_YMD
}

export function investmentsSperreLetzterTagDisplayDE(): string {
  return '13.06.2026'
}

export function investmentsSperreFreischaltungKurzDE(): string {
  return '14.06.2026'
}

/** Tooltip für deaktivierte Navigation während der Pause. */
export function investmentsSperreNavTitle(): string {
  return `Aktienpause bis ${investmentsSperreLetzterTagDisplayDE()} (einschließlich) — ab ${investmentsSperreFreischaltungKurzDE()} wieder frei`
}

/**
 * Aktienpause: Sperre nach Kalendertag Europe/Berlin.
 * Gesperrt bis einschließlich `SPERRE_BIS_YMD`, ab dem Folgetag wieder offen.
 * `null` = keine Sperre aktiv.
 */
const SPERRE_BIS_YMD: string | null = null

function isoDatumEuropeBerlin(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
}

/** Solange heute (Berlin) noch auf oder vor dem letzten Sperrtag liegt. */
export function istInvestmentsGesperrt(): boolean {
  if (!SPERRE_BIS_YMD) return false
  return isoDatumEuropeBerlin(new Date()) <= SPERRE_BIS_YMD
}

export function investmentsSperreLetzterTagDisplayDE(): string {
  if (!SPERRE_BIS_YMD) return '—'
  const [y, m, d] = SPERRE_BIS_YMD.split('-')
  return `${d}.${m}.${y}`
}

export function investmentsSperreFreischaltungKurzDE(): string {
  if (!SPERRE_BIS_YMD) return '—'
  const [y, m, d] = SPERRE_BIS_YMD.split('-').map(Number)
  const naechster = new Date(Date.UTC(y, m - 1, d + 1))
  return naechster.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })
}

/** Tooltip für deaktivierte Navigation während der Pause. */
export function investmentsSperreNavTitle(): string {
  return `Aktienpause bis ${investmentsSperreLetzterTagDisplayDE()} (einschließlich) — ab ${investmentsSperreFreischaltungKurzDE()} wieder frei`
}

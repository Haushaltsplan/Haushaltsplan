import {
  FUNDAMENTAL_FY0E_KEY,
  FUNDAMENTAL_FY1E_KEY,
  FUNDAMENTAL_NTM_KEY,
  FUNDAMENTAL_TTM_KEY,
  type FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

export const FUNDAMENTAL_CHART_SONDER_KEYS = new Set([
  FUNDAMENTAL_TTM_KEY,
  FUNDAMENTAL_NTM_KEY,
  FUNDAMENTAL_FY0E_KEY,
  FUNDAMENTAL_FY1E_KEY,
])

export function istHistorischeChartPeriode(p: FundamentalPeriode): boolean {
  return (
    !p.istLtm &&
    !p.istNtm &&
    !p.istSchaetzung &&
    /^\d{4}-\d{2}-\d{2}$/.test(p.iso)
  )
}

export function historischeChartPerioden(perioden: FundamentalPeriode[]): FundamentalPeriode[] {
  return perioden.filter(istHistorischeChartPeriode)
}

/** Mittel der letzten `maxJahre` gültigen Werte (oder weniger, wenn Historie kürzer). */
export function berechneHistorischenSchnitt(werte: number[], maxJahre = 10): number | null {
  const gueltig = werte.filter((v) => Number.isFinite(v))
  if (gueltig.length === 0) return null
  const slice = gueltig.slice(-maxJahre)
  return slice.reduce((a, b) => a + b, 0) / slice.length
}

export function jahreImSchnitt(werte: number[], maxJahre = 10): number {
  const gueltig = werte.filter((v) => Number.isFinite(v))
  return Math.min(maxJahre, gueltig.length)
}

export function prozentAbweichung(aktuell: number, schnitt: number): number | null {
  if (!Number.isFinite(aktuell) || !Number.isFinite(schnitt) || schnitt === 0) return null
  return ((aktuell - schnitt) / Math.abs(schnitt)) * 100
}

export function jahrAusPeriode(iso: string): string {
  const m = iso.match(/^(\d{4})/)
  return m ? m[1]! : iso
}

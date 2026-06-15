import {
  FUNDAMENTAL_FY0E_KEY,
  FUNDAMENTAL_FY1E_KEY,
  FUNDAMENTAL_NTM_KEY,
  FUNDAMENTAL_TTM_KEY,
  istFundamentalSchaetzungIso,
  type FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

export const FUNDAMENTAL_CHART_SONDER_KEYS = new Set([
  FUNDAMENTAL_TTM_KEY,
  FUNDAMENTAL_NTM_KEY,
  FUNDAMENTAL_FY0E_KEY,
  FUNDAMENTAL_FY1E_KEY,
])

export function istFundamentalChartSonderIso(iso: string): boolean {
  return FUNDAMENTAL_CHART_SONDER_KEYS.has(iso) || istFundamentalSchaetzungIso(iso)
}

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

export function schaetzungsChartPerioden(perioden: FundamentalPeriode[]): FundamentalPeriode[] {
  return perioden.filter((p) => p.istSchaetzung)
}

/** Historische FY-Perioden plus Schätzungs-Spalten am Ende (für Finanzdaten-Charts). */
export function finanzdatenChartPerioden(perioden: FundamentalPeriode[]): FundamentalPeriode[] {
  return [...historischeChartPerioden(perioden), ...schaetzungsChartPerioden(perioden)]
}

export function einheitSkalaGruppe(einheit: string): string {
  if (einheit === 'aktien_mio') return 'aktien_mio'
  if (einheit === 'waehrung_usd_aktie') return 'waehrung_usd_aktie'
  if (einheit === 'prozent') return 'prozent'
  if (einheit === 'multiple') return 'multiple'
  if (einheit === 'ratio') return 'ratio'
  if (einheit.startsWith('waehrung')) return 'waehrung_betrag'
  return einheit
}

export function filterChartPeriodenZeitraum(
  perioden: FundamentalPeriode[],
  vonIso: string,
  bisIso: string,
): FundamentalPeriode[] {
  if (!vonIso || !bisIso) return perioden
  const von = vonIso <= bisIso ? vonIso : bisIso
  const bis = vonIso <= bisIso ? bisIso : vonIso
  return perioden.filter((p) => p.iso >= von && p.iso <= bis)
}

export function letzteNChartPerioden(perioden: FundamentalPeriode[], n: number): FundamentalPeriode[] {
  if (perioden.length <= n) return perioden
  return perioden.slice(-n)
}

/** Mittel aller gültigen Werte im (bereits gefilterten) Zeitraum. */
export function berechneZeitraumSchnitt(werte: number[]): number | null {
  const gueltig = werte.filter((v) => Number.isFinite(v))
  if (gueltig.length === 0) return null
  return gueltig.reduce((a, b) => a + b, 0) / gueltig.length
}

/** Mittel der letzten `maxJahre` gültigen Werte (oder weniger, wenn Historie kürzer). */
export function berechneHistorischenSchnitt(werte: number[], maxJahre = 10): number | null {
  const gueltig = werte.filter((v) => Number.isFinite(v))
  if (gueltig.length === 0) return null
  const slice = gueltig.slice(-maxJahre)
  return slice.reduce((a, b) => a + b, 0) / slice.length
}

export function anzahlWerteImZeitraum(werte: number[]): number {
  return werte.filter((v) => Number.isFinite(v)).length
}

export function jahreImSchnitt(werte: number[], maxJahre = 10): number {
  const gueltig = werte.filter((v) => Number.isFinite(v))
  return Math.min(maxJahre, gueltig.length)
}

export function chartPeriodeKurzlabel(p: FundamentalPeriode): string {
  const jahr = jahrAusPeriode(p.iso)
  return jahr.length === 4 ? jahr : p.label
}

export function chartZeitraumLabel(von: FundamentalPeriode | undefined, bis: FundamentalPeriode | undefined): string {
  if (!von || !bis) return ''
  const a = chartPeriodeKurzlabel(von)
  const b = chartPeriodeKurzlabel(bis)
  return a === b ? a : `${a}–${b}`
}

export function prozentAbweichung(aktuell: number, schnitt: number): number | null {
  if (!Number.isFinite(aktuell) || !Number.isFinite(schnitt) || schnitt === 0) return null
  return ((aktuell - schnitt) / Math.abs(schnitt)) * 100
}

export function jahrAusPeriode(iso: string): string {
  const m = iso.match(/^(\d{4})/)
  return m ? m[1]! : iso
}

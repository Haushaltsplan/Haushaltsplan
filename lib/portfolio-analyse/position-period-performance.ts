import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'
import type { PeriodPerformance } from '@/lib/portfolio-analyse/parqet-core/types'
import { periodenStartIso } from '@/lib/portfolio-analyse/parqet-period-kennzahlen'
import { heuteIso } from '@/lib/portfolio-analyse/wertentwicklung-tage'

export type PositionPeriodPerf = {
  gewinnVerlustEur: number
  gewinnVerlustProzent: number | null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function spaltenLabelKursgewinn(periodKey: PeriodPerformance['periodKey']): string {
  if (periodKey === '1T') return 'Heute / in %'
  if (periodKey === 'MAX') return 'Kursgewinn / in %'
  return 'Performance / in %'
}

export function topMoverUntertitel(periodKey: PeriodPerformance['periodKey']): string {
  if (periodKey === '1T') return '↑ Gewinner heute'
  if (periodKey === 'MAX') return '↑ Gewinner (seit Kauf)'
  return '↑ Gewinner im Zeitraum'
}

/** Letzter Schlusskurs an oder vor Stichtag. */
export function kursAnOderVorDatum(serie: Map<string, number>, stichtagIso: string): number | null {
  let bestDatum = ''
  let bestKurs: number | null = null
  for (const [datum, kurs] of serie) {
    if (datum > stichtagIso || kurs <= 0) continue
    if (!bestDatum || datum > bestDatum) {
      bestDatum = datum
      bestKurs = kurs
    }
  }
  return bestKurs
}

export function berechnePositionPerfHeute(p: LivePosition): PositionPeriodPerf {
  const kurs = p.kursLiveEur
  const vortag = p.kursVortagEur
  if (kurs != null && vortag != null && vortag > 0 && p.stueck > 0) {
    return {
      gewinnVerlustEur: round2(p.stueck * (kurs - vortag)),
      gewinnVerlustProzent: p.aenderungTagProzent ?? round2(((kurs - vortag) / vortag) * 100),
    }
  }
  if (p.aenderungTagProzent != null && Number.isFinite(p.aenderungTagProzent)) {
    const faktor = 1 + p.aenderungTagProzent / 100
    const wertVortag = faktor !== 0 ? p.wertLiveEur / faktor : p.wertLiveEur
    return {
      gewinnVerlustEur: round2(p.wertLiveEur - wertVortag),
      gewinnVerlustProzent: round2(p.aenderungTagProzent),
    }
  }
  return { gewinnVerlustEur: 0, gewinnVerlustProzent: null }
}

export function berechnePositionPerfSeitKauf(p: LivePosition): PositionPeriodPerf {
  return {
    gewinnVerlustEur: p.gewinnVerlustEur,
    gewinnVerlustProzent: p.gewinnVerlustProzent,
  }
}

export function berechnePositionPerfMitKursStart(
  p: LivePosition,
  kursAmStart: number | null,
): PositionPeriodPerf {
  const kurs = p.kursLiveEur
  if (kurs == null || kursAmStart == null || kursAmStart <= 0 || p.stueck <= 0) {
    return { gewinnVerlustEur: 0, gewinnVerlustProzent: null }
  }
  return {
    gewinnVerlustEur: round2(p.stueck * (kurs - kursAmStart)),
    gewinnVerlustProzent: round2(((kurs - kursAmStart) / kursAmStart) * 100),
  }
}

export function stichtagIsoFuerPeriode(
  periodKey: PeriodPerformance['periodKey'],
  ersteBuchungIso: string | null,
): string {
  const heute = heuteIso()
  if (periodKey === '1T') return heute
  if (periodKey === 'MAX') return ersteBuchungIso ?? heute
  return periodenStartIso(periodKey, heute, ersteBuchungIso)
}

export function kursAmStartFuerPosition(
  p: LivePosition,
  historie: Map<string, Map<string, number>>,
  stichtagIso: string,
  extraSymbole: string[] = [],
): number | null {
  const symbole = [
    p.symbolYahoo?.toUpperCase(),
    ...extraSymbole.map((s) => s.toUpperCase()),
  ].filter((s): s is string => Boolean(s))

  for (const sym of [...new Set(symbole)]) {
    const serie = historie.get(sym)
    if (!serie) continue
    const k = kursAnOderVorDatum(serie, stichtagIso)
    if (k != null) return k
  }

  return null
}

export function berechnePositionPerfFuerPeriode(
  p: LivePosition,
  periodKey: PeriodPerformance['periodKey'],
  historie: Map<string, Map<string, number>>,
  ersteBuchungIso: string | null,
): PositionPeriodPerf {
  if (periodKey === 'MAX') return berechnePositionPerfSeitKauf(p)
  if (periodKey === '1T') return berechnePositionPerfHeute(p)
  const stichtag = stichtagIsoFuerPeriode(periodKey, ersteBuchungIso)
  const kursStart = kursAmStartFuerPosition(p, historie, stichtag)
  return berechnePositionPerfMitKursStart(p, kursStart)
}

export function bauePositionPerfMap(
  positionen: LivePosition[],
  periodKey: PeriodPerformance['periodKey'],
  historie: Map<string, Map<string, number>>,
  ersteBuchungIso: string | null,
): Map<string, PositionPeriodPerf> {
  const out = new Map<string, PositionPeriodPerf>()
  for (const p of positionen) {
    const key = p.isin?.toUpperCase() ?? p.name
    out.set(key, berechnePositionPerfFuerPeriode(p, periodKey, historie, ersteBuchungIso))
  }
  return out
}

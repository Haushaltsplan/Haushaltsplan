/** Stress-Monitor — Schätzung aus Recovery / HFV (WHOOP-ähnlich, 0,1–3). */

import {
  baseline30,
  isoAddDays,
  ladeDailyStore,
  tagRecordFuerDatum,
  type WhoopDayRecord,
} from '@/lib/fitnessdaten/daily-records'

export type StressDetail = {
  score: number | null
  quelle: 'recovery' | 'hrv' | null
  recoveryStress: number | null
  hrvStress: number | null
}

export function stressAusRecovery(recoveryPercent: number): number {
  return Math.round(Math.max(0.1, Math.min(3, 3 - (recoveryPercent / 100) * 2.6)) * 10) / 10
}

export function stressAusHrv(hrvHeute: number, hrvBase: number): number {
  const abw = (hrvBase - hrvHeute) / hrvBase
  return Math.round(Math.max(0.1, Math.min(3, 1.5 + abw * 3)) * 10) / 10
}

export function berechneStressDetail(
  rec: number | null,
  hrvHeute: number | null,
  hrvBase: number | null,
): StressDetail {
  const recoveryStress = rec != null ? stressAusRecovery(rec) : null
  const hrvStress =
    hrvHeute != null && hrvBase != null && hrvBase > 0
      ? stressAusHrv(hrvHeute, hrvBase)
      : null

  if (recoveryStress != null) {
    return { score: recoveryStress, quelle: 'recovery', recoveryStress, hrvStress }
  }
  if (hrvStress != null) {
    return { score: hrvStress, quelle: 'hrv', recoveryStress, hrvStress }
  }
  return { score: null, quelle: null, recoveryStress, hrvStress }
}

export function berechneStressScore(
  rec: number | null,
  hrvHeute: number | null,
  hrvBase: number | null,
): number | null {
  return berechneStressDetail(rec, hrvHeute, hrvBase).score
}

export function stressLabel(s: number | null): string {
  if (s == null) return '—'
  if (s < 1.0) return 'NIEDRIG'
  if (s < 2.0) return 'MITTEL'
  if (s < 2.5) return 'ERHÖHT'
  return 'HOCH'
}

export function stressColor(s: number | null): string {
  if (s == null) return '#52525b'
  if (s < 1.0) return '#00E676'
  if (s < 2.0) return '#00E5FF'
  if (s < 2.5) return '#FFD600'
  return '#FF6B35'
}

export function formatStressDe(s: number): string {
  return s.toFixed(1).replace('.', ',')
}

function tagKurz(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
  })
}

export function stressFenster(anchorIso: string, tage: number): WhoopDayRecord[] {
  const store = ladeDailyStore()
  const out: WhoopDayRecord[] = []
  for (let i = tage - 1; i >= 0; i--) {
    out.push(tagRecordFuerDatum(isoAddDays(anchorIso, -i), store))
  }
  return out
}

export type StressChartPunkt = {
  date: string
  label: string
  value: number
  highlight?: boolean
  stress: number | null
}

export function stressChartPunkte(
  records: WhoopDayRecord[],
  highlightDate: string,
  hrvBaseline?: number | null,
): StressChartPunkt[] {
  const base = hrvBaseline ?? baseline30('hrvRmssd', ladeDailyStore().days)
  return records.map((d) => {
    const stress = berechneStressScore(d.recoveryPercent, d.hrvRmssd, base)
    return {
      date: d.date,
      label: tagKurz(d.date),
      value: stress ?? 0,
      highlight: d.date === highlightDate,
      stress,
    }
  })
}

export function stressInsight(
  detail: StressDetail,
  hrvBase: number | null,
  hrvHeute: number | null,
): string | null {
  if (detail.score == null) return 'Noch zu wenig Recovery- oder HFV-Daten für eine Stress-Einschätzung.'
  if (detail.quelle === 'recovery' && detail.score >= 2) {
    return 'Niedrige Erholung deutet auf erhöhten physiologischen Stress hin — heute eher schonen.'
  }
  if (detail.quelle === 'hrv' && hrvHeute != null && hrvBase != null && hrvBase > 0) {
    const pct = Math.round(((hrvHeute - hrvBase) / hrvBase) * 100)
    if (pct < -15) return `HFV ${Math.abs(pct)} % unter deinem Schnitt — typisch bei Stress oder schlechter Erholung.`
    if (pct > 10) return `HFV ${pct} % über dem Schnitt — entspannte autonome Lage.`
  }
  if (detail.score < 1) return 'Stress-Signal niedrig — gute Erholungslage.'
  if (detail.score < 2) return 'Moderates Stress-Signal — normaler Alltagstag.'
  return 'Erhöhtes Stress-Signal — Schlaf und Regeneration priorisieren.'
}

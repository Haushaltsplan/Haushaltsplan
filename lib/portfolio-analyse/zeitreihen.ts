/** Zeitreihen-Hilfen für Dashboard-Charts (Drawdown, Monatsrendite). */

export type WertPunkt = { label: string; wert: number; monat?: string }

export type DrawdownPunkt = { label: string; drawdownProzent: number; monat?: string }

export type DrawdownStatistik = {
  serie: DrawdownPunkt[]
  maxDrawdownProzent: number
  maxDrawdownTage: number | null
  maxDrawdownPeriode: { vonLabel: string; bisLabel: string } | null
}

export function berechneDrawdown(punkte: WertPunkt[]): DrawdownStatistik {
  if (punkte.length === 0) {
    return { serie: [], maxDrawdownProzent: 0, maxDrawdownTage: null, maxDrawdownPeriode: null }
  }

  let peak = punkte[0].wert
  let maxDd = 0
  let maxDdIdx = 0
  let maxDdPeakIdx = 0
  let peakIdx = 0

  const serie: DrawdownPunkt[] = punkte.map((p, i) => {
    if (p.wert > peak) {
      peak = p.wert
      peakIdx = i
    }
    const dd = peak > 0 ? ((p.wert - peak) / peak) * 100 : 0
    const rounded = Math.round(dd * 100) / 100
    if (rounded < maxDd) {
      maxDd = rounded
      maxDdIdx = i
      maxDdPeakIdx = peakIdx
    }
    return { label: p.label, drawdownProzent: rounded, monat: p.monat }
  })

  let maxDrawdownTage: number | null = null
  let maxDrawdownPeriode: { vonLabel: string; bisLabel: string } | null = null
  if (maxDd < 0 && punkte[maxDdPeakIdx] && punkte[maxDdIdx]) {
    const von = punkte[maxDdPeakIdx].monat
    const bis = punkte[maxDdIdx].monat
    if (von && bis) {
      const d0 = monatZuDatum(von)
      const d1 = monatZuDatum(bis)
      if (d0 && d1) {
        maxDrawdownTage = Math.max(0, Math.round((d1.getTime() - d0.getTime()) / 86400000))
      }
    }
    maxDrawdownPeriode = {
      vonLabel: punkte[maxDdPeakIdx].label,
      bisLabel: punkte[maxDdIdx].label,
    }
  }

  return {
    serie,
    maxDrawdownProzent: maxDd,
    maxDrawdownTage,
    maxDrawdownPeriode,
  }
}

function monatZuDatum(monat: string): Date | null {
  const m = monat.match(/^(\d{4})-(\d{2})/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, 1)
}

export function monatsrenditenProzent(punkte: WertPunkt[]): { label: string; prozent: number; monat?: string }[] {
  if (punkte.length < 2) return []
  const out: { label: string; prozent: number; monat?: string }[] = []
  for (let i = 1; i < punkte.length; i++) {
    const prev = punkte[i - 1].wert
    const cur = punkte[i].wert
    const pct = prev > 0 ? ((cur - prev) / prev) * 100 : 0
    out.push({
      label: punkte[i].label,
      prozent: Math.round(pct * 100) / 100,
      monat: punkte[i].monat,
    })
  }
  return out
}

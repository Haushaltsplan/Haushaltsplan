/** Zeiträume für die Chartanalyse (Anzeige vs. Datenabruf). */

export const CHARTANALYSE_ZEITRAEUME = [
  { id: '1d', label: '1T', tage: 1 },
  { id: '1w', label: '1W', tage: 7 },
  { id: '1m', label: '1M', monate: 1 },
  { id: '6m', label: '6M', monate: 6 },
  { id: '1y', label: '1J', monate: 12 },
  { id: '3y', label: '3J', jahre: 3 },
  { id: '5y', label: '5J', jahre: 5 },
  { id: '10y', label: '10J', jahre: 10 },
] as const

export type ChartanalyseZeitraumId = (typeof CHARTANALYSE_ZEITRAEUME)[number]['id']

function subtractZeitraum(d: Date, opt: (typeof CHARTANALYSE_ZEITRAEUME)[number]): void {
  if ('tage' in opt && opt.tage) d.setDate(d.getDate() - opt.tage)
  else if ('monate' in opt && opt.monate) d.setMonth(d.getMonth() - opt.monate)
  else if ('jahre' in opt && opt.jahre) d.setFullYear(d.getFullYear() - opt.jahre)
}

export function vonDatumFuerZeitraum(id: ChartanalyseZeitraumId): string {
  const d = new Date()
  const opt = CHARTANALYSE_ZEITRAEUME.find((z) => z.id === id)!
  subtractZeitraum(d, opt)
  return d.toISOString().slice(0, 10)
}

/** Mindest-Lookback für Indikatoren (EMA 200, MACD) bei sehr kurzen Anzeigezeiträumen. */
export function vonDatumFuerAbruf(id: ChartanalyseZeitraumId): string {
  const kurz = id === '1d' || id === '1w' || id === '1m'
  if (kurz) return vonDatumFuerZeitraum('1y')
  return vonDatumFuerZeitraum(id)
}

export function zeitraumLabel(id: ChartanalyseZeitraumId): string {
  return CHARTANALYSE_ZEITRAEUME.find((z) => z.id === id)?.label ?? id
}

type FcfFillZeile = {
  jahr: number
  freeCashFlowUsd: number | null
  revenueGrowthPct: number | null
  epsGrowthPct: number | null
  istSchätzung: boolean
}

/**
 * StockAnalysis blendet FCF-Schätzungen oft als `[PRO]` aus, liefert aber
 * `revenueGrowth` / `epsGrowth` für dieselben Jahre. Für DCF: fehlendes FCF
 * mit letztem bekannten FCF × (1 + Umsatzwachstum) fortschreiben.
 */
export function fuelleFehlendeFcfAusUmsatzWachstum<T extends FcfFillZeile>(reihe: T[]): T[] {
  if (reihe.length === 0) return reihe
  const out = reihe.map((e) => ({ ...e }))
  out.sort((a, b) => a.jahr - b.jahr)

  let lastFcf: number | null = null
  for (const e of out) {
    if (e.freeCashFlowUsd != null && e.freeCashFlowUsd > 0) {
      lastFcf = e.freeCashFlowUsd
      continue
    }
    if (!e.istSchätzung || lastFcf == null) continue
    const g =
      e.revenueGrowthPct != null && Number.isFinite(e.revenueGrowthPct)
        ? e.revenueGrowthPct
        : e.epsGrowthPct != null && Number.isFinite(e.epsGrowthPct)
          ? e.epsGrowthPct
          : null
    if (g == null || g <= -90 || g > 80) continue
    e.freeCashFlowUsd = lastFcf * (1 + g / 100)
    lastFcf = e.freeCashFlowUsd
  }
  return out
}

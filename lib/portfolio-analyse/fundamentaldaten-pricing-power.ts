/**
 * Pricing-Power & Bilanz-Qualität: Bruttomargen-Volatilität,
 * Schuldenfälligkeit, Kundenkonzentration, F&E-Aktivierung.
 */

/** Stichproben-Standardabweichung (n−1). */
export function standardabweichung(werte: number[]): number | null {
  const xs = werte.filter((v) => Number.isFinite(v))
  if (xs.length < 3) return null
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  const varSum = xs.reduce((a, v) => a + (v - mean) ** 2, 0)
  const sd = Math.sqrt(varSum / (xs.length - 1))
  return Number.isFinite(sd) ? Math.round(sd * 100) / 100 : null
}

/**
 * True wenn Bruttogewinn ≈ Umsatz (Macrotrends/SA ohne COGS, z. B. MA/V).
 * Dann ist „Bruttomarge 100 %“ keine echte Pricing-Power-Messgröße.
 */
export function istScheinBruttomargeSerie(hist: number[]): boolean {
  const xs = hist.filter((v) => Number.isFinite(v))
  if (xs.length < 3) return false
  const nahe100 = xs.filter((v) => v >= 99.5).length
  return nahe100 / xs.length >= 0.8
}

/**
 * Bruttomargen-Stabilität über bis zu 10 Jahre.
 * > 2 Pp. StdAbw. = schwache Pricing Power (KO für Outperformance).
 * Schein-100-%-Serien (kein COGS) → null, sonst Fake-✓ bei StdAbw. 0.
 */
export function berechneBruttomargenStabilitaet(hist: number[]): {
  bruttoMargeStd10y: number | null
  bruttoMargeJahre: number
  pricingPowerOk: boolean | null
} {
  const last10 = hist.filter((v) => Number.isFinite(v)).slice(-10)
  if (istScheinBruttomargeSerie(last10)) {
    return { bruttoMargeStd10y: null, bruttoMargeJahre: last10.length, pricingPowerOk: null }
  }
  const sd = standardabweichung(last10)
  return {
    bruttoMargeStd10y: sd,
    bruttoMargeJahre: last10.length,
    pricingPowerOk: sd == null ? null : sd <= 2,
  }
}

/** Top-3-Kundenanteil aus SEC-Hauptkundenliste. */
export function berechneKundenKonzentrationTop3(
  hauptkunden: Array<{ name: string; anteilPct: number }> | null | undefined,
): {
  umsatzanteilTop1KundenPct: number | null
  umsatzanteilTop3KundenPct: number | null
  topKundenNamen: string[]
} {
  const sorted = [...(hauptkunden ?? [])]
    .filter((k) => k.anteilPct > 0 && k.anteilPct <= 100)
    .sort((a, b) => b.anteilPct - a.anteilPct)
  if (sorted.length === 0) {
    return {
      umsatzanteilTop1KundenPct: null,
      umsatzanteilTop3KundenPct: null,
      topKundenNamen: [],
    }
  }
  const top3 = sorted.slice(0, 3)
  const top1 = top3[0]!.anteilPct
  const top3Sum = Math.round(top3.reduce((s, k) => s + k.anteilPct, 0) * 10) / 10
  return {
    umsatzanteilTop1KundenPct: top1,
    umsatzanteilTop3KundenPct: top3Sum,
    topKundenNamen: top3.map((k) => k.name),
  }
}

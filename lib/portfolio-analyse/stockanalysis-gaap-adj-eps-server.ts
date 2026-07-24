/**
 * GAAP vs. Adjusted-EPS aus StockAnalysis-Jahresreihe (Primärdaten der SA-Seite,
 * keine Analysten-Meinung). Nur Ist-Jahre mit beiden Werten.
 */
import 'server-only'

import {
  ladeStockanalysisJahresForecast,
  type StockanalysisJahresForecastEintrag,
} from '@/lib/portfolio-analyse/stockanalysis-forecast-server'

export type GaapAdjEpsLuecke = {
  jahr: number
  gaapEps: number
  adjustedEps: number
  /** (Adj − GAAP) / |GAAP| × 100 */
  lueckePct: number
  quelle: 'stockanalysis'
}

function lueckeAusEintrag(e: StockanalysisJahresForecastEintrag): GaapAdjEpsLuecke | null {
  if (e.istSchätzung) return null
  const gaap = e.gaapEps
  const adj = e.adjustedEps
  if (gaap == null || adj == null || Math.abs(gaap) < 0.01) return null
  if (gaap === adj) return null
  return {
    jahr: e.jahr,
    gaapEps: gaap,
    adjustedEps: adj,
    lueckePct: Math.round(((adj - gaap) / Math.abs(gaap)) * 1000) / 10,
    quelle: 'stockanalysis',
  }
}

/** Letztes abgeschlossenes GJ mit GAAP + Adjusted EPS. */
export async function ladeGaapAdjEpsLuecke(opts: {
  symbolYahoo?: string | null
  isin?: string | null
  firmenname?: string | null
}): Promise<GaapAdjEpsLuecke | null> {
  const fc = await ladeStockanalysisJahresForecast({
    symbolYahoo: opts.symbolYahoo,
    isin: opts.isin,
    firmenname: opts.firmenname ?? undefined,
  })
  if (!fc?.jahresreihe?.length) return null

  const hist = [...fc.jahresreihe].filter((e) => !e.istSchätzung).sort((a, b) => a.jahr - b.jahr)
  for (let i = hist.length - 1; i >= 0; i--) {
    const hit = lueckeAusEintrag(hist[i]!)
    if (hit) return hit
  }
  return null
}

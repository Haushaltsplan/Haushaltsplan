/**
 * Earnings-Quality: Sloan-Ratio (Accruals) und Beneish M-Score.
 */

import type { FundamentalMetrikZeile, FundamentalPeriode } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { wertAusMapFuerIso } from '@/lib/portfolio-analyse/fundamentaldaten-wert-fuer-iso'

function w(zeilen: FundamentalMetrikZeile[], id: string, key: string): number | null {
  return wertAusMapFuerIso(zeilen.find((z) => z.id === id)?.werte, key)
}

function histKeys(perioden: FundamentalPeriode[]): string[] {
  return perioden
    .filter((p) => !p.istLtm && !p.istNtm && !p.istSchaetzung && /^\d{4}-\d{2}-\d{2}$/.test(p.iso))
    .map((p) => p.iso)
}

function ratio(a: number | null, b: number | null): number | null {
  if (a == null || b == null || !(Math.abs(b) > 0)) return null
  const r = a / b
  return Number.isFinite(r) ? r : null
}

export type EarningsQualityKennzahlen = {
  /** (Nettogewinn − OCF) / Gesamtvermögen — positiv = Accrual-lastig. */
  sloanRatio: number | null
  /** Beneish M-Score; > −1,78 = erhöhtes Manipulationsrisiko. */
  beneishMScore: number | null
  beneishRisiko: 'niedrig' | 'erhoeht' | 'hoch' | null
}

/**
 * Sloan Accruals & Beneish M-Score aus den letzten zwei historischen Jahren.
 */
export function berechneEarningsQuality(
  perioden: FundamentalPeriode[],
  zeilen: FundamentalMetrikZeile[],
): EarningsQualityKennzahlen {
  const keys = histKeys(perioden)
  if (keys.length < 1) {
    return { sloanRatio: null, beneishMScore: null, beneishRisiko: null }
  }

  const t = keys[keys.length - 1]!
  const t1 = keys.length >= 2 ? keys[keys.length - 2]! : null

  const ni = w(zeilen, 'nettogewinn', t)
  const ocf = w(zeilen, 'ocf', t)
  const assets = w(zeilen, 'gesamtvermoegen', t)
  const assets1 = t1 ? w(zeilen, 'gesamtvermoegen', t1) : null
  const avgAssets =
    assets != null && assets1 != null && assets + assets1 > 0
      ? (assets + assets1) / 2
      : assets

  let sloanRatio: number | null = null
  if (ni != null && ocf != null && avgAssets != null && avgAssets > 0) {
    sloanRatio = Math.round(((ni - ocf) / avgAssets) * 1000) / 1000
  }

  if (!t1) {
    return {
      sloanRatio,
      beneishMScore: null,
      beneishRisiko: sloanRisiko(sloanRatio),
    }
  }

  const sales = w(zeilen, 'umsatz', t)
  const sales1 = w(zeilen, 'umsatz', t1)
  const recv = w(zeilen, 'forderungen', t)
  const recv1 = w(zeilen, 'forderungen', t1)
  const cogs = (() => {
    const u = sales
    const bg = w(zeilen, 'bruttogewinn', t)
    return u != null && bg != null ? u - bg : null
  })()
  const cogs1 = (() => {
    const u = sales1
    const bg = w(zeilen, 'bruttogewinn', t1)
    return u != null && bg != null ? u - bg : null
  })()
  const ca = w(zeilen, 'umlaufvermoegen', t)
  const ca1 = w(zeilen, 'umlaufvermoegen', t1)
  const da = w(zeilen, 'da', t)
  const da1 = w(zeilen, 'da', t1)
  const sga = w(zeilen, 'sga', t)
  const sga1 = w(zeilen, 'sga', t1)
  const debt = w(zeilen, 'gesamtverschuldung', t)
  const debt1 = w(zeilen, 'gesamtverschuldung', t1)
  const cash = w(zeilen, 'bargeld', t)
  const cash1 = w(zeilen, 'bargeld', t1)

  const dsri = ratio(ratio(recv, sales), ratio(recv1, sales1))
  const gm = ratio(sales != null && cogs != null ? sales - cogs : null, sales)
  const gm1 = ratio(sales1 != null && cogs1 != null ? sales1 - cogs1 : null, sales1)
  const gmi = ratio(gm1, gm)
  const softAssets = (a: number | null, c: number | null, cashV: number | null) => {
    if (a == null) return null
    // PPE-Zeile fehlt oft — Non-Current ≈ Gesamt − Umlauf als Proxy
    return a - (c ?? 0) - (cashV ?? 0)
  }
  const aqiNum = softAssets(assets, ca, cash)
  const aqiDen = assets
  const aqiNum1 = softAssets(assets1, ca1, cash1)
  const aqi = ratio(ratio(aqiNum, aqiDen), ratio(aqiNum1, assets1))
  const sgi = ratio(sales, sales1)
  const ppeProxy = assets != null && ca != null ? Math.max(assets - ca, 0) : null
  const ppeProxy1 = assets1 != null && ca1 != null ? Math.max(assets1 - ca1, 0) : null
  const depiRate = ratio(da, (ppeProxy ?? 0) + (da ?? 0) || null)
  const depiRate1 = ratio(da1, (ppeProxy1 ?? 0) + (da1 ?? 0) || null)
  const depi = ratio(depiRate1, depiRate)
  const sgai = ratio(ratio(sga, sales), ratio(sga1, sales1))
  const lvgi = ratio(ratio(debt, assets), ratio(debt1, assets1))
  const tata = ratio(ni != null && ocf != null ? ni - ocf : null, assets)

  const vars = [dsri, gmi, aqi, sgi, depi, sgai, tata, lvgi]
  const verwendbar = vars.filter((v) => v != null).length
  // Mit 4 Kern-Indizes (DSRI/GMI/SGI/TATA) schon aussagekräftig; 5+ ideal
  if (verwendbar < 4) {
    return {
      sloanRatio,
      beneishMScore: null,
      beneishRisiko: sloanRisiko(sloanRatio),
    }
  }

  const m =
    -4.84 +
    0.92 * (dsri ?? 1) +
    0.528 * (gmi ?? 1) +
    0.404 * (aqi ?? 1) +
    0.892 * (sgi ?? 1) +
    0.115 * (depi ?? 1) -
    0.172 * (sgai ?? 1) +
    4.679 * (tata ?? 0) -
    0.327 * (lvgi ?? 1)

  const beneishMScore = Math.round(m * 100) / 100
  let beneishRisiko: EarningsQualityKennzahlen['beneishRisiko'] = 'niedrig'
  if (beneishMScore > -1.78) beneishRisiko = 'hoch'
  else if (beneishMScore > -2.22) beneishRisiko = 'erhoeht'
  if (sloanRatio != null && sloanRatio > 0.1 && beneishRisiko === 'niedrig') {
    beneishRisiko = 'erhoeht'
  }

  return { sloanRatio, beneishMScore, beneishRisiko }
}

function sloanRisiko(
  sloan: number | null,
): EarningsQualityKennzahlen['beneishRisiko'] {
  if (sloan == null) return null
  if (sloan > 0.1) return 'hoch'
  if (sloan > 0.05) return 'erhoeht'
  return 'niedrig'
}

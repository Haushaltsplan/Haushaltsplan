/**
 * Qualitäts-Signale 2–7 für Nachkauf-Radar (ohne Analysten-Meinungen).
 * Ableitung primär aus Macrotrends-Zeitreihen + SEC/Yahoo-Primärdaten.
 */
import {
  FUNDAMENTAL_TTM_KEY,
  type FundamentaldatenPaket,
  type FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

export type NachkaufQualitaetSignale = {
  /** Punkt 2: CAGR der ausstehenden Aktien (positiv = Verwässerung). */
  aktienVerwaesserungJaehrlichPct: number | null
  /** YoY-Änderung der Aktienzahl letztes Jahr (%). */
  aktienYoYPct: number | null
  /** Punkt 3: FCF / Nettogewinn in %. */
  fcfConversionPct: number | null
  /** 3J-Mittel FCF-Conversion %. */
  fcfConversion3yPct: number | null
  /** Punkt 4: NRR % (nur wenn Primärquelle). */
  nrrPct: number | null
  /** Rule of 40 = Umsatzwachstum % + FCF-Marge %. */
  ruleOf40: number | null
  /** Punkt 5: EBIT / Zinsaufwand. */
  interestCoverage: number | null
  /** Kurzfristige Finanzschulden / Gesamtverschuldung in % (Refi-Druck). */
  kurzfristSchuldenAnteilPct: number | null
  /** Punkt 6: Aktuelles Trailing-KGV als Perzentil der eigenen 5J-/10J-Historie (0–100, niedrig = günstig). */
  pePerzentil5y: number | null
  pePerzentil10y: number | null
  /** Punkt 7: (Adjusted − GAAP) / |GAAP| in %; positiv = Non-GAAP höher. */
  gaapAdjEpsLueckePct: number | null
  /** Fallback Qualität: (FCF/Aktie − GAAP-EPS) / |GAAP-EPS| in %. */
  cashEpsVsGaapLueckePct: number | null
}

function histKeys(perioden: FundamentalPeriode[], max?: number): string[] {
  const keys = perioden
    .filter(
      (p) =>
        !p.istLtm &&
        !p.istNtm &&
        !p.istSchaetzung &&
        p.iso !== FUNDAMENTAL_TTM_KEY &&
        /^\d{4}-\d{2}-\d{2}$/.test(p.iso),
    )
    .map((p) => p.iso)
    .sort()
  return max != null ? keys.slice(-max) : keys
}

function wert(
  paket: FundamentaldatenPaket,
  zeileId: string,
  key: string,
): number | null {
  const v = paket.zeilen.find((z) => z.id === zeileId)?.werte[key]
  return v != null && Number.isFinite(v) ? v : null
}

function letzteWerte(
  paket: FundamentaldatenPaket,
  zeileId: string,
  max: number,
): number[] {
  const keys = histKeys(paket.perioden, max * 2)
  const out: number[] = []
  for (let i = keys.length - 1; i >= 0 && out.length < max; i--) {
    const v = wert(paket, zeileId, keys[i]!)
    if (v != null) out.push(v)
  }
  return out.reverse()
}

function cagrPct(a0: number, a1: number, jahre: number): number | null {
  if (a0 <= 0 || jahre <= 0 || !Number.isFinite(a0) || !Number.isFinite(a1)) return null
  const r = (Math.pow(a1 / a0, 1 / jahre) - 1) * 100
  return Number.isFinite(r) ? r : null
}

/**
 * Extreme Multiples (z. B. Early-Growth-KGV 900×) verzerren Median/Discount/Perzentile.
 * Bevorzugt gefilterte Serie; wenn zu wenig Punkte: Winsorize auf [min, max].
 */
export function bereinigeBewertungsSerie(
  werte: number[],
  maxSinnvoll: number,
  minSinnvoll = 1,
): number[] {
  if (werte.length === 0) return []
  const gefiltert = werte.filter((v) => v >= minSinnvoll && v <= maxSinnvoll)
  if (gefiltert.length >= 2) return gefiltert
  return werte.map((v) => Math.min(maxSinnvoll, Math.max(minSinnvoll, v)))
}

/** Perzentil von `aktuell` in der sortierten Historie (0 = günstigstes, 100 = teuerstes). */
export function perzentilInSerie(aktuell: number, historie: number[]): number | null {
  const vals = historie.filter((v) => Number.isFinite(v) && v > 0)
  if (!Number.isFinite(aktuell) || aktuell <= 0 || vals.length < 3) return null
  const kleiner = vals.filter((v) => v < aktuell).length
  const gleich = vals.filter((v) => v === aktuell).length
  return Math.round(((kleiner + gleich * 0.5) / vals.length) * 1000) / 10
}

function parseMetricZahl(wertStr: string): number | null {
  const s = wertStr
    .replace(/[x%\s$€]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const v = parseFloat(s)
  return Number.isFinite(v) ? v : null
}

/**
 * Qualitätskennzahlen aus dem Fundamentalpaket (Macrotrends-Zeilen + Key Metrics).
 * NRR / GAAP-Lücke / Zinsdeckung können optional von außen angereichert werden.
 */
export function berechneQualitaetSignaleAusPaket(
  paket: FundamentaldatenPaket,
  extras?: {
    nrrPct?: number | null
    interestCoverage?: number | null
    kurzfristSchuldenAnteilPct?: number | null
    gaapAdjEpsLueckePct?: number | null
    gaapEps?: number | null
    adjustedEps?: number | null
  },
): NachkaufQualitaetSignale {
  const aktien = letzteWerte(paket, 'aktien', 6)
  let aktienVerwaesserungJaehrlichPct: number | null = null
  let aktienYoYPct: number | null = null
  if (aktien.length >= 2) {
    aktienVerwaesserungJaehrlichPct = cagrPct(aktien[0]!, aktien[aktien.length - 1]!, aktien.length - 1)
    const a0 = aktien[aktien.length - 2]!
    const a1 = aktien[aktien.length - 1]!
    if (a0 > 0) aktienYoYPct = ((a1 - a0) / a0) * 100
  }

  const keys = histKeys(paket.perioden, 5)
  const conversions: number[] = []
  for (const k of keys) {
    const fcf = wert(paket, 'fcf', k)
    const ni = wert(paket, 'nettogewinn', k)
    if (fcf == null || ni == null || ni <= 0) continue
    const conv = (fcf / ni) * 100
    // Extreme Werte bei winzigem Nettogewinn ausklammern
    if (Number.isFinite(conv) && conv > 0 && conv <= 350) conversions.push(conv)
  }
  const fcfConversionPct = conversions.length > 0 ? conversions[conversions.length - 1]! : null
  const fcfConversion3yPct =
    conversions.length >= 2
      ? conversions.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, conversions.length)
      : null

  const umsatz = letzteWerte(paket, 'umsatz', 3)
  let revGrowthPct: number | null = null
  if (umsatz.length >= 2 && umsatz[umsatz.length - 2]! > 0) {
    revGrowthPct =
      ((umsatz[umsatz.length - 1]! - umsatz[umsatz.length - 2]!) / umsatz[umsatz.length - 2]!) * 100
  }
  const fcfLast = letzteWerte(paket, 'fcf', 1)[0] ?? null
  const umsatzLast = letzteWerte(paket, 'umsatz', 1)[0] ?? null
  const fcfMarge =
    fcfLast != null && umsatzLast != null && umsatzLast > 0 ? (fcfLast / umsatzLast) * 100 : null
  const ruleOf40 =
    revGrowthPct != null
      ? (() => {
          const ebitM = letzteWerte(paket, 'ebit_marge', 1)[0] ?? null
          const marge = Math.max(fcfMarge ?? Number.NEGATIVE_INFINITY, ebitM ?? Number.NEGATIVE_INFINITY)
          return Number.isFinite(marge) ? revGrowthPct + marge : null
        })()
      : null

  const interestCoverageKm = paket.keyMetrics.find((m) => m.id === 'interest_coverage')
  const interestCoverageRaw =
    extras?.interestCoverage ??
    (interestCoverageKm ? parseMetricZahl(interestCoverageKm.wert) : null)
  const interestCoverage =
    interestCoverageRaw != null && interestCoverageRaw > 0 ? interestCoverageRaw : null

  const peKeys5 = histKeys(paket.perioden, 5)
  const peKeys10 = histKeys(paket.perioden, 10)
  const peHist5Roh = peKeys5
    .map((k) => wert(paket, 'kgv', k))
    .filter((v): v is number => v != null && v > 0)
  const peHist10Roh = peKeys10
    .map((k) => wert(paket, 'kgv', k))
    .filter((v): v is number => v != null && v > 0)
  const peHist5 = bereinigeBewertungsSerie(peHist5Roh, 100, 3)
  const peHist10 = bereinigeBewertungsSerie(peHist10Roh, 100, 3)
  const peTtm = wert(paket, 'kgv', FUNDAMENTAL_TTM_KEY)
  const peKm = paket.keyMetrics.find((m) => m.id === 'ltm_pe')
  const peAktuell =
    peTtm ?? (peKm ? parseMetricZahl(peKm.wert) : null) ?? peHist5Roh[peHist5Roh.length - 1] ?? null
  const pePerzentil5y = peAktuell != null ? perzentilInSerie(peAktuell, peHist5) : null
  const pePerzentil10y = peAktuell != null ? perzentilInSerie(peAktuell, peHist10) : null

  let gaapAdjEpsLueckePct = extras?.gaapAdjEpsLueckePct ?? null
  if (
    gaapAdjEpsLueckePct == null &&
    extras?.gaapEps != null &&
    extras.adjustedEps != null &&
    Math.abs(extras.gaapEps) > 0.01
  ) {
    gaapAdjEpsLueckePct = ((extras.adjustedEps - extras.gaapEps) / Math.abs(extras.gaapEps)) * 100
  }

  let cashEpsVsGaapLueckePct: number | null = null
  const epsLast = letzteWerte(paket, 'eps', 1)[0] ?? extras?.gaapEps ?? null
  const aktienLast = letzteWerte(paket, 'aktien', 1)[0] ?? null
  if (fcfLast != null && aktienLast != null && aktienLast > 0 && epsLast != null && Math.abs(epsLast) > 0.01) {
    const cashEps = fcfLast / aktienLast
    const luecke = ((cashEps - epsLast) / Math.abs(epsLast)) * 100
    // Nur interpretierbar, wenn Lücke nicht absurd (z. B. Fast-Zero-GAAP-EPS)
    if (Number.isFinite(luecke) && Math.abs(luecke) <= 200) cashEpsVsGaapLueckePct = luecke
  }

  return {
    aktienVerwaesserungJaehrlichPct:
      aktienVerwaesserungJaehrlichPct != null
        ? Math.round(aktienVerwaesserungJaehrlichPct * 100) / 100
        : null,
    aktienYoYPct: aktienYoYPct != null ? Math.round(aktienYoYPct * 100) / 100 : null,
    fcfConversionPct: fcfConversionPct != null ? Math.round(fcfConversionPct * 10) / 10 : null,
    fcfConversion3yPct: fcfConversion3yPct != null ? Math.round(fcfConversion3yPct * 10) / 10 : null,
    nrrPct: extras?.nrrPct ?? null,
    ruleOf40: ruleOf40 != null ? Math.round(ruleOf40 * 10) / 10 : null,
    interestCoverage: interestCoverage != null ? Math.round(interestCoverage * 100) / 100 : null,
    kurzfristSchuldenAnteilPct: extras?.kurzfristSchuldenAnteilPct ?? null,
    pePerzentil5y,
    pePerzentil10y,
    gaapAdjEpsLueckePct:
      gaapAdjEpsLueckePct != null ? Math.round(gaapAdjEpsLueckePct * 10) / 10 : null,
    cashEpsVsGaapLueckePct:
      cashEpsVsGaapLueckePct != null ? Math.round(cashEpsVsGaapLueckePct * 10) / 10 : null,
  }
}

/**
 * Zusatz-Signale für den Nachkauf-Radar — vollständige Entscheidungsdaten.
 * Primär aus paket.erweitert + Bilanz-Zeilen; Capital Allocation separat.
 */

import 'server-only'

import { ladeCapitalAllocation, type CapitalAllocationBewertung } from '@/lib/portfolio-analyse/capital-allocation-server'
import { ladeEarningsBeatMissHistorie } from '@/lib/portfolio-analyse/earnings-beat-miss-historie-server'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { FUNDAMENTAL_FY0E_KEY, FUNDAMENTAL_FY1E_KEY } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import type { NachkaufBewertungsSignale } from './nachkauf-radar-types'

export type NachkaufZusatzSignale = {
  epsBeatRatePct: number | null
  epsBeatRate12Pct: number | null
  umsatzBeatRatePct: number | null
  umsatzBeatRate12Pct: number | null
  letztesQuartalEpsBeat: boolean | null
  epsStreakArt: 'beat' | 'miss' | 'mixed' | null
  epsStreakLaenge: number
  beatMissHinweis: string | null
  epsWachstumFy0Pct: number | null
  epsWachstumFy1Pct: number | null
  capitalAllocationScorePct: number | null
  capitalAllocationLabel: string | null
  netDebtEbitda: number | null
  shortFloatPct: number | null
  shortRatio: number | null
  insiderOwnershipPct: number | null
  institutionenPct: number | null
  dividendenCagr5yPct: number | null
  jahreOhneSenkung: number | null
  capexDaRatio: number | null
  insiderNettoRichtung: 'kauf' | 'verkauf' | 'neutral' | null
  pensionVerpflichtungMio: number | null
  leaseVerpflichtungMio: number | null
  /** Bilanz: Bargeld minus Gesamtverschuldung (Mio. USD). */
  nettoCashMio: number | null
  /** Goodwill / Gesamtvermögen in %. */
  goodwillAnteilPct: number | null
  /** Größtes SEC-Geo-Segment in %. */
  segmentKonzentrationPct: number | null
  /** Capital Allocation — Einzelsäulen (aus Yahoo-Cashflow). */
  capAllocBuyback: CapitalAllocationBewertung | null
  capAllocDividend: CapitalAllocationBewertung | null
  capAllocCapex: CapitalAllocationBewertung | null
  capAllocMna: CapitalAllocationBewertung | null
  capAllocWarnungen: number
  /** SBC / |FCF| letztes FY in %. */
  sbcVsFcfPct: number | null
  /** DSO: jüngstes Jahr minus Vorjahr (positiv = schlechter). */
  dsoTrendDelta: number | null
  /** DIO-Trend (Tage). */
  dioTrendDelta: number | null
  /** DPO-Trend (negativ = schneller zahlen = schlechter). */
  dpoTrendDelta: number | null
  /** Aktienrückkäufe letztes FY (Mio. USD, typ. negativ). */
  aktienrueckkaufMio: number | null
  /** 0–100: wie viele Kern-Signale befüllt sind. */
  datenVollstaendigkeitPct: number
}

function wertAusZeile(paket: FundamentaldatenPaket, zeilenId: string, key: string): number | null {
  const z = paket.zeilen.find((r) => r.id === zeilenId)
  const v = z?.werte[key]
  return v != null && Number.isFinite(v) ? v : null
}

function letzterHistorischerWert(paket: FundamentaldatenPaket, zeilenId: string): number | null {
  const z = paket.zeilen.find((r) => r.id === zeilenId)
  if (!z) return null
  for (let i = paket.perioden.length - 1; i >= 0; i--) {
    const p = paket.perioden[i]!
    if (p.istSchaetzung || p.istNtm) continue
    const v = z.werte[p.iso]
    if (v != null && Number.isFinite(v)) return v
  }
  return null
}

function schaetzungsWachstum(paket: FundamentaldatenPaket): { fy0: number | null; fy1: number | null } {
  return {
    fy0: wertAusZeile(paket, 'eps_wachstum_schaetzung', FUNDAMENTAL_FY0E_KEY),
    fy1: wertAusZeile(paket, 'eps_wachstum_schaetzung', FUNDAMENTAL_FY1E_KEY),
  }
}

function parseMetricZahl(wert: string): number | null {
  const s = wert
    .replace(/[x%\s$€]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const v = parseFloat(s)
  return Number.isFinite(v) ? v : null
}

function netDebtEbitdaAusPaket(paket: FundamentaldatenPaket): number | null {
  const km = paket.keyMetrics.find((m) => m.id === 'net_debt_ebitda')
  return km ? parseMetricZahl(km.wert) : null
}

function bilanzStruktur(paket: FundamentaldatenPaket): {
  nettoCashMio: number | null
  goodwillAnteilPct: number | null
} {
  const cash = letzterHistorischerWert(paket, 'bargeld')
  const debt = letzterHistorischerWert(paket, 'gesamtverschuldung')
  const goodwill = letzterHistorischerWert(paket, 'goodwill')
  const assets = letzterHistorischerWert(paket, 'gesamtvermoegen')

  const nettoCashMio =
    cash != null && debt != null ? Math.round((cash - debt) * 10) / 10 : null

  const goodwillAnteilPct =
    goodwill != null && assets != null && assets > 0
      ? Math.round((goodwill / assets) * 1000) / 10
      : null

  return { nettoCashMio, goodwillAnteilPct }
}

function segmentKonzentration(
  segmente: { anteilPct: number | null }[] | undefined,
): number | null {
  if (!segmente?.length) return null
  const max = Math.max(...segmente.map((s) => s.anteilPct ?? 0))
  return max > 0 ? max : null
}

/** Letzte zwei historische Werte: jüngstes minus älteres. */
function trendDeltaAusZeile(paket: FundamentaldatenPaket, zeilenId: string): number | null {
  const z = paket.zeilen.find((r) => r.id === zeilenId)
  if (!z) return null
  const werte: number[] = []
  for (let i = paket.perioden.length - 1; i >= 0 && werte.length < 2; i--) {
    const p = paket.perioden[i]!
    if (p.istSchaetzung || p.istNtm) continue
    const v = z.werte[p.iso]
    if (v != null && Number.isFinite(v)) werte.push(v)
  }
  if (werte.length < 2) return null
  return Math.round((werte[0]! - werte[1]!) * 10) / 10
}

function sbcVsFcfPctAusPaket(paket: FundamentaldatenPaket): number | null {
  const sbc = letzterHistorischerWert(paket, 'sbc')
  const fcf = letzterHistorischerWert(paket, 'fcf')
  if (sbc == null || fcf == null || Math.abs(fcf) < 1) return null
  return Math.round((Math.abs(sbc) / Math.abs(fcf)) * 1000) / 10
}

function capAllocAusPaket(capital: Awaited<ReturnType<typeof ladeCapitalAllocation>> | null): {
  capAllocBuyback: CapitalAllocationBewertung | null
  capAllocDividend: CapitalAllocationBewertung | null
  capAllocCapex: CapitalAllocationBewertung | null
  capAllocMna: CapitalAllocationBewertung | null
  capAllocWarnungen: number
} {
  const saeulen = capital?.saeulen ?? []
  const vonId = (id: 'buyback' | 'dividend' | 'capex' | 'mna') =>
    saeulen.find((s) => s.id === id)?.bewertung ?? null
  const capAllocWarnungen = saeulen.filter((s) => s.bewertung === 'warnung').length
  return {
    capAllocBuyback: vonId('buyback'),
    capAllocDividend: vonId('dividend'),
    capAllocCapex: vonId('capex'),
    capAllocMna: vonId('mna'),
    capAllocWarnungen,
  }
}

function letztesQuartalAusStreak(
  streak: { eps: 'beat' | 'miss' | 'mixed' | null; epsLaenge: number } | null | undefined,
): boolean | null {
  if (!streak?.eps || streak.epsLaenge < 1) return null
  if (streak.eps === 'beat') return true
  if (streak.eps === 'miss') return false
  return null
}

export function berechneDatenVollstaendigkeit(
  zusatz: NachkaufZusatzSignale,
  signale: Pick<
    NachkaufBewertungsSignale,
    | 'forwardPe'
    | 'fcfYieldPct'
    | 'ntmEvEbitda'
    | 'historischerMedianPe'
    | 'historischerMedianFcfYield'
    | 'drawdown52wPct'
  >,
): number {
  const checks = [
    signale.forwardPe != null || signale.fcfYieldPct != null || signale.ntmEvEbitda != null,
    signale.historischerMedianPe != null || signale.historischerMedianFcfYield != null,
    zusatz.epsBeatRatePct != null,
    zusatz.epsBeatRate12Pct != null,
    zusatz.capitalAllocationScorePct != null,
    zusatz.capAllocBuyback != null,
    zusatz.netDebtEbitda != null || zusatz.nettoCashMio != null,
    zusatz.capexDaRatio != null,
    zusatz.sbcVsFcfPct != null,
    signale.drawdown52wPct != null,
    zusatz.insiderNettoRichtung != null || zusatz.insiderOwnershipPct != null,
    zusatz.pensionVerpflichtungMio != null || zusatz.leaseVerpflichtungMio != null,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

export async function ladeNachkaufZusatzSignale(opts: {
  paket: FundamentaldatenPaket
  ticker: string
  symbolYahoo: string | null
  isin: string
}): Promise<NachkaufZusatzSignale> {
  const sym = opts.symbolYahoo ?? opts.ticker
  const wachstum = schaetzungsWachstum(opts.paket)
  const erw = opts.paket.erweitert
  const bilanz = bilanzStruktur(opts.paket)

  const capital = await ladeCapitalAllocation({ ticker: opts.ticker, symbolYahoo: sym }).catch(() => null)

  let epsBeatRatePct = erw?.beatMiss?.epsBeatRatePct ?? null
  let epsBeatRate12Pct = erw?.beatMiss?.agg12?.epsBeatRatePct ?? null
  let umsatzBeatRatePct: number | null = null
  let umsatzBeatRate12Pct = erw?.beatMiss?.agg12?.umsatzBeatRatePct ?? null
  let letztesQuartalEpsBeat = letztesQuartalAusStreak(erw?.beatMiss?.streak)
  let epsStreakArt = erw?.beatMiss?.streak?.eps ?? null
  let epsStreakLaenge = erw?.beatMiss?.streak?.epsLaenge ?? 0
  let beatMissHinweis: string | null = null

  if (!erw?.beatMiss) {
    const beatMiss = await ladeEarningsBeatMissHistorie({
      ticker: opts.ticker,
      symbolYahoo: sym,
      isin: opts.isin,
      limit: 8,
    }).catch(() => null)

    epsBeatRatePct = beatMiss?.epsBeatRatePct ?? null
    epsBeatRate12Pct = beatMiss?.agg12?.epsBeatRatePct ?? null
    umsatzBeatRatePct = beatMiss?.umsatzBeatRatePct ?? null
    umsatzBeatRate12Pct = beatMiss?.agg12?.umsatzBeatRatePct ?? null
    beatMissHinweis = beatMiss?.guidanceHinweis || null
    epsStreakArt = beatMiss?.streak?.eps ?? null
    epsStreakLaenge = beatMiss?.streak?.epsLaenge ?? 0
    letztesQuartalEpsBeat = letztesQuartalAusStreak(beatMiss?.streak)

    const letztesQ = beatMiss?.quartale?.[0]
    if (letztesQuartalEpsBeat == null && letztesQ?.eps.ist != null && letztesQ.eps.schaetzung != null) {
      letztesQuartalEpsBeat = letztesQ.eps.ist >= letztesQ.eps.schaetzung
    }
  }

  const finviz = erw?.finviz
  const holders = erw?.holders
  const capAlloc = capAllocAusPaket(capital)

  const partial: Omit<NachkaufZusatzSignale, 'datenVollstaendigkeitPct'> = {
    epsBeatRatePct,
    epsBeatRate12Pct,
    umsatzBeatRatePct,
    umsatzBeatRate12Pct,
    letztesQuartalEpsBeat,
    epsStreakArt,
    epsStreakLaenge,
    beatMissHinweis,
    epsWachstumFy0Pct: wachstum.fy0,
    epsWachstumFy1Pct: wachstum.fy1,
    capitalAllocationScorePct: capital?.scorePct ?? null,
    capitalAllocationLabel: capital?.scoreLabel ?? null,
    netDebtEbitda: netDebtEbitdaAusPaket(opts.paket),
    shortFloatPct: finviz?.shortFloatPct ?? null,
    shortRatio: finviz?.shortRatio ?? null,
    insiderOwnershipPct:
      finviz?.insiderOwnershipPct ??
      (holders?.insiderPct != null ? holders.insiderPct * 100 : null),
    institutionenPct: holders?.institutionenPct != null ? holders.institutionenPct * 100 : null,
    dividendenCagr5yPct: erw?.dividenden?.cagr5yPct ?? null,
    jahreOhneSenkung: erw?.dividenden?.jahreOhneSenkung ?? null,
    capexDaRatio: letzterHistorischerWert(opts.paket, 'capex_da_ratio'),
    insiderNettoRichtung: erw?.insiderNetto?.nettoRichtung ?? null,
    pensionVerpflichtungMio: erw?.secStruktur?.pensionVerpflichtungMio ?? null,
    leaseVerpflichtungMio: erw?.secStruktur?.leaseVerpflichtungMio ?? null,
    nettoCashMio: bilanz.nettoCashMio,
    goodwillAnteilPct: bilanz.goodwillAnteilPct,
    segmentKonzentrationPct: segmentKonzentration(erw?.secStruktur?.segmente),
    ...capAlloc,
    sbcVsFcfPct: sbcVsFcfPctAusPaket(opts.paket),
    dsoTrendDelta: trendDeltaAusZeile(opts.paket, 'dso'),
    dioTrendDelta: trendDeltaAusZeile(opts.paket, 'dio'),
    dpoTrendDelta: trendDeltaAusZeile(opts.paket, 'dpo'),
    aktienrueckkaufMio: letzterHistorischerWert(opts.paket, 'aktienrueckkauf'),
  }

  return {
    ...partial,
    datenVollstaendigkeitPct: 0,
  }
}

/** Vollständigkeit nach Bewertungssignalen setzen. */
export function ergaenzeDatenVollstaendigkeit(
  zusatz: NachkaufZusatzSignale,
  signale: NachkaufBewertungsSignale,
): NachkaufZusatzSignale {
  return {
    ...zusatz,
    datenVollstaendigkeitPct: berechneDatenVollstaendigkeit(zusatz, signale),
  }
}

/** Kompakte Zeile für Flash-KI. */
export function formatZusatzSignaleKurz(z: NachkaufZusatzSignale): string {
  const teile: string[] = []
  if (z.epsBeatRate12Pct != null) teile.push(`EPS-Beat 12Q ${z.epsBeatRate12Pct} %`)
  if (z.umsatzBeatRate12Pct != null) teile.push(`Umsatz-Beat 12Q ${z.umsatzBeatRate12Pct} %`)
  if (z.epsStreakLaenge >= 2 && z.epsStreakArt) {
    teile.push(`EPS-Streak ${z.epsStreakLaenge}× ${z.epsStreakArt}`)
  }
  if (z.dividendenCagr5yPct != null) {
    teile.push(`Div.-CAGR 5J ${z.dividendenCagr5yPct.toFixed(1)} %`)
  }
  if (z.capexDaRatio != null) teile.push(`CapEx/D&A ${z.capexDaRatio.toFixed(2)}×`)
  if (z.capAllocBuyback === 'warnung') teile.push('Buyback-Warnung (CapAlloc)')
  else if (z.capAllocBuyback === 'gut' && z.aktienrueckkaufMio != null && z.aktienrueckkaufMio < -50) {
    teile.push('Buybacks aus FCF')
  }
  if (z.sbcVsFcfPct != null && z.sbcVsFcfPct >= 18) {
    teile.push(`SBC/FCF ${z.sbcVsFcfPct.toFixed(0)} %`)
  }
  if (z.dsoTrendDelta != null && z.dsoTrendDelta >= 8) {
    teile.push(`DSO +${z.dsoTrendDelta.toFixed(0)} Tage`)
  }
  if (z.nettoCashMio != null) teile.push(`Netto-Cash $${z.nettoCashMio} Mio.`)
  if (z.goodwillAnteilPct != null && z.goodwillAnteilPct >= 25) {
    teile.push(`Goodwill ${z.goodwillAnteilPct.toFixed(0)} % der Bilanz`)
  }
  if (z.segmentKonzentrationPct != null && z.segmentKonzentrationPct >= 50) {
    teile.push(`Segment-Konzentration ${z.segmentKonzentrationPct.toFixed(0)} %`)
  }
  if (z.insiderNettoRichtung && z.insiderNettoRichtung !== 'neutral') {
    teile.push(`Insider-Netto 90T: ${z.insiderNettoRichtung}`)
  }
  if (z.shortFloatPct != null && z.shortFloatPct >= 8) {
    teile.push(`Short Float ${z.shortFloatPct.toFixed(1)} %`)
  }
  if (z.pensionVerpflichtungMio != null && z.pensionVerpflichtungMio > 500) {
    teile.push(`Pension ~$${z.pensionVerpflichtungMio} Mio.`)
  }
  teile.push(`Datenabdeckung ${z.datenVollstaendigkeitPct} %`)
  return teile.length > 1 ? teile.join(' · ') : 'begrenzte Strukturdaten'
}

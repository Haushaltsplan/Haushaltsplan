/**
 * Zusatz-Signale für den Nachkauf-Radar — vollständige Entscheidungsdaten.
 * Primär aus paket.erweitert + Bilanz-Zeilen; Capital Allocation separat.
 */

import 'server-only'

import { ladeCapitalAllocation, type CapitalAllocationBewertung } from '@/lib/portfolio-analyse/capital-allocation-server'
import { ladeEarningsBeatMissHistorie } from '@/lib/portfolio-analyse/earnings-beat-miss-historie-server'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { FUNDAMENTAL_FY0E_KEY, FUNDAMENTAL_FY1E_KEY } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { ladeUnitEconomics } from '@/lib/portfolio-analyse/unit-economics-server'
import { ladeGaapAdjEpsLuecke } from '@/lib/portfolio-analyse/stockanalysis-gaap-adj-eps-server'
import { ladeSecCompanyFacts } from '@/lib/portfolio-analyse/sec-edgar-companyfacts-server'
import { cikFuerTicker } from '@/lib/portfolio-analyse/sec-edgar-common-server'
import { berechneQualitaetSignaleAusPaket } from './nachkauf-qualitaet-signale'
import type { NachkaufBewertungsSignale } from './nachkauf-radar-types'
import type { NachkaufPrognoseProfil } from './nachkauf-prognose-server'
import { extrahierePrognoseProfil } from './nachkauf-prognose-server'
import {
  extrahiereSegmentStrukturSignale,
  formatSegmentStrukturKontext,
} from './nachkauf-segment-struktur-hilfen'
import { berechneEarningsQuality } from '@/lib/portfolio-analyse/fundamentaldaten-earnings-quality'
import {
  berechnePegRatio,
  berechneReinvestition,
} from '@/lib/portfolio-analyse/fundamentaldaten-reinvestition'
import {
  berechneBruttomargenStabilitaet,
  berechneKundenKonzentrationTop3,
} from '@/lib/portfolio-analyse/fundamentaldaten-pricing-power'
import {
  ladeDebtMaturityProfil,
  ladeRdKapitalisierung,
} from '@/lib/portfolio-analyse/sec-edgar-debt-rd-server'
import { ladeEuUrdNotes } from '@/lib/portfolio-analyse/eu-urd-notes-server'

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
  /** Analysten-Schätzungen FY0 … 2027 (aus Fundamentaldaten). */
  prognoseProfil: NachkaufPrognoseProfil | null
  capitalAllocationScorePct: number | null
  capitalAllocationLabel: string | null
  netDebtEbitda: number | null
  /** Net Debt / FCF — reale Schuldentragfähigkeit. */
  netDebtFcf: number | null
  /** PEG = Fwd-KGV / EPS-Wachstum. */
  pegRatio: number | null
  /** (CapEx+M&A−D&A)/|FCF| %. */
  reinvestitionsquotePct: number | null
  /** Incremental ROIC %. */
  incrementalRoicPct: number | null
  /** Sloan Accruals-Ratio. */
  sloanRatio: number | null
  /** Beneish M-Score. */
  beneishMScore: number | null
  beneishRisiko: 'niedrig' | 'erhoeht' | 'hoch' | null
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
  /** Größtes Produkt-/Geo-Segment in % (Struktur & Daten, bevorzugt MS/SA-Historie). */
  segmentKonzentrationPct: number | null
  produktTopSegmentName: string | null
  auslandsumsatzAnteilPct: number | null
  geoTopRegionName: string | null
  geoTopRegionPct: number | null
  backlogWachstumPct: number | null
  backlogLabel: string | null
  segmentShiftPct: number | null
  /** Quelle der Segment-Historie (MS/SA/mixed). */
  segmentQuelle: 'marketscreener' | 'stockanalysis' | 'mixed' | 'sec_edgar' | 'eu_urd' | null
  /** Segment-Konzentration nur bei validierter Quelle in Score. */
  segmentDatenZuverlaessig: boolean
  /** Umsatzanteil größter Kunde %. */
  umsatzanteilTop1KundenPct: number | null
  /** Umsatzanteil Top-3-Kunden %. */
  umsatzanteilTop3KundenPct: number | null
  topKundenNamen: string[]
  /** Bruttomarge StdAbw. über bis zu 10 Jahre (Pp.). */
  bruttoMargeStd10y: number | null
  pricingPowerOk: boolean | null
  /** Schulden fällig in 24 Monaten (Mio.). */
  debtDue24mMio: number | null
  /** Anteil der Schulden mit Refi in 24 Monaten %. */
  debtRefi24mPct: number | null
  /** F&E-Aktivierungsquote %. */
  rdAktivierungsquotePct: number | null
  /** Tage bis nächstes Earnings (Momentum-Kalender). */
  tageBisEarnings: number | null
  /** Kompakter Struktur-Block für Deep Research. */
  segmentStrukturKontext: string | null
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
  /** Cash Conversion Cycle-Trend (DSO+DIO−DPO) — Kapitalbindung inkl. Finanz. */
  cccTrendDelta: number | null
  /** industrie = Lager relevant; finanz = DSO/CCC statt DIO. */
  wcProfil: 'industrie' | 'finanz' | null
  /** Aktienrückkäufe letztes FY (Mio. USD, typ. negativ). */
  aktienrueckkaufMio: number | null
  /** Punkt 2: CAGR ausstehende Aktien (positiv = Verwässerung). */
  aktienVerwaesserungJaehrlichPct: number | null
  /** YoY Shares %. */
  aktienYoYPct: number | null
  /** Punkt 3: FCF/Nettogewinn %. */
  fcfConversionPct: number | null
  fcfConversion3yPct: number | null
  /** Punkt 4: NRR % / Rule of 40. */
  nrrPct: number | null
  ruleOf40: number | null
  /** Punkt 5: Zinsdeckung + Refi-Druck. */
  interestCoverage: number | null
  kurzfristSchuldenAnteilPct: number | null
  /** Punkt 6: KGV-Perzentil eigene Historie. */
  pePerzentil5y: number | null
  pePerzentil10y: number | null
  /** Punkt 7: GAAP vs Adjusted / Cash-EPS-Lücke. */
  gaapAdjEpsLueckePct: number | null
  cashEpsVsGaapLueckePct: number | null
  /** Earnings-Call-KI-Text (Cache) — wirkt auf Score/Ampel. */
  earningsKiZusammenfassung?: string | null
  /** SEC/IR-KI-Text (Cache) — wirkt auf Score/Ampel. */
  secKiZusammenfassung?: string | null
  /** Management-Sentiment −100…+100 aus Earnings-Call-KI. */
  earningsSentimentScore?: number | null
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

function netDebtFcfAusPaket(paket: FundamentaldatenPaket): number | null {
  const km = paket.keyMetrics.find((m) => m.id === 'net_debt_fcf')
  if (km) {
    const v = parseMetricZahl(km.wert)
    if (v != null) return v
  }
  const netDebt = paket.keyMetrics.find((m) => m.id === 'net_debt')
  const debtUsd = netDebt ? parseMetricZahl(netDebt.wert) : null
  // Fallback: nettoverschuldung / fcf aus Zeilen
  const ndMio = letzterHistorischerWert(paket, 'nettoverschuldung')
  const fcfMio = letzterHistorischerWert(paket, 'fcf')
  if (ndMio != null && fcfMio != null && Math.abs(fcfMio) >= 1) {
    return Math.round((ndMio / Math.abs(fcfMio)) * 100) / 100
  }
  void debtUsd
  return null
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

/** Letzte zwei historische Werte: jüngstes minus älteres (fuzzy ISO-Match). */
function trendDeltaAusZeile(paket: FundamentaldatenPaket, zeilenId: string): number | null {
  const z = paket.zeilen.find((r) => r.id === zeilenId)
  if (!z) return null
  const werte: number[] = []
  for (let i = paket.perioden.length - 1; i >= 0 && werte.length < 2; i--) {
    const p = paket.perioden[i]!
    if (p.istSchaetzung || p.istNtm || p.istLtm) continue
    // Fuzzy: exakter Key oder gleicher Jahrgang
    let v = z.werte[p.iso]
    if (v == null || !Number.isFinite(v)) {
      const jahr = p.iso.slice(0, 4)
      for (const [k, val] of Object.entries(z.werte)) {
        if (k.startsWith(jahr) && val != null && Number.isFinite(val)) {
          v = val
          break
        }
      }
    }
    if (v != null && Number.isFinite(v)) werte.push(v)
  }
  if (werte.length < 2) return null
  return Math.round((werte[0]! - werte[1]!) * 10) / 10
}

function sbcVsFcfPctAusPaket(paket: FundamentaldatenPaket): number | null {
  const sbc = letzterHistorischerWert(paket, 'sbc')
  const fcf = letzterHistorischerWert(paket, 'fcf')
  if (sbc != null && fcf != null && Math.abs(fcf) >= 1) {
    return Math.round((Math.abs(sbc) / Math.abs(fcf)) * 1000) / 10
  }

  // Fallback: Key-Metric / Kontext-ähnliche Yahoo-SBC-Ratio falls Zeile fehlt
  const km = paket.keyMetrics.find((m) => m.id === 'sbc_fcf_ratio' || m.id === 'sbc_vs_fcf')
  if (km) {
    const v = parseMetricZahl(km.wert)
    if (v != null && v > 0) return v
  }
  return null
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

/** Wenn Yahoo/SEC CapAlloc leer: CapEx/Buyback/Dividende aus Macrotrends-Zeilen ableiten. */
function capAllocAusFundamentalPaket(paket: FundamentaldatenPaket): {
  capAllocBuyback: CapitalAllocationBewertung | null
  capAllocDividend: CapitalAllocationBewertung | null
  capAllocCapex: CapitalAllocationBewertung | null
  capAllocMna: CapitalAllocationBewertung | null
  capAllocWarnungen: number
  capitalAllocationScorePct: number | null
  capitalAllocationLabel: string | null
} | null {
  const ocf = letzterHistorischerWert(paket, 'ocf')
  const fcf = letzterHistorischerWert(paket, 'fcf')
  const capex = letzterHistorischerWert(paket, 'capex')
  const div = letzterHistorischerWert(paket, 'dividenden_gezahlt')
  const buy = letzterHistorischerWert(paket, 'aktienrueckkauf')
  if (ocf == null || !(Math.abs(ocf) > 0)) return null

  const pctOf = (teil: number | null) =>
    teil == null ? null : Math.round((Math.abs(teil) / Math.abs(ocf)) * 1000) / 10

  const bewerte = (
    id: 'capex' | 'dividend' | 'buyback' | 'mna',
    p: number | null,
  ): CapitalAllocationBewertung => {
    if (p == null) return 'keine_daten'
    if (id === 'capex') {
      if (p >= 5 && p <= 30) return 'gut'
      if (p > 45) return 'warnung'
      return 'neutral'
    }
    if (id === 'dividend') {
      if (p <= 40) return 'gut'
      if (p > 60 || (fcf != null && fcf < 0)) return 'warnung'
      return 'neutral'
    }
    if (id === 'buyback') {
      if (p === 0) return 'neutral'
      if (fcf != null && fcf > 0 && p <= 50) return 'gut'
      if (fcf != null && fcf < 0 && p > 20) return 'warnung'
      return 'neutral'
    }
    // mna: ohne Daten → 0 = gut (geringe M&A)
    if (p <= 10) return 'gut'
    if (p > 35) return 'warnung'
    return 'neutral'
  }

  const capexPct = pctOf(capex)
  const divPct = pctOf(div ?? 0)
  const buyPct = pctOf(buy ?? 0)
  const mnaPct = 0 // Macrotrends hat selten purchaseOfBusiness — als 0 behandeln wenn OCF da

  const saeulen = [
    bewerte('capex', capexPct),
    bewerte('dividend', divPct),
    bewerte('buyback', buyPct),
    bewerte('mna', mnaPct),
  ]
  let score = 50
  if (fcf != null && fcf > 0) score += 15
  if (fcf != null && fcf < 0) score -= 15
  for (const s of saeulen) {
    if (s === 'gut') score += 8
    if (s === 'warnung') score -= 10
  }
  score = Math.max(0, Math.min(100, score))
  const label =
    score >= 75 ? 'stark' : score >= 55 ? 'solide' : score >= 35 ? 'beobachten' : 'schwach'

  return {
    capAllocCapex: bewerte('capex', capexPct),
    capAllocDividend: bewerte('dividend', divPct),
    capAllocBuyback: bewerte('buyback', buyPct),
    capAllocMna: bewerte('mna', mnaPct),
    capAllocWarnungen: saeulen.filter((s) => s === 'warnung').length,
    capitalAllocationScorePct: score,
    capitalAllocationLabel: label,
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
    zusatz.prognoseProfil != null && zusatz.prognoseProfil.anzahlJahre >= 2,
    zusatz.aktienVerwaesserungJaehrlichPct != null || zusatz.fcfConversionPct != null,
    zusatz.interestCoverage != null || zusatz.pePerzentil5y != null,
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
  const prognoseProfil = extrahierePrognoseProfil(opts.paket)
  const erw = opts.paket.erweitert
  const bilanz = bilanzStruktur(opts.paket)
  const segSig = extrahiereSegmentStrukturSignale(erw?.secSegmentHistorie, erw?.secStruktur)
  const segmentStrukturKontext = formatSegmentStrukturKontext(
    erw?.secSegmentHistorie,
    erw?.secStruktur,
  )

  const capital = await ladeCapitalAllocation({
    ticker: opts.ticker,
    symbolYahoo: sym,
    isin: opts.isin,
  }).catch(() => null)

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
  let capAlloc = capAllocAusPaket(capital)
  let capitalAllocationScorePct = capital?.scorePct ?? null
  let capitalAllocationLabel: string | null = capital?.scoreLabel ?? null
  if (capAlloc.capAllocCapex == null || capitalAllocationScorePct == null) {
    const mt = capAllocAusFundamentalPaket(opts.paket)
    if (mt) {
      capAlloc = {
        capAllocBuyback: capAlloc.capAllocBuyback ?? mt.capAllocBuyback,
        capAllocDividend: capAlloc.capAllocDividend ?? mt.capAllocDividend,
        capAllocCapex: capAlloc.capAllocCapex ?? mt.capAllocCapex,
        capAllocMna: capAlloc.capAllocMna ?? mt.capAllocMna,
        capAllocWarnungen: Math.max(capAlloc.capAllocWarnungen, mt.capAllocWarnungen),
      }
      capitalAllocationScorePct = capitalAllocationScorePct ?? mt.capitalAllocationScorePct
      capitalAllocationLabel = capitalAllocationLabel ?? mt.capitalAllocationLabel
    }
  }

  const [unitEc, gaapAdj, secKennz, debtMatRaw, rdKapRaw] = await Promise.all([
  // Unit Economics mit US-Bare-Ticker (nicht H11/RMS.PA)
  ladeUnitEconomics(opts.ticker.split('.')[0]!).catch(() => null),
    ladeGaapAdjEpsLuecke({
      symbolYahoo: sym,
      isin: opts.isin,
      firmenname: opts.paket.firmenname,
    }).catch(() => null),
    (async () => {
      const bestehend = erw?.secSegmentHistorie?.kennzahlen
      if (bestehend?.zinsaufwandMio?.length || bestehend?.kurzfristigeSchuldenMio?.length) {
        return bestehend
      }
      const cik = await cikFuerTicker(sym).catch(() => null)
      if (!cik) return null
      return ladeSecCompanyFacts(cik).catch(() => null)
    })(),
    erw?.debtMaturity
      ? Promise.resolve(erw.debtMaturity)
      : ladeDebtMaturityProfil(sym.split('.')[0]!).catch(() => null),
    erw?.rdKapitalisierung
      ? Promise.resolve(erw.rdKapitalisierung)
      : ladeRdKapitalisierung(sym.split('.')[0]!).catch(() => null),
  ])

  let debtMat = debtMatRaw
  let rdKap = rdKapRaw
  let urdHauptkunden: Array<{ name: string; anteilPct: number }> | null = null
  const isinU = (opts.isin ?? '').trim().toUpperCase()
  const isEu =
    /^(DE|NL|FR|CH|GB|IE|AT|BE|LU|SE|DK|FI|NO|ES|IT|PT|PL)/.test(isinU)
  if (
    isEu &&
    isinU.length >= 10 &&
    (!debtMat || !rdKap || !(erw?.secSegmentHistorie?.zusatz?.hauptkunden?.length))
  ) {
    const urd = await ladeEuUrdNotes({
      isin: isinU,
      ticker: opts.ticker,
      firmenname: opts.paket.firmenname,
    }).catch(() => null)
    if (urd) {
      if (!debtMat && urd.debtMaturity) debtMat = urd.debtMaturity
      if (!rdKap && urd.rdKapitalisierung) rdKap = urd.rdKapitalisierung
      if (urd.hauptkunden.length > 0) urdHauptkunden = urd.hauptkunden
    }
  }

  const kennz = secKennz ?? erw?.secSegmentHistorie?.kennzahlen
  let kurzfristSchuldenAnteilPct: number | null = null
  let interestCoverageSec: number | null = null
  if (kennz) {
    const lastKurz = kennz.kurzfristigeSchuldenMio[kennz.kurzfristigeSchuldenMio.length - 1]
    const lastLt = kennz.langfristigeSchuldenMio[kennz.langfristigeSchuldenMio.length - 1]
    const lastZins = kennz.zinsaufwandMio[kennz.zinsaufwandMio.length - 1]
    const lastEbit = kennz.ebitMio[kennz.ebitMio.length - 1]
    if (lastKurz && lastLt && lastLt.wert > 0) {
      const total = lastLt.wert + lastKurz.wert
      if (total > 0) kurzfristSchuldenAnteilPct = Math.round((lastKurz.wert / total) * 1000) / 10
    } else if (lastKurz && lastLt == null && lastKurz.wert > 0) {
      kurzfristSchuldenAnteilPct = 100
    }
    if (lastEbit && lastZins && lastZins.wert > 0) {
      interestCoverageSec = Math.round((lastEbit.wert / Math.abs(lastZins.wert)) * 100) / 100
    }
  }

  const qualitaet = berechneQualitaetSignaleAusPaket(opts.paket, {
    nrrPct: unitEc?.nrrPct ?? null,
    interestCoverage: interestCoverageSec,
    kurzfristSchuldenAnteilPct,
    gaapAdjEpsLueckePct: gaapAdj?.lueckePct ?? null,
    gaapEps: gaapAdj?.gaapEps ?? kennz?.epsGaap[kennz.epsGaap.length - 1]?.wert ?? null,
    adjustedEps: gaapAdj?.adjustedEps ?? null,
  })

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
    prognoseProfil,
    capitalAllocationScorePct,
    capitalAllocationLabel,
    netDebtEbitda: netDebtEbitdaAusPaket(opts.paket),
    netDebtFcf: netDebtFcfAusPaket(opts.paket),
    pegRatio: (() => {
      const fwdPe = opts.paket.keyMetrics.find((m) => m.id === 'ntm_pe')
      const pe = fwdPe ? parseMetricZahl(fwdPe.wert) : null
      const wachstum =
        schaetzungsWachstum(opts.paket).fy1 ??
        schaetzungsWachstum(opts.paket).fy0 ??
        null
      const kmPeg = opts.paket.keyMetrics.find((m) => m.id === 'peg_ratio')
      const ausKm = kmPeg ? parseMetricZahl(kmPeg.wert) : null
      return (
        ausKm ??
        berechnePegRatio(pe, wachstum, erw?.finviz?.peg ?? null)
      )
    })(),
    ...(() => {
      const mnaMio = capital?.saeulen.find((s) => s.id === 'mna')?.betragMioUsd ?? null
      const r = berechneReinvestition(opts.paket.perioden, opts.paket.zeilen, mnaMio, null, null)
      const eq = berechneEarningsQuality(opts.paket.perioden, opts.paket.zeilen)
      // Incremental ROIC aus Key Metrics (bereits Yahoo/Nasdaq), sonst null
      const kmIncr = opts.paket.keyMetrics.find((m) => m.id === 'incremental_roic')
      const incrAusKm = kmIncr ? parseMetricZahl(kmIncr.wert) : null
      return {
        reinvestitionsquotePct: r.reinvestitionsquotePct,
        incrementalRoicPct: incrAusKm ?? r.incrementalRoicPct,
        sloanRatio: eq.sloanRatio,
        beneishMScore: eq.beneishMScore,
        beneishRisiko: eq.beneishRisiko,
      }
    })(),
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
    segmentKonzentrationPct:
      segSig.segmentKonzentrationPct ?? segmentKonzentration(erw?.secStruktur?.segmente),
    produktTopSegmentName: segSig.produktTopSegmentName,
    auslandsumsatzAnteilPct: segSig.auslandsumsatzAnteilPct,
    geoTopRegionName: segSig.geoTopRegionName,
    geoTopRegionPct: segSig.geoTopRegionPct,
    backlogWachstumPct: segSig.backlogWachstumPct,
    backlogLabel: segSig.backlogLabel,
    segmentShiftPct: segSig.segmentShiftPct,
    segmentQuelle: segSig.segmentQuelle,
    segmentDatenZuverlaessig: segSig.segmentDatenZuverlaessig,
    ...(() => {
      const kunden = berechneKundenKonzentrationTop3(
        erw?.secSegmentHistorie?.zusatz?.hauptkunden?.length
          ? erw.secSegmentHistorie.zusatz.hauptkunden
          : urdHauptkunden,
      )
      const bruttoHist = opts.paket.zeilen.find((z) => z.id === 'bruttomarge')
      const histVals: number[] = []
      if (bruttoHist) {
        for (const p of opts.paket.perioden) {
          if (p.istSchaetzung || p.istNtm || p.istLtm) continue
          const v = bruttoHist.werte[p.iso]
          if (v != null && Number.isFinite(v)) histVals.push(v)
        }
      }
      const stab = berechneBruttomargenStabilitaet(histVals)
      return {
        umsatzanteilTop1KundenPct: kunden.umsatzanteilTop1KundenPct,
        umsatzanteilTop3KundenPct: kunden.umsatzanteilTop3KundenPct,
        topKundenNamen: kunden.topKundenNamen,
        bruttoMargeStd10y: stab.bruttoMargeStd10y,
        pricingPowerOk: stab.pricingPowerOk,
        debtDue24mMio: debtMat?.due24mMio ?? null,
        debtRefi24mPct: debtMat?.refiAnteil24mPct ?? null,
        rdAktivierungsquotePct: rdKap?.aktivierungsquotePct ?? null,
      }
    })(),
    tageBisEarnings: null,
    segmentStrukturKontext,
    ...capAlloc,
    sbcVsFcfPct: sbcVsFcfPctAusPaket(opts.paket),
    dsoTrendDelta: trendDeltaAusZeile(opts.paket, 'dso'),
    dioTrendDelta: trendDeltaAusZeile(opts.paket, 'dio'),
    dpoTrendDelta: trendDeltaAusZeile(opts.paket, 'dpo'),
    cccTrendDelta: trendDeltaAusZeile(opts.paket, 'ccc'),
    wcProfil: (() => {
      const hatDio = opts.paket.zeilen.some(
        (z) => z.id === 'dio' && Object.values(z.werte).some((v) => v != null && Number.isFinite(v)),
      )
      const hatDso = opts.paket.zeilen.some(
        (z) => z.id === 'dso' && Object.values(z.werte).some((v) => v != null && Number.isFinite(v)),
      )
      if (hatDio) return 'industrie'
      if (hatDso) return 'finanz'
      return null
    })(),
    aktienrueckkaufMio: letzterHistorischerWert(opts.paket, 'aktienrueckkauf'),
    aktienVerwaesserungJaehrlichPct: qualitaet.aktienVerwaesserungJaehrlichPct,
    aktienYoYPct: qualitaet.aktienYoYPct,
    fcfConversionPct: qualitaet.fcfConversionPct,
    fcfConversion3yPct: qualitaet.fcfConversion3yPct,
    nrrPct: qualitaet.nrrPct,
    ruleOf40: qualitaet.ruleOf40,
    interestCoverage: qualitaet.interestCoverage,
    kurzfristSchuldenAnteilPct: qualitaet.kurzfristSchuldenAnteilPct,
    pePerzentil5y: qualitaet.pePerzentil5y,
    pePerzentil10y: qualitaet.pePerzentil10y,
    gaapAdjEpsLueckePct: qualitaet.gaapAdjEpsLueckePct,
    cashEpsVsGaapLueckePct: qualitaet.cashEpsVsGaapLueckePct,
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
  if (z.epsWachstumFy0Pct != null) {
    teile.push(`EPS FY0 ${z.epsWachstumFy0Pct > 0 ? '+' : ''}${z.epsWachstumFy0Pct.toFixed(0)} %`)
  }
  if (z.prognoseProfil && z.prognoseProfil.anzahlJahre >= 2) {
    teile.push(`Prognose ${z.prognoseProfil.zusammenfassung}`)
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
  if (z.aktienVerwaesserungJaehrlichPct != null && z.aktienVerwaesserungJaehrlichPct > 1) {
    teile.push(`Verwässerung ${z.aktienVerwaesserungJaehrlichPct.toFixed(1)} % p.a.`)
  } else if (z.aktienYoYPct != null && z.aktienYoYPct < -1) {
    teile.push(`Shares ${z.aktienYoYPct.toFixed(1)} % YoY`)
  }
  if (z.fcfConversionPct != null) {
    teile.push(`FCF-Conv. ${z.fcfConversionPct.toFixed(0)} %`)
  }
  if (z.nrrPct != null) teile.push(`NRR ${z.nrrPct.toFixed(0)} %`)
  else if (z.ruleOf40 != null) teile.push(`Rule-of-40 ${z.ruleOf40.toFixed(0)}`)
  if (z.interestCoverage != null && z.interestCoverage < 8) {
    teile.push(`Zinsdeckung ${z.interestCoverage.toFixed(1)}×`)
  }
  if (z.kurzfristSchuldenAnteilPct != null && z.kurzfristSchuldenAnteilPct >= 25) {
    teile.push(`Kurzfrist-Debt ${z.kurzfristSchuldenAnteilPct.toFixed(0)} %`)
  }
  if (z.pePerzentil5y != null) teile.push(`KGV-Perz.5J ${z.pePerzentil5y.toFixed(0)}`)
  if (z.gaapAdjEpsLueckePct != null && z.gaapAdjEpsLueckePct >= 12) {
    teile.push(`Adj-EPS-Lücke +${z.gaapAdjEpsLueckePct.toFixed(0)} %`)
  } else if (z.cashEpsVsGaapLueckePct != null && z.cashEpsVsGaapLueckePct <= -25) {
    teile.push(`Cash-EPS unter GAAP ${z.cashEpsVsGaapLueckePct.toFixed(0)} %`)
  }
  if (z.dsoTrendDelta != null && z.dsoTrendDelta >= 8) {
    teile.push(`DSO +${z.dsoTrendDelta.toFixed(0)} Tage`)
  }
  if (z.nettoCashMio != null) teile.push(`Netto-Cash $${z.nettoCashMio} Mio.`)
  if (z.goodwillAnteilPct != null && z.goodwillAnteilPct >= 25) {
    teile.push(`Goodwill ${z.goodwillAnteilPct.toFixed(0)} % der Bilanz`)
  }
  if (z.segmentKonzentrationPct != null && z.segmentKonzentrationPct >= 50) {
    const name = z.produktTopSegmentName ? ` (${z.produktTopSegmentName})` : ''
    teile.push(`Segment-Konzentration ${z.segmentKonzentrationPct.toFixed(0)} %${name}`)
  }
  if (z.auslandsumsatzAnteilPct != null && z.auslandsumsatzAnteilPct >= 35) {
    teile.push(`Ausland ${z.auslandsumsatzAnteilPct.toFixed(0)} %`)
  } else if (z.geoTopRegionPct != null && z.geoTopRegionName) {
    teile.push(`Top-Region ${z.geoTopRegionName} ${z.geoTopRegionPct.toFixed(0)} %`)
  }
  if (z.backlogWachstumPct != null) {
    const label = z.backlogLabel ?? 'Backlog'
    teile.push(`${label} ${z.backlogWachstumPct > 0 ? '+' : ''}${z.backlogWachstumPct.toFixed(0)} % YoY`)
  }
  if (z.segmentShiftPct != null && Math.abs(z.segmentShiftPct) >= 8) {
    teile.push(`Segment-Shift ${z.segmentShiftPct > 0 ? '+' : ''}${z.segmentShiftPct.toFixed(0)} PP`)
  }
  if (z.insiderNettoRichtung && z.insiderNettoRichtung !== 'neutral') {
    teile.push(`Insider-Netto 90T: ${z.insiderNettoRichtung}`)
  }
  if (z.umsatzanteilTop1KundenPct != null) {
    const name = z.topKundenNamen?.[0] ? ` (${z.topKundenNamen[0]})` : ''
    teile.push(`Top-Kunde ${z.umsatzanteilTop1KundenPct.toFixed(0)} %${name}`)
  }
  if (z.debtRefi24mPct != null) {
    teile.push(
      `Refi≤24M ${z.debtRefi24mPct.toFixed(0)} %${
        z.debtDue24mMio != null ? ` (${z.debtDue24mMio.toLocaleString('de-DE')} Mio.)` : ''
      }`,
    )
  }
  if (z.rdAktivierungsquotePct != null) {
    teile.push(`F&E-Aktivierung ${z.rdAktivierungsquotePct.toFixed(0)} %`)
  }
  if (z.bruttoMargeStd10y != null) {
    teile.push(`Bruttomarge-Std ±${z.bruttoMargeStd10y.toFixed(1)} Pp.`)
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

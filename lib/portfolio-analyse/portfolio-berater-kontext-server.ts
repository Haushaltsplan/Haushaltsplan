/** Portfolio-KI-Berater — voller Kontext aus allen Portfolioanalyse-Quellen. */

import 'server-only'

import { ladeLivePortfolioServer, type LivePortfolioServerPaket } from '@/lib/portfolio-analyse/depot-gewichte-server'
import { sektorFuerPosition } from '@/lib/portfolio-analyse/isin-sektoren'
import { holeSektorenBatch } from '@/lib/portfolio-analyse/sektor-batch-server'
import { lookupAusSektorBatch } from '@/lib/portfolio-analyse/sektor-fundamental-client'
import {
  ladeAlleEarningsCallKiAusCloud,
  ladeAlleSecBerichtKiAusCloud,
} from '@/lib/portfolio-analyse/portfolio-ki-cache-cloud-server'
import { ladeAlleQuartalsKiDiffAusCloud } from '@/lib/portfolio-analyse/quartals-ki-diff-cache-server'
import { reichereNachkaufTickerKontext } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-kontext-server'
import {
  ladeAlleDeepResearch,
  ladeKaufempfehlungAktuell,
  ladeNachkaufScanAusCloud,
  ladeNachkaufScanDatum,
} from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-db-server'
import { berechneMonatsEmpfehlung } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-score'
import { berechneTrimSignale } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-trim-signal'
import { ladeNachkaufMarktRegime } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-markt-regime-server'
import { ladeNachkaufPerformance } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-performance-server'
import {
  ladeNachkaufKandidaten,
  ladeNachkaufWatchlistAusCloud,
  type NachkaufWatchlistEintrag,
} from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-watchlist-cloud-server'
import type { WhitelistPosition } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import type { NachkaufScanEintrag } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-types'
import {
  ladeFundamentaldatenFuerBerater,
  baueQuartalsDiffFuerBerater,
  type FundamentalBeraterZiel,
} from '@/lib/portfolio-analyse/portfolio-berater-fundamentaldaten-server'

export type PortfolioBeraterAnfrageOpts = {
  focusIsin?: string | null
  focusTicker?: string | null
  seite?: string | null
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function round0(n: number): number {
  return Math.round(n)
}

function kuerze(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return t.slice(0, max - 1).trimEnd() + '…'
}

function gewichteNachSchluessel(
  positionen: Array<{ gewicht: number; schluessel: string }>,
): Array<{ name: string; anteilPct: number }> {
  const m = new Map<string, number>()
  for (const p of positionen) {
    m.set(p.schluessel, (m.get(p.schluessel) ?? 0) + p.gewicht)
  }
  return [...m.entries()]
    .map(([name, anteilPct]) => ({ name, anteilPct: round1(anteilPct) }))
    .sort((a, b) => b.anteilPct - a.anteilPct)
}

function istRelevantTicker(ticker: string, relevant: Set<string>): boolean {
  return relevant.has(ticker.trim().toUpperCase())
}

function excerptLimit(ticker: string, focusTicker: string | null, imDepot: boolean): number {
  const t = ticker.toUpperCase()
  if (focusTicker && t === focusTicker) return 1400
  if (imDepot) return 900
  return 500
}

/**
 * Numerische Kernsignale als Objekt — niemals mid-JSON abschneiden
 * (sonst stürzt JSON.parse am Frontend mit SyntaxError ab).
 */
function datenSignaleKompakt(
  z: NonNullable<NachkaufScanEintrag['datenSignale']>,
  fokus: boolean,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    nrrPct: z.nrrPct ?? null,
    ruleOf40: z.ruleOf40 ?? null,
    shortRatio: z.shortRatio ?? null,
    shortFloatPct: z.shortFloatPct ?? null,
    pePerzentil5y: z.pePerzentil5y ?? null,
    fcfConversionPct: z.fcfConversionPct ?? null,
    aktienVerwaesserungJaehrlichPct: z.aktienVerwaesserungJaehrlichPct ?? null,
    interestCoverage: z.interestCoverage ?? null,
    gaapAdjEpsLueckePct: z.gaapAdjEpsLueckePct ?? null,
    epsBeatRate12Pct: z.epsBeatRate12Pct ?? null,
    umsatzBeatRate12Pct: z.umsatzBeatRate12Pct ?? null,
    capitalAllocationScorePct: z.capitalAllocationScorePct ?? null,
    capitalAllocationLabel: z.capitalAllocationLabel ?? null,
    netDebtEbitda: z.netDebtEbitda ?? null,
    pegRatio: z.pegRatio ?? null,
    reinvestitionsquotePct: z.reinvestitionsquotePct ?? null,
    incrementalRoicPct: z.incrementalRoicPct ?? null,
    insiderNettoRichtung: z.insiderNettoRichtung ?? null,
    debtRefi24mPct: z.debtRefi24mPct ?? null,
    rdAktivierungsquotePct: z.rdAktivierungsquotePct ?? null,
    umsatzanteilTop1KundenPct: z.umsatzanteilTop1KundenPct ?? null,
    datenVollstaendigkeitPct: z.datenVollstaendigkeitPct ?? null,
    earningsSentimentScore: z.earningsSentimentScore ?? null,
    tageBisEarnings: z.tageBisEarnings ?? null,
  }
  if (fokus) {
    out.sloanRatio = z.sloanRatio ?? null
    out.beneishMScore = z.beneishMScore ?? null
    out.beneishRisiko = z.beneishRisiko ?? null
    out.bruttoMargeStd10y = z.bruttoMargeStd10y ?? null
    out.segmentKonzentrationPct = z.segmentKonzentrationPct ?? null
    out.nettoCashMio = z.nettoCashMio ?? null
    out.goodwillAnteilPct = z.goodwillAnteilPct ?? null
    out.dsoTrendDelta = z.dsoTrendDelta ?? null
    out.dioTrendDelta = z.dioTrendDelta ?? null
    if (z.prognoseProfil?.zusammenfassung) {
      out.prognoseKurz = kuerze(z.prognoseProfil.zusammenfassung, 180)
    }
  }
  return out
}

function scanZeileVoll(
  e: NachkaufScanEintrag,
  imDepot: boolean,
  focusTicker: string | null,
  quelleByIsin: Map<string, string>,
) {
  const sd = e.scoreDetail
  const fokus = focusTicker != null && e.ticker.toUpperCase() === focusTicker
  return {
    ticker: e.ticker,
    name: e.name,
    isin: e.isin,
    quelle: quelleByIsin.get(e.isin.toUpperCase()) ?? null,
    ampel: e.ampel,
    score: e.score,
    imDepot,
    fokus,
    depotGewichtPct: e.depotGewichtPct ?? null,
    klumpenrisiko: e.klumpenrisiko,
    kiBegruendung: e.kiBegruendung ? kuerze(e.kiBegruendung, fokus ? 500 : 280) : null,
    premiumDiscountPct: e.bewertung?.premiumDiscountPct ?? null,
    drawdown52wPct: e.bewertung?.drawdown52wPct ?? null,
    forwardPe: e.bewertung?.forwardPe ?? null,
    fcfYieldPct: e.bewertung?.fcfYieldPct ?? null,
    kaufTrigger: e.kaufTriggerAusgeloest ? e.kaufTriggerText ?? 'aktiv' : null,
    sellTriggerOk: e.sellTriggerOk,
    mantraAmpel: e.mantraAmpel,
    mantraScorePct: e.mantraScorePct,
    scoreDetail: {
      mantraScore: sd.mantraScore,
      bewertungsScore: sd.bewertungsScore,
      qualitaetsRang: sd.qualitaetsRang,
      timingRang: sd.timingRang,
      kombiniertRang: sd.kombiniertRang,
      gateG1: sd.gateG1,
      gateG2: sd.gateG2,
      gateG3Teuer: sd.gateG3Teuer,
      klumpenMalus: sd.klumpenMalus,
      sektorMalus: sd.sektorMalus,
    },
    trimSignal: e.trimSignal
      ? {
          aktion: e.trimSignal.aktion,
          dringlichkeit: e.trimSignal.dringlichkeit,
          grund: kuerze(e.trimSignal.grund, fokus ? 400 : 180),
          verkaufAnteilPct: e.trimSignal.verkaufAnteilPct,
        }
      : null,
    disziplinHinweis: e.disziplinHinweis ?? null,
    insiderKaeufe: (e.insiderKaeufe ?? []).slice(0, 4).map((i) => ({
      datum: i.datum,
      wertUsd: i.wertUsd,
      name: i.name,
    })),
    scoreVerlauf: (e.scoreVerlauf ?? []).slice(-8).map((p) => ({
      datum: p.datum,
      score: p.score,
      ampel: p.ampel,
    })),
    kaufhistorie: e.kaufhistorie
      ? {
          letzterKaufAm: e.kaufhistorie.letzterKaufAm,
          anzahlKaeufe: e.kaufhistorie.anzahlKaeufe,
          tageSeitletztemKauf: e.kaufhistorie.tageSeitletztemKauf,
        }
      : null,
    notiz: e.notiz ? kuerze(e.notiz, 400) : null,
    datenSignale: e.datenSignale ? datenSignaleKompakt(e.datenSignale, fokus) : null,
    deepResearchAuszug: e.tiefenAnalyse?.memo
      ? kuerze(e.tiefenAnalyse.memo, fokus ? 2500 : imDepot ? 800 : 400)
      : null,
  }
}

async function ladeScanAngereichert(): Promise<{
  scan: NachkaufScanEintrag[]
  deepMap: Map<string, { ticker: string; isin: string; memo: string; erstellt_am: string }>
}> {
  const [scan, deepMap] = await Promise.all([ladeNachkaufScanAusCloud(), ladeAlleDeepResearch()])
  const mitDeep = scan.map((e) => ({
    ...e,
    tiefenAnalyse: deepMap.get(e.ticker.toUpperCase()) ?? null,
  }))
  try {
    await reichereNachkaufTickerKontext(mitDeep)
    berechneTrimSignale(mitDeep)
  } catch (e) {
    console.warn('[portfolio-berater] Scan-Anreicherung fehlgeschlagen:', e)
  }
  return { scan: mitDeep, deepMap }
}

async function ladePerformanceKompakt() {
  try {
    const perf = await ladeNachkaufPerformance()
    return {
      anzahlEmpfehlungen: perf.anzahlEmpfehlungen,
      avgAlpha6mPct: perf.avgAlpha6mPct,
      avgRendite6mPct: perf.avgRendite6mPct,
      trefferquote6mPct: perf.trefferquote6mPct,
      scoreBucketsSignal: perf.scoreBucketsSignal.slice(0, 6),
      letzteEmpfehlungen: perf.eintraege.slice(0, 12).map((e) => ({
        monat: e.monat,
        ticker: e.ticker,
        empfohlenBetragEur: e.empfohlenBetragEur,
        score: e.score,
        rendite6mPct: e.rendite6mPct,
        alpha6mPct: e.alpha6mPct,
      })),
    }
  } catch {
    return null
  }
}

function baueKiCacheBlock(
  earningsKi: Awaited<ReturnType<typeof ladeAlleEarningsCallKiAusCloud>>,
  secKi: Awaited<ReturnType<typeof ladeAlleSecBerichtKiAusCloud>>,
  relevanteTicker: Set<string>,
  focusTicker: string | null,
  depotTicker: Set<string>,
) {
  const earnings: Array<{
    ticker: string
    quartalId: string
    auszug: string
    sentimentScore: number | null
  }> = []
  const sec: Array<{ ticker: string; berichtId: string; auszug: string }> = []

  for (const [ticker, rows] of earningsKi) {
    if (!istRelevantTicker(ticker, relevanteTicker)) continue
    let best: {
      id: string
      z: string
      am: string
      sentimentScore: number | null
    } | null = null
    for (const [id, row] of rows) {
      if (!best || row.aktualisiertAm > best.am) {
        best = {
          id,
          z: row.zusammenfassung,
          am: row.aktualisiertAm,
          sentimentScore: row.sentimentScore ?? null,
        }
      }
    }
    if (best) {
      earnings.push({
        ticker,
        quartalId: best.id,
        auszug: kuerze(
          best.z,
          excerptLimit(ticker, focusTicker, depotTicker.has(ticker)),
        ),
        sentimentScore: best.sentimentScore,
      })
    }
  }

  for (const [ticker, rows] of secKi) {
    if (!istRelevantTicker(ticker, relevanteTicker)) continue
    let best: { id: string; z: string; am: string } | null = null
    for (const [id, row] of rows) {
      if (!best || row.aktualisiertAm > best.am) {
        best = { id, z: row.zusammenfassung, am: row.aktualisiertAm }
      }
    }
    if (best) {
      sec.push({
        ticker,
        berichtId: best.id,
        auszug: kuerze(
          best.z,
          excerptLimit(ticker, focusTicker, depotTicker.has(ticker)),
        ),
      })
    }
  }

  return {
    earnings,
    sec,
    gesamt: {
      earningsTicker: earnings.length,
      secTicker: sec.length,
      earningsInCache: earningsKi.size,
      secInCache: secKi.size,
    },
  }
}

function baueFundamentalZiele(opts: {
  depotPaket: LivePortfolioServerPaket | null
  focusIsin: string | null
  watchlist: NachkaufWatchlistEintrag[]
  kandidaten: WhitelistPosition[]
}): FundamentalBeraterZiel[] {
  const { depotPaket, focusIsin, watchlist, kandidaten } = opts
  const seen = new Set<string>()
  const out: FundamentalBeraterZiel[] = []

  const add = (z: FundamentalBeraterZiel) => {
    const key = z.isin.trim().toUpperCase()
    if (!/^[A-Z]{2}[A-Z0-9]{10}$/.test(key) || seen.has(key)) return
    seen.add(key)
    out.push({ ...z, isin: key })
  }

  if (focusIsin) {
    const k = kandidaten.find((x) => x.isin.toUpperCase() === focusIsin)
    const w = watchlist.find((x) => x.isin.toUpperCase() === focusIsin)
    const dep = depotPaket?.live.positionen.find((p) => p.isin?.toUpperCase() === focusIsin)
    const m = depotPaket?.meta.get(focusIsin)
    add({
      isin: focusIsin,
      name: k?.name ?? w?.name ?? dep?.anzeigeName ?? dep?.name ?? 'Unbekannt',
      symbolYahoo: k?.symbolYahoo ?? w?.symbolYahoo ?? m?.symbolYahoo ?? null,
      symbolCandidates: k?.symbolCandidates ?? w?.symbolCandidates,
      fokus: true,
      gewichtPct: dep?.gewichtProzent ?? null,
    })
  }

  const depotAktien = (depotPaket?.live.positionen ?? [])
    .filter((p) => p.assetKlasse === 'aktie' && p.isin && p.stueck > 0)
    .sort((a, b) => b.gewichtProzent - a.gewichtProzent)

  for (const p of depotAktien) {
    const isin = p.isin!.toUpperCase()
    const m = depotPaket!.meta.get(isin)
    const k = kandidaten.find((x) => x.isin.toUpperCase() === isin)
    add({
      isin,
      name: p.anzeigeName ?? p.name ?? k?.name ?? 'Unbekannt',
      symbolYahoo: p.symbolYahoo ?? m?.symbolYahoo ?? k?.symbolYahoo ?? null,
      symbolCandidates: k?.symbolCandidates ?? m?.symbolCandidates,
      fokus: isin === focusIsin,
      gewichtPct: p.gewichtProzent,
    })
  }

  for (const w of watchlist) {
    add({
      isin: w.isin,
      name: w.name,
      symbolYahoo: w.symbolYahoo,
      symbolCandidates: w.symbolCandidates,
      fokus: w.isin.toUpperCase() === focusIsin,
      gewichtPct: null,
    })
  }

  // Whitelist-/Scan-Kandidaten (auch ohne Depot-Position), sonst bleibt fundamentaldaten oft leer
  for (const k of kandidaten) {
    add({
      isin: k.isin,
      name: k.name,
      symbolYahoo: k.symbolYahoo ?? null,
      symbolCandidates: k.symbolCandidates,
      fokus: k.isin.toUpperCase() === focusIsin,
      gewichtPct: null,
      ticker: k.symbolYahoo?.split('.')[0] ?? null,
    })
  }

  return out
}

export async function bauePortfolioBeraterKontext(opts?: PortfolioBeraterAnfrageOpts) {
  const focusIsin = opts?.focusIsin?.trim().toUpperCase() || null
  const focusTicker = opts?.focusTicker?.trim().toUpperCase() || null

  const [
    depotPaket,
    { scan, deepMap },
    scanDatum,
    watchlist,
    kandidaten,
    earningsKi,
    secKi,
    quartalsDiffs,
    kaufempfehlung,
    marktRegime,
    performance,
  ] = await Promise.all([
    ladeLivePortfolioServer(),
    ladeScanAngereichert(),
    ladeNachkaufScanDatum(),
    ladeNachkaufWatchlistAusCloud(),
    ladeNachkaufKandidaten(),
    ladeAlleEarningsCallKiAusCloud(),
    ladeAlleSecBerichtKiAusCloud(),
    ladeAlleQuartalsKiDiffAusCloud(),
    ladeKaufempfehlungAktuell(),
    ladeNachkaufMarktRegime().catch(() => null),
    ladePerformanceKompakt(),
  ])

  const depotIsins = new Set(
    depotPaket?.live.positionen.filter((p) => p.isin).map((p) => p.isin!.toUpperCase()) ?? [],
  )

  const relevanteTicker = new Set<string>()
  if (focusTicker) relevanteTicker.add(focusTicker)
  for (const e of scan) relevanteTicker.add(e.ticker.toUpperCase())
  if (depotPaket) {
    for (const p of depotPaket.live.positionen) {
      const isin = p.isin?.toUpperCase()
      if (!isin) continue
      const m = depotPaket.meta.get(isin)
      const t = m?.symbolYahoo?.split('.')[0]?.toUpperCase()
      if (t) relevanteTicker.add(t)
    }
  }

  const depotTicker = new Set<string>()
  if (depotPaket) {
    for (const p of depotPaket.live.positionen) {
      const isin = p.isin?.toUpperCase()
      const m = isin ? depotPaket.meta.get(isin) : undefined
      const t = m?.symbolYahoo?.split('.')[0]?.toUpperCase()
      if (t) depotTicker.add(t)
    }
  }

  const kiCache = baueKiCacheBlock(earningsKi, secKi, relevanteTicker, focusTicker, depotTicker)

  const quartalsDiffRaw = await baueQuartalsDiffFuerBerater({
    bestehende: quartalsDiffs,
    secKi,
    earningsKi,
    relevanteTicker,
    focusTicker,
    maxNeuGenerieren: focusTicker ? 2 : 1,
  })
  const quartalsDiff = quartalsDiffRaw.map((d) => ({
    ticker: d.ticker,
    typ: d.typ,
    aktuellId: d.aktuellId,
    vorherId: d.vorherId,
    diff: kuerze(
      d.diff,
      focusTicker && d.ticker.toUpperCase() === focusTicker ? 1400 : 700,
    ),
  }))

  const quelleByIsin = new Map(
    kandidaten.map((k: WhitelistPosition) => [k.isin.toUpperCase(), k.quelle ?? 'whitelist']),
  )

  const deepResearchOhneScan = [...deepMap.entries()]
    .filter(([t]) => istRelevantTicker(t, relevanteTicker))
    .map(([ticker, dr]) => ({
      ticker,
      isin: dr.isin,
      auszug: kuerze(
        dr.memo,
        focusTicker && ticker === focusTicker ? 2500 : depotTicker.has(ticker) ? 800 : 400,
      ),
      erstelltAm: dr.erstellt_am,
    }))

  const scanByIsin = new Map(scan.map((e) => [e.isin.toUpperCase(), e]))
  const fundamentaldaten = await ladeFundamentaldatenFuerBerater(
    baueFundamentalZiele({ depotPaket, focusIsin, watchlist, kandidaten }),
    { scanByIsin },
  )

  if (!depotPaket) {
    return {
      stand: new Date().toISOString(),
      seite: opts?.seite ?? null,
      focus: focusIsin || focusTicker ? { isin: focusIsin, ticker: focusTicker } : null,
      depot: null,
      nachkaufRadar: {
        scanDatum,
        kandidatenAnzahl: kandidaten.length,
        scanAnzahl: scan.length,
        monatsEmpfehlung: scan.length > 0 ? berechneMonatsEmpfehlung(scan) : null,
        alleScanErgebnisse: scan.map((e) =>
          scanZeileVoll(e, depotIsins.has(e.isin.toUpperCase()), focusTicker, quelleByIsin),
        ),
      },
      watchlist: watchlist.map((w) => ({
        isin: w.isin,
        name: w.name,
        symbolYahoo: w.symbolYahoo,
      })),
      kandidatenWhitelist: kandidaten.map((k) => ({
        isin: k.isin,
        name: k.name,
        risikoKlasse: k.risikoKlasse,
        quelle: k.quelle,
      })),
      kiCache,
      quartalsDiff,
      kaufempfehlung,
      marktRegime,
      performance,
      deepResearch: deepResearchOhneScan,
      fundamentaldaten,
    }
  }

  const { live, meta } = depotPaket

  const sektorBatch = await holeSektorenBatch(
    live.positionen
      .filter((p) => p.wertLiveEur > 0)
      .slice(0, 120)
      .map((p) => {
        const isin = p.isin?.toUpperCase() ?? null
        const m = isin ? meta.get(isin) : undefined
        return {
          isin,
          symbolYahoo: m?.symbolYahoo ?? p.symbolYahoo ?? null,
          name: p.anzeigeName ?? p.name,
        }
      }),
  ).catch(() => ({} as Record<string, { sektor: string | null; branche: string | null }>))
  const sektorLookup = lookupAusSektorBatch(sektorBatch)

  const positionen = live.positionen
    .filter((p) => p.wertLiveEur > 0)
    .sort((a, b) => b.gewichtProzent - a.gewichtProzent)
    .map((p) => {
      const isin = p.isin?.toUpperCase() ?? null
      const m = isin ? meta.get(isin) : undefined
      return {
        name: p.anzeigeName ?? p.name,
        isin,
        ticker: m?.symbolYahoo?.split('.')[0]?.toUpperCase() ?? null,
        symbolYahoo: m?.symbolYahoo ?? null,
        gewichtPct: round1(p.gewichtProzent),
        wertEur: round0(p.wertLiveEur),
        gewinnVerlustEur: round0(p.gewinnVerlustEur),
        gewinnVerlustPct:
          p.gewinnVerlustProzent != null ? round1(p.gewinnVerlustProzent) : null,
        assetKlasse: p.assetKlasse,
        sektor: sektorFuerPosition(p, sektorLookup),
        stueck: round1(p.stueck),
        einstandEur: round0(p.einstandEur),
        kursLiveEur: p.kursLiveEur != null ? round1(p.kursLiveEur) : null,
        aenderungTagPct: p.aenderungTagProzent != null ? round1(p.aenderungTagProzent) : null,
        fokus: isin === focusIsin,
      }
    })

  const klumpenrisiko = positionen
    .filter((p) => p.gewichtPct >= 10)
    .map((p) => ({
      name: p.name,
      isin: p.isin,
      ticker: p.ticker,
      gewichtPct: p.gewichtPct,
      schwere: p.gewichtPct >= 15 ? 'hoch' : ('mittel' as const),
    }))

  const kz = live.kennzahlen
  const investiert = kz.einstandOffenEur
  const gv = kz.depotwertEur - investiert
  const gvPct = investiert > 0 ? (gv / investiert) * 100 : null

  return {
    stand: new Date().toISOString(),
    seite: opts?.seite ?? null,
    focus: focusIsin || focusTicker ? { isin: focusIsin, ticker: focusTicker } : null,
    depot: {
      wertEur: round0(kz.depotwertEur),
      investiertEur: round0(investiert),
      gewinnVerlustEur: round0(gv),
      gewinnVerlustPct: gvPct != null ? round1(gvPct) : null,
      dividendenEur: round0(kz.dividendenEur ?? 0),
      cashEur: round0(kz.cashEur ?? 0),
      positionenAnzahl: positionen.length,
      kurseQuelle: kz.kurseQuelle,
      kurseStand: kz.kurseStand,
      verlaufMonate: live.verlauf.slice(-18).map((v) => ({
        monat: v.monat,
        wertEur: round0(v.wert),
      })),
      positionen,
      klumpenrisiko,
      sektorGewichte: gewichteNachSchluessel(
        positionen.map((p) => ({ gewicht: p.gewichtPct, schluessel: p.sektor })),
      ),
      assetKlassen: gewichteNachSchluessel(
        positionen.map((p) => ({ gewicht: p.gewichtPct, schluessel: p.assetKlasse })),
      ),
    },
    nachkaufRadar: {
      scanDatum,
      kandidatenAnzahl: kandidaten.length,
      scanAnzahl: scan.length,
      monatsEmpfehlung: scan.length > 0 ? berechneMonatsEmpfehlung(scan) : null,
      alleScanErgebnisse: scan.map((e) =>
        scanZeileVoll(e, depotIsins.has(e.isin.toUpperCase()), focusTicker, quelleByIsin),
      ),
    },
    watchlist: watchlist.map((w) => ({
      isin: w.isin,
      name: w.name,
      symbolYahoo: w.symbolYahoo,
    })),
    kandidatenWhitelist: kandidaten.map((k) => ({
      isin: k.isin,
      name: k.name,
      risikoKlasse: k.risikoKlasse,
      quelle: k.quelle,
    })),
    kiCache,
    quartalsDiff,
    kaufempfehlung: kaufempfehlung
      ? {
          monat: kaufempfehlung.monat,
          kiText: kaufempfehlung.kiText,
          kandidaten: kaufempfehlung.kandidaten,
          basisAllokation: kaufempfehlung.basisAllokation,
          verkaufAllokation: kaufempfehlung.verkaufAllokation,
        }
      : null,
    marktRegime,
    performance,
    deepResearch: deepResearchOhneScan,
    fundamentaldaten,
  }
}

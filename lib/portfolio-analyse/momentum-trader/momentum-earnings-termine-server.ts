import 'server-only'

import { addDaysIso, heuteIsoUtc, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  alleDivvydiaryEarningsImZeitraum,
  ladeDivvydiaryAktienSeiteHtml,
  naechstesEarningsTerminAusHtml,
  type DivvydiaryEarningsTerminKurz,
} from '@/lib/portfolio-analyse/divvydiary-scraper-server'
import type { Berichtszeit } from '@/lib/portfolio-analyse/earnings-berichtszeit'
import type { EarningsTerminQuelle } from '@/lib/portfolio-analyse/earnings-termine'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import {
  ladeMarketbeatEarningsKalender,
  type MarketbeatKalenderEintrag,
} from '@/lib/portfolio-analyse/marketbeat-beat-miss-historie-server'
import {
  ladeYahooEarningsKalenderImZeitraum,
  type YahooEarningsKalenderTermin,
} from '@/lib/portfolio-analyse/yahoo-earnings-schaetzungen-server'
import { ladeWallstreetEarningsTermine } from '@/lib/portfolio-analyse/wallstreet-earnings-termine-server'
import type {
  MomentumEarningsZeit,
  MomentumWatchlistEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

export const MOMENTUM_EARNINGS_HORIZONT_TAGE = 400

export type MomentumEarningsTerminAngereichert = {
  terminDatumIso: string
  berichtszeit: Berichtszeit | null
  timeBmoAmc: MomentumEarningsZeit
  quelle: EarningsTerminQuelle | 'merged' | 'wallstreet' | 'marketbeat'
  bestaetigt: boolean
}

function berichtszeitZuMomentumZeit(zeit: Berichtszeit | null): MomentumEarningsZeit {
  if (zeit === 'vor_boersenoeffnung') return 'bmo'
  if (zeit === 'nach_handelsschluss') return 'amc'
  return 'unknown'
}

function primaeresSymbol(e: MomentumWatchlistEintrag): string | null {
  return e.symbolYahoo?.trim().toUpperCase() || e.symbolCandidates[0]?.trim().toUpperCase() || null
}

function symbolKandidaten(e: MomentumWatchlistEintrag): string[] {
  const sym = primaeresSymbol(e)
  if (!sym) return []
  const out = [sym, ...e.symbolCandidates.map((s) => s.trim().toUpperCase())]
  return [...new Set(out.filter(Boolean))]
}

async function ladeDivvydiaryTermineImZeitraum(
  isin: string,
  name: string,
  vonIso: string,
  bisIso: string,
): Promise<DivvydiaryEarningsTerminKurz[]> {
  const isinNorm = isin.trim().toUpperCase()
  const anzeigeName = isinKenntnis(isinNorm)?.name ?? name
  const html = await ladeDivvydiaryAktienSeiteHtml(isinNorm, anzeigeName)
  if (!html) return []

  const alle = alleDivvydiaryEarningsImZeitraum(html, isinNorm, vonIso, bisIso)
  if (alle.length > 0) return alle

  const heute = heuteIsoUtc()
  if (bisIso >= heute) {
    return naechstesEarningsTerminAusHtml(html, isinNorm, heute, bisIso)
  }
  return []
}

function yahooFuerDatum(kalender: YahooEarningsKalenderTermin[], datum: string): YahooEarningsKalenderTermin | null {
  const exakt = kalender.find((t) => t.terminDatumIso === datum)
  if (exakt) return exakt
  return kalender.find((t) => Math.abs(tageZwischenIso(t.terminDatumIso, datum)) <= 2) ?? null
}

function marketbeatFuerDatum(kalender: MarketbeatKalenderEintrag[], datum: string): MarketbeatKalenderEintrag | null {
  const exakt = kalender.find((t) => t.terminDatumIso === datum)
  if (exakt) return exakt
  return kalender.find((t) => Math.abs(tageZwischenIso(t.terminDatumIso, datum)) <= 2) ?? null
}

function mergeTermine(
  dd: DivvydiaryEarningsTerminKurz[],
  yahoo: YahooEarningsKalenderTermin[],
  wallstreet: string[],
  marketbeat: MarketbeatKalenderEintrag[],
): MomentumEarningsTerminAngereichert[] {
  const daten = new Set<string>()
  for (const t of dd) daten.add(t.terminDatumIso)
  for (const t of yahoo) daten.add(t.terminDatumIso)
  for (const d of wallstreet) daten.add(d)
  for (const t of marketbeat) daten.add(t.terminDatumIso)

  const ddMap = new Map(dd.map((t) => [t.terminDatumIso, t]))
  const wsSet = new Set(wallstreet)
  const out: MomentumEarningsTerminAngereichert[] = []

  for (const datum of [...daten].sort()) {
    const ddHit = ddMap.get(datum)
    const yhHit = yahooFuerDatum(yahoo, datum)
    const mbHit = marketbeatFuerDatum(marketbeat, datum)
    const wsHit = wsSet.has(datum)

    const berichtszeit = yhHit?.berichtszeit ?? mbHit?.berichtszeit ?? null

    let quelle: MomentumEarningsTerminAngereichert['quelle'] = 'merged'
    if (ddHit) quelle = ddHit.bestaetigt ? 'divvydiary' : 'divvydiary-prognose'
    else if (mbHit) quelle = 'marketbeat'
    else if (yhHit) quelle = 'yahoo'
    else if (wsHit) quelle = 'wallstreet'

    out.push({
      terminDatumIso: datum,
      berichtszeit,
      timeBmoAmc: berichtszeitZuMomentumZeit(berichtszeit),
      quelle,
      bestaetigt: Boolean(ddHit?.bestaetigt ?? yhHit?.bestaetigt ?? mbHit ?? wsHit),
    })
  }

  return out
}

/**
 * Earnings-Termine — DivvyDiary + MarketBeat + Yahoo + Wallstreet (100 % Scraper).
 */
export async function ladeMomentumEarningsTermineFuerTitel(
  eintrag: MomentumWatchlistEintrag,
  vonIso?: string,
  bisIso?: string,
): Promise<MomentumEarningsTerminAngereichert[]> {
  const heute = heuteIsoUtc()
  const von = vonIso ?? heute
  const bis = bisIso ?? addDaysIso(heute, MOMENTUM_EARNINGS_HORIZONT_TAGE)
  const sym = primaeresSymbol(eintrag)
  const symbole = symbolKandidaten(eintrag)
  if (!sym) return []

  const name = isinKenntnis(eintrag.isin)?.name ?? eintrag.name

  const [dd, yahoo, ws, mb] = await Promise.all([
    ladeDivvydiaryTermineImZeitraum(eintrag.isin, name, von, bis),
    symbole.length > 0
      ? ladeYahooEarningsKalenderImZeitraum(symbole, von, bis).catch(() => [] as YahooEarningsKalenderTermin[])
      : Promise.resolve([] as YahooEarningsKalenderTermin[]),
    ladeWallstreetEarningsTermine(eintrag.isin, name, von, bis).catch(() => []),
    ladeMarketbeatEarningsKalender({
      ticker: sym,
      symbolYahoo: eintrag.symbolYahoo,
      vonIso: von,
      bisIso: bis,
    }).catch(() => [] as MarketbeatKalenderEintrag[]),
  ])

  return mergeTermine(dd, yahoo, ws.map((t) => t.terminDatumIso), mb)
}

/** BMO/AMC: Yahoo → MarketBeat → unknown (Auto-Erkennung aus Bars). */
export async function ladeBerichtszeitFuerEarningsDatum(
  symbol: string,
  earningsDate: string,
  symbolYahoo?: string | null,
): Promise<MomentumEarningsZeit> {
  const von = addDaysIso(earningsDate, -5)
  const bis = addDaysIso(earningsDate, 5)
  try {
    const yahoo = await ladeYahooEarningsKalenderImZeitraum([symbol], von, bis)
    const yh = yahooFuerDatum(yahoo, earningsDate)
    if (yh?.berichtszeit) return berichtszeitZuMomentumZeit(yh.berichtszeit)
  } catch {
    /* optional */
  }
  try {
    const mb = await ladeMarketbeatEarningsKalender({
      ticker: symbol,
      symbolYahoo,
      vonIso: von,
      bisIso: bis,
    })
    const hit = marketbeatFuerDatum(mb, earningsDate)
    if (hit?.berichtszeit) return berichtszeitZuMomentumZeit(hit.berichtszeit)
  } catch {
    /* optional */
  }
  return 'unknown'
}

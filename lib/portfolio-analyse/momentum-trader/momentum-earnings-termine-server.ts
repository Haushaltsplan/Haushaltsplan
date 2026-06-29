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
  ladeYahooEarningsKalenderImZeitraum,
  type YahooEarningsKalenderTermin,
} from '@/lib/portfolio-analyse/yahoo-earnings-schaetzungen-server'
import { ladeWallstreetEarningsTermine } from '@/lib/portfolio-analyse/wallstreet-earnings-termine-server'
import type {
  MomentumEarningsZeit,
  MomentumWatchlistEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

/** Horizont für Earnings-Sync (Kalender + Vorlauf-Playbook). */
export const MOMENTUM_EARNINGS_HORIZONT_TAGE = 400

export type MomentumEarningsTerminAngereichert = {
  terminDatumIso: string
  berichtszeit: Berichtszeit | null
  timeBmoAmc: MomentumEarningsZeit
  quelle: EarningsTerminQuelle | 'merged' | 'wallstreet'
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

function mergeTermine(
  dd: DivvydiaryEarningsTerminKurz[],
  yahoo: YahooEarningsKalenderTermin[],
  wallstreet: string[],
): MomentumEarningsTerminAngereichert[] {
  const daten = new Set<string>()
  for (const t of dd) daten.add(t.terminDatumIso)
  for (const t of yahoo) daten.add(t.terminDatumIso)
  for (const d of wallstreet) daten.add(d)

  const ddMap = new Map(dd.map((t) => [t.terminDatumIso, t]))
  const wsSet = new Set(wallstreet)
  const out: MomentumEarningsTerminAngereichert[] = []

  for (const datum of [...daten].sort()) {
    const ddHit = ddMap.get(datum)
    const yhHit = yahooFuerDatum(yahoo, datum)
    const wsHit = wsSet.has(datum)
    const berichtszeit = yhHit?.berichtszeit ?? null

    let quelle: EarningsTerminQuelle | 'merged' | 'wallstreet' = 'merged'
    if (ddHit) quelle = ddHit.bestaetigt ? 'divvydiary' : 'divvydiary-prognose'
    else if (yhHit) quelle = 'yahoo'
    else if (wsHit) quelle = 'wallstreet'

    out.push({
      terminDatumIso: datum,
      berichtszeit,
      timeBmoAmc: berichtszeitZuMomentumZeit(berichtszeit),
      quelle,
      bestaetigt: Boolean(ddHit?.bestaetigt ?? yhHit?.bestaetigt ?? wsHit),
    })
  }

  return out
}

/**
 * Earnings-Termine — DivvyDiary + Yahoo + Wallstreet (alle Scraper, kein Finnhub).
 */
export async function ladeMomentumEarningsTermineFuerTitel(
  eintrag: MomentumWatchlistEintrag,
  vonIso?: string,
  bisIso?: string,
): Promise<MomentumEarningsTerminAngereichert[]> {
  const heute = heuteIsoUtc()
  const von = vonIso ?? heute
  const bis = bisIso ?? addDaysIso(heute, MOMENTUM_EARNINGS_HORIZONT_TAGE)
  const symbole = symbolKandidaten(eintrag)
  if (!primaeresSymbol(eintrag)) return []

  const name = isinKenntnis(eintrag.isin)?.name ?? eintrag.name

  const [dd, yahoo, ws] = await Promise.all([
    ladeDivvydiaryTermineImZeitraum(eintrag.isin, name, von, bis),
    symbole.length > 0
      ? ladeYahooEarningsKalenderImZeitraum(symbole, von, bis).catch(() => [] as YahooEarningsKalenderTermin[])
      : Promise.resolve([] as YahooEarningsKalenderTermin[]),
    ladeWallstreetEarningsTermine(eintrag.isin, name, von, bis).catch(() => []),
  ])

  const wsDaten = ws.map((t) => t.terminDatumIso)
  return mergeTermine(dd, yahoo, wsDaten)
}

/** BMO/AMC aus Yahoo calendarEvents; sonst unknown → Auto-Erkennung aus Bars. */
export async function ladeBerichtszeitFuerEarningsDatum(
  symbol: string,
  earningsDate: string,
): Promise<MomentumEarningsZeit> {
  const von = addDaysIso(earningsDate, -5)
  const bis = addDaysIso(earningsDate, 5)
  try {
    const yahoo = await ladeYahooEarningsKalenderImZeitraum([symbol], von, bis)
    const hit = yahooFuerDatum(yahoo, earningsDate)
    if (hit?.berichtszeit) return berichtszeitZuMomentumZeit(hit.berichtszeit)
  } catch {
    /* optional */
  }
  return 'unknown'
}

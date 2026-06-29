import 'server-only'

import { addDaysIso, heuteIsoUtc, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  alleDivvydiaryEarningsImZeitraum,
  ladeDivvydiaryAktienSeiteHtml,
  naechstesEarningsTerminAusHtml,
  type DivvydiaryEarningsTerminKurz,
} from '@/lib/portfolio-analyse/divvydiary-scraper-server'
import {
  berichtszeitAusKalenderListe,
  type Berichtszeit,
} from '@/lib/portfolio-analyse/earnings-berichtszeit'
import type { EarningsTerminQuelle } from '@/lib/portfolio-analyse/earnings-termine'
import {
  ladeFinnhubEarningsKalenderImZeitraum,
  type FinnhubEarningsKalenderTermin,
} from '@/lib/portfolio-analyse/finnhub-earnings-kalender-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { ladeYahooEarningsKalenderTerminKandidaten } from '@/lib/portfolio-analyse/yahoo-earnings-schaetzungen-server'
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
  quelle: EarningsTerminQuelle | 'merged'
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

/** DivvyDiary: alle Termine im Zeitraum (nicht nur „nächstes Quartal“). */
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

function finnhubFuerDatum(
  kalender: FinnhubEarningsKalenderTermin[],
  datum: string,
): FinnhubEarningsKalenderTermin | null {
  const exakt = kalender.find((t) => t.terminDatumIso === datum)
  if (exakt) return exakt
  return kalender.find((t) => Math.abs(tageZwischenIso(t.terminDatumIso, datum)) <= 2) ?? null
}

function mergeTermine(
  dd: DivvydiaryEarningsTerminKurz[],
  fh: FinnhubEarningsKalenderTermin[],
  yahooDatum: string | null,
  yahooBerichtszeit: Berichtszeit | null,
): MomentumEarningsTerminAngereichert[] {
  const daten = new Set<string>()
  for (const t of dd) daten.add(t.terminDatumIso)
  for (const t of fh) daten.add(t.terminDatumIso)

  const ddMap = new Map(dd.map((t) => [t.terminDatumIso, t]))
  const out: MomentumEarningsTerminAngereichert[] = []

  for (const datum of [...daten].sort()) {
    const ddHit = ddMap.get(datum)
    const fhHit = finnhubFuerDatum(fh, datum)
    const berichtszeit =
      fhHit?.berichtszeit ??
      berichtszeitAusKalenderListe(fh, datum) ??
      (yahooDatum === datum ? yahooBerichtszeit : null) ??
      null

    const quelle: EarningsTerminQuelle | 'merged' = ddHit
      ? ddHit.bestaetigt
        ? 'divvydiary'
        : 'divvydiary-prognose'
      : fhHit
        ? 'finnhub'
        : yahooDatum === datum
          ? 'yahoo'
          : 'merged'

    out.push({
      terminDatumIso: datum,
      berichtszeit,
      timeBmoAmc: berichtszeitZuMomentumZeit(berichtszeit),
      quelle,
      bestaetigt: Boolean(ddHit?.bestaetigt ?? fhHit ?? yahooDatum === datum),
    })
  }

  return out
}

/**
 * Earnings-Termine für einen Watchlist-Titel — DivvyDiary + Finnhub + Yahoo.
 * Liefert alle Termine im Zeitraum inkl. BMO/AMC.
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
  const symbol = primaeresSymbol(eintrag)
  if (!symbol) return []

  const name = isinKenntnis(eintrag.isin)?.name ?? eintrag.name

  const [dd, fh, yahoo] = await Promise.all([
    ladeDivvydiaryTermineImZeitraum(eintrag.isin, name, von, bis),
    symbole.length > 0
      ? ladeFinnhubEarningsKalenderImZeitraum(symbol, von, bis).catch(() => [] as FinnhubEarningsKalenderTermin[])
      : Promise.resolve([] as FinnhubEarningsKalenderTermin[]),
    symbole.length > 0
      ? ladeYahooEarningsKalenderTerminKandidaten(symbole).catch(() => null)
      : Promise.resolve(null),
  ])

  return mergeTermine(
    dd,
    fh,
    yahoo?.terminDatumIso ?? null,
    yahoo?.berichtszeit ?? null,
  )
}

/** BMO/AMC für ein vergangenes Earnings-Datum (aus Finnhub-Kalender). */
export async function ladeBerichtszeitFuerEarningsDatum(
  symbol: string,
  earningsDate: string,
): Promise<MomentumEarningsZeit> {
  const von = addDaysIso(earningsDate, -5)
  const bis = addDaysIso(earningsDate, 5)
  try {
    const fh = await ladeFinnhubEarningsKalenderImZeitraum(symbol, von, bis)
    const hit = finnhubFuerDatum(fh, earningsDate)
    if (hit?.berichtszeit) return berichtszeitZuMomentumZeit(hit.berichtszeit)
  } catch {
    /* optional */
  }
  return 'unknown'
}

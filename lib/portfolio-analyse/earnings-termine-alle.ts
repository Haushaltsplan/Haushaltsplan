import { berichtszeitAusKalenderListe } from '@/lib/portfolio-analyse/earnings-berichtszeit'
import { tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { heuteIsoUtc, isoInJahren, isoVorJahren } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import type { DivvydiaryEarningsRoh } from '@/lib/portfolio-analyse/divvydiary-scraper-server'
import {
  mergeEarningsTerminKandidaten,
  type EarningsTerminKandidat,
  type EarningsTerminQuelle,
} from '@/lib/portfolio-analyse/earnings-termine'
import {
  finnhubSymbole,
  ladeFinnhubEarningsKalenderImZeitraum,
  type FinnhubEarningsKalenderTermin,
} from '@/lib/portfolio-analyse/finnhub-earnings-kalender-server'
import { ladeYahooEarningsKalenderTerminKandidaten } from '@/lib/portfolio-analyse/yahoo-earnings-schaetzungen-server'

export const EARNINGS_ZEITRAUM_JAHRE_ZURUECK = 1
export const EARNINGS_ZEITRAUM_JAHRE_VORAUS = 1

const FINNHUB_PAUSE_MS = 90

export function earningsZeitraum(): { von: string; bis: string; heute: string } {
  const heute = heuteIsoUtc()
  return {
    heute,
    von: isoVorJahren(EARNINGS_ZEITRAUM_JAHRE_ZURUECK),
    bis: isoInJahren(EARNINGS_ZEITRAUM_JAHRE_VORAUS),
  }
}

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function finnhubQuartalKey(t: FinnhubEarningsKalenderTermin): string {
  if (t.jahr != null && t.quartal != null && t.quartal >= 1 && t.quartal <= 4) {
    return `${t.jahr}-Q${t.quartal}`
  }
  return `d:${t.terminDatumIso}`
}

function pickFinnhubInGroup(
  rows: FinnhubEarningsKalenderTermin[],
  anchorDatum: string | null,
): FinnhubEarningsKalenderTermin {
  const mitZeit = rows.filter((r) => r.berichtszeit != null)
  const pool = mitZeit.length > 0 ? mitZeit : rows
  if (anchorDatum) {
    let best = pool[0]
    let bestDiff = Math.abs(tageZwischenIso(best.terminDatumIso, anchorDatum))
    for (const r of pool) {
      const d = Math.abs(tageZwischenIso(r.terminDatumIso, anchorDatum))
      if (d < bestDiff) {
        best = r
        bestDiff = d
      }
    }
    if (bestDiff <= 14) return best
  }
  return [...pool].sort((a, b) => a.terminDatumIso.localeCompare(b.terminDatumIso))[0]
}

function finnhubZuKandidat(t: FinnhubEarningsKalenderTermin): EarningsTerminKandidat {
  return {
    terminDatumIso: t.terminDatumIso,
    bestaetigt: true,
    quelle: 'finnhub',
    berichtszeit: t.berichtszeit,
  }
}

function kandidatAusYahooHit(
  hit: { terminDatumIso: string; bestaetigt: boolean; berichtszeit: EarningsTerminKandidat['berichtszeit'] } | null,
  vonIso: string,
  bisIso: string,
): EarningsTerminKandidat | null {
  if (!hit || hit.terminDatumIso < vonIso || hit.terminDatumIso > bisIso) return null
  return {
    terminDatumIso: hit.terminDatumIso,
    bestaetigt: hit.bestaetigt,
    quelle: 'yahoo',
    berichtszeit: hit.berichtszeit,
  }
}

function kandidatAusDivvydiaryRoh(
  roh: DivvydiaryEarningsRoh | null,
  vonIso: string,
  bisIso: string,
): EarningsTerminKandidat | null {
  if (!roh) return null
  if (roh.earningsDate < vonIso || roh.earningsDate > bisIso) return null
  return {
    terminDatumIso: roh.earningsDate,
    bestaetigt: !roh.earningsDateEstimated,
    quelle: roh.earningsDateEstimated ? 'divvydiary-prognose' : 'divvydiary',
    berichtszeit: null,
  }
}

function termineAusFinnhubQuartalen(
  finnhubKalender: FinnhubEarningsKalenderTermin[],
  anchorDatum: string | null,
): EarningsTerminKandidat[] {
  const gruppen = new Map<string, FinnhubEarningsKalenderTermin[]>()
  for (const t of finnhubKalender) {
    const key = finnhubQuartalKey(t)
    const list = gruppen.get(key) ?? []
    list.push(t)
    gruppen.set(key, list)
  }
  const out: EarningsTerminKandidat[] = []
  for (const rows of gruppen.values()) {
    out.push(finnhubZuKandidat(pickFinnhubInGroup(rows, anchorDatum)))
  }
  return out.sort((a, b) => a.terminDatumIso.localeCompare(b.terminDatumIso))
}

function primaerQuartalKey(
  primaer: EarningsTerminKandidat,
  finnhubKalender: FinnhubEarningsKalenderTermin[],
): string | null {
  let best: { key: string; diff: number } | null = null
  for (const t of finnhubKalender) {
    const diff = Math.abs(tageZwischenIso(t.terminDatumIso, primaer.terminDatumIso))
    if (diff > 21) continue
    const key = finnhubQuartalKey(t)
    if (!best || diff < best.diff) best = { key, diff }
  }
  return best?.key ?? null
}

function ersetzePrimaerInListe(
  termine: EarningsTerminKandidat[],
  primaer: EarningsTerminKandidat,
  finnhubKalender: FinnhubEarningsKalenderTermin[],
): EarningsTerminKandidat[] {
  const qKey = primaerQuartalKey(primaer, finnhubKalender)
  const byDate = new Map<string, EarningsTerminKandidat>()
  for (const t of termine) {
    if (qKey) {
      const fh = finnhubKalender.find(
        (f) =>
          f.terminDatumIso === t.terminDatumIso &&
          finnhubQuartalKey(f) === qKey,
      )
      if (fh) continue
    }
    byDate.set(t.terminDatumIso, t)
  }
  byDate.set(primaer.terminDatumIso, {
    ...primaer,
    berichtszeit:
      primaer.berichtszeit ??
      berichtszeitAusKalenderListe(finnhubKalender, primaer.terminDatumIso) ??
      null,
  })
  return [...byDate.values()].sort((a, b) => a.terminDatumIso.localeCompare(b.terminDatumIso))
}

export async function ladeFinnhubTermineUnion(
  symbole: string[],
  vonIso: string,
  bisIso: string,
  cache: Map<string, FinnhubEarningsKalenderTermin[]>,
): Promise<FinnhubEarningsKalenderTermin[]> {
  const byDate = new Map<string, FinnhubEarningsKalenderTermin>()
  const uniq = [...new Set(symbole.flatMap((s) => finnhubSymbole(s)).filter(Boolean))]

  for (const sym of uniq) {
    let termine = cache.get(sym)
    if (!termine) {
      termine = await ladeFinnhubEarningsKalenderImZeitraum(sym, vonIso, bisIso)
      cache.set(sym, termine)
      if (FINNHUB_PAUSE_MS > 0) await pause(FINNHUB_PAUSE_MS)
    }
    for (const t of termine) {
      const prev = byDate.get(t.terminDatumIso)
      if (!prev || (!prev.berichtszeit && t.berichtszeit)) {
        byDate.set(t.terminDatumIso, t)
      }
    }
  }

  return [...byDate.values()].sort((a, b) => a.terminDatumIso.localeCompare(b.terminDatumIso))
}

/**
 * Alle Termine im Zeitraum — pro Geschäftsquartal ein Datum, Haupttermin via Yahoo/DD/Finnhub-Merge.
 */
export async function ladeAlleEarningsTermineFuerSymbole(
  symbole: string[],
  divvydiaryRoh: DivvydiaryEarningsRoh | null,
  _isinNorm: string,
  von?: string,
  bis?: string,
  finnhubCache?: Map<string, FinnhubEarningsKalenderTermin[]>,
): Promise<EarningsTerminKandidat[]> {
  const zr = earningsZeitraum()
  const vonIso = von ?? zr.von
  const bisIso = bis ?? zr.bis
  const cache = finnhubCache ?? new Map<string, FinnhubEarningsKalenderTermin[]>()

  const [yahooHit, finnhubKalender] = await Promise.all([
    symbole.length > 0 ? ladeYahooEarningsKalenderTerminKandidaten(symbole) : null,
    ladeFinnhubTermineUnion(symbole, vonIso, bisIso, cache),
  ])

  const yahooK = kandidatAusYahooHit(yahooHit, vonIso, bisIso)
  const ddK = kandidatAusDivvydiaryRoh(divvydiaryRoh, vonIso, bisIso)
  const anchor = yahooK?.terminDatumIso ?? ddK?.terminDatumIso ?? null

  let termine = termineAusFinnhubQuartalen(finnhubKalender, anchor)

  const fhAnker =
    finnhubKalender.length > 0
      ? finnhubZuKandidat(pickFinnhubInGroup(finnhubKalender, anchor))
      : null

  const primaer = mergeEarningsTerminKandidaten(
    [yahooK, ddK, fhAnker].filter((k): k is EarningsTerminKandidat => k != null),
    finnhubKalender,
  )

  if (primaer && primaer.terminDatumIso >= vonIso && primaer.terminDatumIso <= bisIso) {
    termine = ersetzePrimaerInListe(termine, primaer, finnhubKalender)
  }

  if (termine.length === 0 && ddK) {
    termine = [ddK]
  }

  return termine
}

export type { DivvydiaryEarningsRoh, EarningsTerminQuelle }

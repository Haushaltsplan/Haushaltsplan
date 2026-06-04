import { berichtszeitAusKalenderListe } from '@/lib/portfolio-analyse/earnings-berichtszeit'
import { addDaysIso, heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import type { DivvydiaryEarningsRoh } from '@/lib/portfolio-analyse/divvydiary-scraper-server'
import {
  fiskalQuartalSchluessel,
  vorherigesFiskalQuartal,
} from '@/lib/portfolio-analyse/earnings-quartal-termin'
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
import { ladeWallstreetEarningsTermine } from '@/lib/portfolio-analyse/wallstreet-earnings-termine-server'
import { ladeYahooEarningsKalenderTerminKandidaten } from '@/lib/portfolio-analyse/yahoo-earnings-schaetzungen-server'

const FINNHUB_PAUSE_MS = 90
const MAX_TERMINE_PRO_AKTIE = 3

const QUELLE_RANG: Record<EarningsTerminQuelle, number> = {
  yahoo: 5,
  divvydiary: 4,
  wallstreet: 3,
  finnhub: 2,
  'divvydiary-prognose': 1,
}

export function earningsZeitraum(): { von: string; bis: string; heute: string } {
  const heute = heuteIsoUtc()
  return {
    heute,
    von: addDaysIso(heute, -150),
    bis: addDaysIso(heute, 280),
  }
}

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function finnhubZuKandidat(t: FinnhubEarningsKalenderTermin, quelle: EarningsTerminQuelle = 'finnhub'): EarningsTerminKandidat {
  return {
    terminDatumIso: t.terminDatumIso,
    bestaetigt: quelle !== 'divvydiary-prognose',
    quelle,
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

function pickFinnhubInGroup(
  rows: FinnhubEarningsKalenderTermin[],
  anchorDatum: string | null,
): FinnhubEarningsKalenderTermin {
  const mitZeit = rows.filter((r) => r.berichtszeit != null)
  const pool = mitZeit.length > 0 ? mitZeit : rows
  if (anchorDatum) {
    let best = pool[0]
    let bestDiff = Math.abs(
      (Date.parse(best.terminDatumIso) - Date.parse(anchorDatum)) / 86400000,
    )
    for (const r of pool) {
      const d = Math.abs((Date.parse(r.terminDatumIso) - Date.parse(anchorDatum)) / 86400000)
      if (d < bestDiff) {
        best = r
        bestDiff = d
      }
    }
    if (bestDiff <= 14) return best
  }
  return [...pool].sort((a, b) => a.terminDatumIso.localeCompare(b.terminDatumIso))[0]
}

function gruppiereFinnhubNachQuartal(
  termine: FinnhubEarningsKalenderTermin[],
): Map<string, FinnhubEarningsKalenderTermin[]> {
  const map = new Map<string, FinnhubEarningsKalenderTermin[]>()
  for (const t of termine) {
    const key = fiskalQuartalSchluessel(t.terminDatumIso, t.jahr, t.quartal)
    const list = map.get(key) ?? []
    list.push(t)
    map.set(key, list)
  }
  return map
}

export function dedupeEinTerminProQuartal(
  termine: EarningsTerminKandidat[],
  finnhubKalender: FinnhubEarningsKalenderTermin[],
): EarningsTerminKandidat[] {
  const fhByDate = new Map(finnhubKalender.map((t) => [t.terminDatumIso, t]))
  const map = new Map<string, EarningsTerminKandidat>()

  for (const t of termine) {
    const fh = fhByDate.get(t.terminDatumIso)
    const key = fiskalQuartalSchluessel(t.terminDatumIso, fh?.jahr, fh?.quartal)
    const prev = map.get(key)
    if (!prev) {
      map.set(key, t)
      continue
    }
    const rangNeu = QUELLE_RANG[t.quelle] ?? 0
    const rangAlt = QUELLE_RANG[prev.quelle] ?? 0
    if (rangNeu > rangAlt) {
      map.set(key, t)
      continue
    }
    if (rangNeu === rangAlt && t.berichtszeit && !prev.berichtszeit) {
      map.set(key, t)
    }
  }

  return [...map.values()].sort((a, b) => a.terminDatumIso.localeCompare(b.terminDatumIso))
}

function finnhubFokusTermine(
  finnhubKalender: FinnhubEarningsKalenderTermin[],
  heute: string,
  anchorDatum: string | null,
): FinnhubEarningsKalenderTermin[] {
  const gruppen = gruppiereFinnhubNachQuartal(finnhubKalender)
  const vorher = vorherigesFiskalQuartal(heute)
  const out: FinnhubEarningsKalenderTermin[] = []

  const pastKeys = [...gruppen.keys()]
    .filter((k) => {
      const rows = gruppen.get(k)!
      return rows.every((r) => r.terminDatumIso < heute)
    })
    .sort()

  if (pastKeys.length > 0) {
    const lastPast = pastKeys[pastKeys.length - 1]
    if (lastPast === vorher.key || pastKeys.length === 1) {
      out.push(pickFinnhubInGroup(gruppen.get(lastPast)!, anchorDatum))
    } else {
      const vorherRows = gruppen.get(vorher.key)
      if (vorherRows) {
        out.push(pickFinnhubInGroup(vorherRows, anchorDatum))
      } else {
        out.push(pickFinnhubInGroup(gruppen.get(lastPast)!, anchorDatum))
      }
    }
  }

  const futureKeys = [...gruppen.keys()]
    .filter((k) => gruppen.get(k)!.some((r) => r.terminDatumIso >= heute))
    .sort()
    .slice(0, 2)

  for (const k of futureKeys) {
    out.push(pickFinnhubInGroup(gruppen.get(k)!, anchorDatum))
  }

  return out
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
 * Vorheriges Quartal + nächste Quartale — genau ein Termin pro Fiskalquartal, Datum via Yahoo/DD/WSO.
 */
export async function ladeAlleEarningsTermineFuerSymbole(
  symbole: string[],
  divvydiaryRoh: DivvydiaryEarningsRoh | null,
  isinNorm: string,
  name: string,
  von?: string,
  bis?: string,
  finnhubCache?: Map<string, FinnhubEarningsKalenderTermin[]>,
): Promise<EarningsTerminKandidat[]> {
  const zr = earningsZeitraum()
  const vonIso = von ?? zr.von
  const bisIso = bis ?? zr.bis
  const heute = zr.heute
  const cache = finnhubCache ?? new Map<string, FinnhubEarningsKalenderTermin[]>()

  const [yahooHit, finnhubRoh, wallstreetTermine] = await Promise.all([
    symbole.length > 0 ? ladeYahooEarningsKalenderTerminKandidaten(symbole) : null,
    ladeFinnhubTermineUnion(symbole, vonIso, bisIso, cache),
    isinNorm.length >= 10
      ? ladeWallstreetEarningsTermine(isinNorm, name, vonIso, bisIso)
      : Promise.resolve([]),
  ])

  const yahooK = kandidatAusYahooHit(yahooHit, vonIso, bisIso)
  const ddK = kandidatAusDivvydiaryRoh(divvydiaryRoh, vonIso, bisIso)
  const anchor = yahooK?.terminDatumIso ?? ddK?.terminDatumIso ?? null

  const finnhubFokus = finnhubFokusTermine(finnhubRoh, heute, anchor)
  const kandidaten: EarningsTerminKandidat[] = []

  for (const t of finnhubFokus) {
    kandidaten.push(finnhubZuKandidat(t))
  }

  for (const t of wallstreetTermine) {
    kandidaten.push(finnhubZuKandidat(t, 'wallstreet'))
  }

  const fhAnker =
    finnhubRoh.length > 0
      ? finnhubZuKandidat(pickFinnhubInGroup(finnhubRoh, anchor))
      : null

  const primaer = mergeEarningsTerminKandidaten(
    [yahooK, ddK, fhAnker].filter((k): k is EarningsTerminKandidat => k != null),
    finnhubRoh,
  )

  if (primaer && primaer.terminDatumIso >= vonIso && primaer.terminDatumIso <= bisIso) {
    kandidaten.push({
      ...primaer,
      berichtszeit:
        primaer.berichtszeit ??
        berichtszeitAusKalenderListe(finnhubRoh, primaer.terminDatumIso) ??
        null,
    })
  }

  let termine = dedupeEinTerminProQuartal(kandidaten, finnhubRoh)

  if (termine.length === 0 && ddK) {
    termine = [ddK]
  }

  if (termine.length > MAX_TERMINE_PRO_AKTIE) {
    const past = termine.filter((t) => t.terminDatumIso < heute)
    const future = termine.filter((t) => t.terminDatumIso >= heute)
    const keepPast = past.length > 0 ? [past[past.length - 1]] : []
    const keepFuture = future.slice(0, 2)
    termine = dedupeEinTerminProQuartal([...keepPast, ...keepFuture], finnhubRoh)
  }

  return termine
}

export type { DivvydiaryEarningsRoh, EarningsTerminQuelle }

import {
  berichtszeitAusKalenderListe,
  type Berichtszeit,
} from '@/lib/portfolio-analyse/earnings-berichtszeit'
import { tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { naechsterEarningsTermin } from '@/lib/portfolio-analyse/earnings-prognose'
import type { DivvydiaryEarningsRoh } from '@/lib/portfolio-analyse/divvydiary-scraper-server'
import {
  ladeFinnhubEarningsKalenderAlleImZeitraum,
  type FinnhubEarningsKalenderTermin,
} from '@/lib/portfolio-analyse/finnhub-earnings-kalender-server'
import { ladeYahooEarningsKalenderTerminKandidaten } from '@/lib/portfolio-analyse/yahoo-earnings-schaetzungen-server'

export type EarningsTerminQuelle = 'yahoo' | 'finnhub' | 'divvydiary' | 'divvydiary-prognose'

export type EarningsTerminKandidat = {
  terminDatumIso: string
  bestaetigt: boolean
  quelle: EarningsTerminQuelle
  berichtszeit: Berichtszeit | null
}

function imHorizont(datum: string, von: string, bis: string): boolean {
  return datum >= von && datum <= bis
}

function kandidatAusYahoo(
  hit: { terminDatumIso: string; bestaetigt: boolean; berichtszeit: Berichtszeit | null } | null,
  von: string,
  bis: string,
): EarningsTerminKandidat | null {
  if (!hit || !imHorizont(hit.terminDatumIso, von, bis)) return null
  return {
    terminDatumIso: hit.terminDatumIso,
    bestaetigt: hit.bestaetigt,
    quelle: 'yahoo',
    berichtszeit: hit.berichtszeit,
  }
}

function kandidatAusFinnhub(
  hit: FinnhubEarningsKalenderTermin | null,
  von: string,
  bis: string,
): EarningsTerminKandidat | null {
  if (!hit || !imHorizont(hit.terminDatumIso, von, bis)) return null
  return {
    terminDatumIso: hit.terminDatumIso,
    bestaetigt: true,
    quelle: 'finnhub',
    berichtszeit: hit.berichtszeit,
  }
}

function kandidatAusDivvydiary(
  roh: DivvydiaryEarningsRoh | null,
  von: string,
  bis: string,
): EarningsTerminKandidat | null {
  if (!roh) return null
  const treffer = naechsterEarningsTermin(roh, von, bis)
  if (!treffer) return null
  return {
    terminDatumIso: treffer.terminDatumIso,
    bestaetigt: treffer.bestaetigt,
    quelle: treffer.bestaetigt ? 'divvydiary' : 'divvydiary-prognose',
    berichtszeit: null,
  }
}

function finnhubTerminNaechst(
  kalender: FinnhubEarningsKalenderTermin[],
  zielDatum: string,
): FinnhubEarningsKalenderTermin | null {
  if (kalender.length === 0) return null
  let best = kalender[0]
  let bestDiff = Math.abs(tageZwischenIso(best.terminDatumIso, zielDatum))
  for (const t of kalender) {
    const d = Math.abs(tageZwischenIso(t.terminDatumIso, zielDatum))
    if (d < bestDiff) {
      best = t
      bestDiff = d
    }
  }
  return bestDiff <= 10 ? best : kalender[0]
}

/** Termin-Datum: Yahoo/DivvyDiary vor Finnhub (bessere Report-Tage bei US-Titeln). */
export function mergeEarningsTerminKandidaten(
  kandidaten: EarningsTerminKandidat[],
  finnhubKalender: FinnhubEarningsKalenderTermin[],
): EarningsTerminKandidat | null {
  if (kandidaten.length === 0) return null

  const yahoo = kandidaten.find((k) => k.quelle === 'yahoo')
  const dd = kandidaten.find((k) => k.quelle === 'divvydiary')
  const ddProg = kandidaten.find((k) => k.quelle === 'divvydiary-prognose')

  const datum =
    (yahoo?.bestaetigt !== false ? yahoo?.terminDatumIso : null) ??
    dd?.terminDatumIso ??
    yahoo?.terminDatumIso ??
    ddProg?.terminDatumIso ??
    kandidaten.find((k) => k.quelle === 'finnhub')?.terminDatumIso

  if (!datum) return null

  const finnhubPassend = finnhubTerminNaechst(finnhubKalender, datum)
  const berichtszeit =
    finnhubPassend?.berichtszeit ??
    berichtszeitAusKalenderListe(finnhubKalender, datum) ??
    yahoo?.berichtszeit ??
    null

  const quelle: EarningsTerminQuelle = yahoo
    ? 'yahoo'
    : dd
      ? 'divvydiary'
      : ddProg
        ? 'divvydiary-prognose'
        : 'finnhub'

  const bestaetigt = Boolean(
    yahoo?.bestaetigt ?? dd?.bestaetigt ?? kandidaten.some((k) => k.bestaetigt),
  )

  return {
    terminDatumIso: datum,
    bestaetigt,
    quelle,
    berichtszeit,
  }
}

export async function ladeEarningsTerminFuerSymbole(
  symbole: string[],
  divvydiaryRoh: DivvydiaryEarningsRoh | null,
  von: string,
  bis: string,
): Promise<EarningsTerminKandidat | null> {
  const [yahoo, finnhubKalender] = await Promise.all([
    symbole.length > 0 ? ladeYahooEarningsKalenderTerminKandidaten(symbole) : null,
    symbole.length > 0 ? ladeFinnhubEarningsKalenderAlleImZeitraum(symbole, von, bis) : [],
  ])

  const kandidaten = [
    kandidatAusYahoo(yahoo, von, bis),
    kandidatAusFinnhub(finnhubKalender[0] ?? null, von, bis),
    kandidatAusDivvydiary(divvydiaryRoh, von, bis),
  ].filter((k): k is EarningsTerminKandidat => k != null)

  return mergeEarningsTerminKandidaten(kandidaten, finnhubKalender)
}

import type { Berichtszeit } from '@/lib/portfolio-analyse/earnings-berichtszeit'
import { naechsterEarningsTermin } from '@/lib/portfolio-analyse/earnings-prognose'
import type { DivvydiaryEarningsRoh } from '@/lib/portfolio-analyse/divvydiary-scraper-server'
import { ladeFinnhubEarningsKalenderTerminKandidaten } from '@/lib/portfolio-analyse/finnhub-earnings-kalender-server'
import { ladeYahooEarningsKalenderTerminKandidaten } from '@/lib/portfolio-analyse/yahoo-earnings-schaetzungen-server'

export type EarningsTerminQuelle = 'yahoo' | 'finnhub' | 'divvydiary' | 'divvydiary-prognose'

export type EarningsTerminKandidat = {
  terminDatumIso: string
  bestaetigt: boolean
  quelle: EarningsTerminQuelle
  berichtszeit: Berichtszeit | null
}

function imHorizont(datum: string, heute: string, bis: string): boolean {
  return datum >= heute && datum <= bis
}

function kandidatAusYahoo(
  hit: { terminDatumIso: string; bestaetigt: boolean } | null,
  heute: string,
  bis: string,
): EarningsTerminKandidat | null {
  if (!hit || !imHorizont(hit.terminDatumIso, heute, bis)) return null
  return {
    terminDatumIso: hit.terminDatumIso,
    bestaetigt: hit.bestaetigt,
    quelle: 'yahoo',
    berichtszeit: null,
  }
}

function kandidatAusFinnhub(
  hit: { terminDatumIso: string; berichtszeit: Berichtszeit | null } | null,
  heute: string,
  bis: string,
): EarningsTerminKandidat | null {
  if (!hit || !imHorizont(hit.terminDatumIso, heute, bis)) return null
  return {
    terminDatumIso: hit.terminDatumIso,
    bestaetigt: true,
    quelle: 'finnhub',
    berichtszeit: hit.berichtszeit,
  }
}

function kandidatAusDivvydiary(
  roh: DivvydiaryEarningsRoh | null,
  heute: string,
  bis: string,
): EarningsTerminKandidat | null {
  if (!roh) return null
  const treffer = naechsterEarningsTermin(roh, heute, bis)
  if (!treffer) return null
  return {
    terminDatumIso: treffer.terminDatumIso,
    bestaetigt: treffer.bestaetigt,
    quelle: treffer.bestaetigt ? 'divvydiary' : 'divvydiary-prognose',
    berichtszeit: null,
  }
}

const QUELLEN_PRIO: Record<EarningsTerminQuelle, number> = {
  finnhub: 0,
  yahoo: 1,
  divvydiary: 2,
  'divvydiary-prognose': 3,
}

/** Bestätigte Termine (Yahoo/Finnhub/DivvyDiary) vor Frequenz-Schätzung. */
export function waehleBesterEarningsTermin(
  kandidaten: EarningsTerminKandidat[],
): EarningsTerminKandidat | null {
  if (kandidaten.length === 0) return null

  const bestaetigt = kandidaten.filter((k) => k.bestaetigt)
  const pool = bestaetigt.length > 0 ? bestaetigt : kandidaten

  return [...pool].sort((a, b) => {
    const d = a.terminDatumIso.localeCompare(b.terminDatumIso)
    if (d !== 0) return d
    return QUELLEN_PRIO[a.quelle] - QUELLEN_PRIO[b.quelle]
  })[0]
}

export async function ladeEarningsTerminFuerSymbole(
  symbole: string[],
  divvydiaryRoh: DivvydiaryEarningsRoh | null,
  heute: string,
  bis: string,
): Promise<EarningsTerminKandidat | null> {
  const [yahoo, finnhub] = await Promise.all([
    symbole.length > 0 ? ladeYahooEarningsKalenderTerminKandidaten(symbole) : null,
    symbole.length > 0 ? ladeFinnhubEarningsKalenderTerminKandidaten(symbole) : null,
  ])

  const kandidaten = [
    kandidatAusFinnhub(finnhub, heute, bis),
    kandidatAusYahoo(yahoo, heute, bis),
    kandidatAusDivvydiary(divvydiaryRoh, heute, bis),
  ].filter((k): k is EarningsTerminKandidat => k != null)

  return waehleBesterEarningsTermin(kandidaten)
}

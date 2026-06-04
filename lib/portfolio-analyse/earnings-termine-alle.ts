import { addDaysIso, heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { ladeDivvydiaryEarningsTermine } from '@/lib/portfolio-analyse/divvydiary-scraper-server'
import { fiskalQuartalSchluessel } from '@/lib/portfolio-analyse/earnings-quartal-termin'
import type { EarningsTerminKandidat } from '@/lib/portfolio-analyse/earnings-termine'

/** Nur kommende Termine (DivvyDiary). */
export function earningsZeitraum(): { von: string; bis: string; heute: string } {
  const heute = heuteIsoUtc()
  return {
    heute,
    von: heute,
    bis: addDaysIso(heute, 400),
  }
}

function zuKandidat(terminDatumIso: string, bestaetigt: boolean): EarningsTerminKandidat {
  return {
    terminDatumIso,
    bestaetigt,
    quelle: bestaetigt ? 'divvydiary' : 'divvydiary-prognose',
    berichtszeit: null,
  }
}

/** Max. ein Termin pro Fiskalquartal — bestätigt vor geschätzt. */
function einTerminProFiskalquartal(termine: EarningsTerminKandidat[]): EarningsTerminKandidat[] {
  const map = new Map<string, EarningsTerminKandidat>()
  for (const t of termine) {
    const key = fiskalQuartalSchluessel(t.terminDatumIso)
    const prev = map.get(key)
    if (!prev) {
      map.set(key, t)
      continue
    }
    if (!prev.bestaetigt && t.bestaetigt) map.set(key, t)
  }
  return [...map.values()].sort((a, b) => a.terminDatumIso.localeCompare(b.terminDatumIso))
}

/**
 * Earnings-Termine ausschließlich von DivvyDiary (alle im JSON, sanftes Scraping).
 */
export async function ladeAlleEarningsTermineFuerIsin(
  isinNorm: string,
  name: string,
  von?: string,
  bis?: string,
): Promise<EarningsTerminKandidat[]> {
  const zr = earningsZeitraum()
  const vonIso = von ?? zr.von
  const bisIso = bis ?? zr.bis
  const heute = zr.heute

  const roh = await ladeDivvydiaryEarningsTermine(isinNorm, name, vonIso, bisIso)
  const kandidaten = roh
    .filter((t) => t.terminDatumIso >= heute)
    .map((t) => zuKandidat(t.terminDatumIso, t.bestaetigt))

  return einTerminProFiskalquartal(kandidaten)
}

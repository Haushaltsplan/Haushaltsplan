import { berichtszeitAusKalenderListe } from '@/lib/portfolio-analyse/earnings-berichtszeit'
import { heuteIsoUtc, isoInJahren, isoVorJahren } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import type { DivvydiaryEarningsRoh } from '@/lib/portfolio-analyse/divvydiary-scraper-server'
import { alleDivvydiaryEarningsImZeitraum } from '@/lib/portfolio-analyse/divvydiary-scraper-server'
import type { EarningsTerminKandidat, EarningsTerminQuelle } from '@/lib/portfolio-analyse/earnings-termine'
import { ladeFinnhubEarningsKalenderImZeitraum } from '@/lib/portfolio-analyse/finnhub-earnings-kalender-server'

export const EARNINGS_ZEITRAUM_JAHRE_ZURUECK = 1
export const EARNINGS_ZEITRAUM_JAHRE_VORAUS = 1

export function earningsZeitraum(): { von: string; bis: string; heute: string } {
  const heute = heuteIsoUtc()
  return {
    heute,
    von: isoVorJahren(EARNINGS_ZEITRAUM_JAHRE_ZURUECK),
    bis: isoInJahren(EARNINGS_ZEITRAUM_JAHRE_VORAUS),
  }
}

const QUELLE_RANG: Record<EarningsTerminQuelle, number> = {
  yahoo: 4,
  finnhub: 3,
  divvydiary: 2,
  'divvydiary-prognose': 1,
}

function mergeInMap(
  map: Map<string, EarningsTerminKandidat>,
  k: EarningsTerminKandidat,
  finnhubKalender: { terminDatumIso: string; berichtszeit: EarningsTerminKandidat['berichtszeit'] }[],
): void {
  const prev = map.get(k.terminDatumIso)
  if (!prev) {
    map.set(k.terminDatumIso, k)
    return
  }
  const rangNeu = QUELLE_RANG[k.quelle] ?? 0
  const rangAlt = QUELLE_RANG[prev.quelle] ?? 0
  const bestaetigt = prev.bestaetigt || k.bestaetigt
  const quelle = rangNeu >= rangAlt ? k.quelle : prev.quelle
  const berichtszeit =
    k.berichtszeit ??
    prev.berichtszeit ??
    berichtszeitAusKalenderListe(finnhubKalender, k.terminDatumIso) ??
    null

  map.set(k.terminDatumIso, {
    terminDatumIso: k.terminDatumIso,
    bestaetigt,
    quelle,
    berichtszeit,
  })
}

export async function ladeAlleEarningsTermineFuerSymbole(
  symbole: string[],
  divvydiaryHtml: string | null,
  isinNorm: string,
  von?: string,
  bis?: string,
): Promise<EarningsTerminKandidat[]> {
  const zr = earningsZeitraum()
  const vonIso = von ?? zr.von
  const bisIso = bis ?? zr.bis

  const finnhubKalender = await Promise.all(
    symbole.map((s) => ladeFinnhubEarningsKalenderImZeitraum(s, vonIso, bisIso)),
  ).then((lists) => lists.find((t) => t.length > 0) ?? [])

  const map = new Map<string, EarningsTerminKandidat>()

  for (const t of finnhubKalender) {
    mergeInMap(
      map,
      {
        terminDatumIso: t.terminDatumIso,
        bestaetigt: true,
        quelle: 'finnhub',
        berichtszeit: t.berichtszeit,
      },
      finnhubKalender,
    )
  }

  if (divvydiaryHtml && isinNorm.length >= 10) {
    for (const d of alleDivvydiaryEarningsImZeitraum(divvydiaryHtml, isinNorm, vonIso, bisIso)) {
      mergeInMap(
        map,
        {
          terminDatumIso: d.terminDatumIso,
          bestaetigt: d.bestaetigt,
          quelle: d.bestaetigt ? 'divvydiary' : 'divvydiary-prognose',
          berichtszeit: null,
        },
        finnhubKalender,
      )
    }
  }

  return [...map.values()].sort((a, b) => a.terminDatumIso.localeCompare(b.terminDatumIso))
}

export type { DivvydiaryEarningsRoh }

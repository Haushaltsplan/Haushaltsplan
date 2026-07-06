import { heuteIsoUtc, isoEndeNaechstesKalenderjahr } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { listeDividendenTermine } from '@/lib/portfolio-analyse/dividenden-prognose'
import { istEuEwrIsin } from '@/lib/portfolio-analyse/dividend-isin-region'
import { ladeDivvydiaryRohdaten } from '@/lib/portfolio-analyse/divvydiary-scraper-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

const CACHE_MS = 6 * 60 * 60 * 1000

export type DivvydiaryAnkuendigteDividende = {
  zahlungsdatumIso: string
  exDatumIso: string | null
  dividendeProStueckEur: number
  /** true = offizieller/angekündigter Termin; false = Prognose aus Historie + Wachstum */
  bestaetigt: boolean
}

export type DivvydiaryAnkuendigteDividendeListe = DivvydiaryAnkuendigteDividende[]

const termineCache = new Map<string, { at: number; hits: DivvydiaryAnkuendigteDividendeListe }>()

function trefferZuEintrag(hit: {
  payDate: string
  exDate: string
  amount: number
  bestaetigt: boolean
}): DivvydiaryAnkuendigteDividende {
  return {
    zahlungsdatumIso: hit.payDate,
    exDatumIso: hit.exDate,
    dividendeProStueckEur: hit.amount,
    bestaetigt: hit.bestaetigt,
  }
}

/** Alle Termine im Horizont (angekündigt + Prognose je Zahlungsmuster). */
export async function ladeDivvydiaryAnkuendigteDividenden(
  isin: string,
  name: string,
): Promise<DivvydiaryAnkuendigteDividendeListe> {
  const isinNorm = isin.trim().toUpperCase()
  if (!isinNorm || isinNorm.length < 10) return []

  const cached = termineCache.get(isinNorm)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.hits

  const heute = heuteIsoUtc()
  const bis = isoEndeNaechstesKalenderjahr()
  const anzeigeName = isinKenntnis(isinNorm)?.name ?? name

  const roh = await ladeDivvydiaryRohdaten(isinNorm, anzeigeName, heute)
  if (!roh || roh.rows.length === 0) return []

  const termine = listeDividendenTermine(roh.rows, heute, bis).map(trefferZuEintrag)

  if (termine.length > 0) {
    termineCache.set(isinNorm, { at: Date.now(), hits: termine })
  }
  return termine
}

export async function ladeDivvydiaryAnkuendigteDividende(
  isin: string,
  name: string,
): Promise<DivvydiaryAnkuendigteDividende | null> {
  const alle = await ladeDivvydiaryAnkuendigteDividenden(isin, name)
  return alle[0] ?? null
}

/** EU-ISINs zuerst vorladen (DivvyDiary-Priorität). */
export async function vorladeDivvydiary(positionen: Array<{ isin: string; name: string }>): Promise<void> {
  const heute = heuteIsoUtc()
  const uniq = new Map<string, string>()
  for (const p of positionen) {
    const isin = p.isin.trim().toUpperCase()
    if (isin.length < 10 || uniq.has(isin)) continue
    uniq.set(isin, p.name)
  }

  const sortiert = [...uniq.entries()].sort(([a], [b]) => {
    const euA = istEuEwrIsin(a) ? 0 : 1
    const euB = istEuEwrIsin(b) ? 0 : 1
    return euA - euB
  })

  for (const [isin, name] of sortiert) {
    await ladeDivvydiaryRohdaten(isin, isinKenntnis(isin)?.name ?? name, heute)
  }
}

export { istEuEwrIsin }

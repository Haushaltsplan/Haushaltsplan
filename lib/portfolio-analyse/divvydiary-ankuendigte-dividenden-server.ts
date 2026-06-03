import { heuteIsoUtc, isoInJahren } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { listeDividendenTermine } from '@/lib/portfolio-analyse/dividenden-prognose'
import { istEuEwrIsin } from '@/lib/portfolio-analyse/dividend-isin-region'
import {
  ladeDivvydiaryHtml,
  parseDivvydiaryHtml,
} from '@/lib/portfolio-analyse/divvydiary-scraper-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

const CACHE_MS = 6 * 60 * 60 * 1000
const HORIZONT_JAHRE = 1

export type DivvydiaryAnkuendigteDividende = {
  zahlungsdatumIso: string
  exDatumIso: string | null
  dividendeProStueckEur: number
  /** true = offizieller/angekündigter Termin; false = Prognose aus Historie + Wachstum */
  bestaetigt: boolean
}

export type DivvydiaryAnkuendigteDividendeListe = DivvydiaryAnkuendigteDividende[]

const listenCache = new Map<string, { at: number; hits: DivvydiaryAnkuendigteDividendeListe }>()

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

  const cachedList = listenCache.get(isinNorm)
  if (cachedList && Date.now() - cachedList.at < CACHE_MS) return cachedList.hits

  const heute = heuteIsoUtc()
  const bis = isoInJahren(HORIZONT_JAHRE)
  const anzeigeName = isinKenntnis(isinNorm)?.name ?? name

  const seite = await ladeDivvydiaryHtml(isinNorm, anzeigeName)
  if (!seite) return []

  const rows = parseDivvydiaryHtml(seite.html)
  const termine = listeDividendenTermine(rows, heute, bis).map(trefferZuEintrag)

  if (termine.some((t) => t.bestaetigt)) {
    listenCache.set(isinNorm, { at: Date.now(), hits: termine })
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

/** ISIN-Positionen seriell vorladen (weniger Parallel-Last beim Scraper). */
export async function vorladeDivvydiary(positionen: Array<{ isin: string; name: string }>): Promise<void> {
  const uniq = new Map<string, string>()
  for (const p of positionen) {
    const isin = p.isin.trim().toUpperCase()
    if (isin.length < 10 || !uniq.has(isin)) uniq.set(isin, p.name)
  }
  for (const [isin, name] of uniq) {
    await ladeDivvydiaryAnkuendigteDividenden(isin, name)
  }
}

export { istEuEwrIsin }

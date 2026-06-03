import { heuteIsoUtc, isoInJahren } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { waehleDividendenTermin } from '@/lib/portfolio-analyse/dividenden-prognose'
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

const fetchCache = new Map<string, { at: number; hit: DivvydiaryAnkuendigteDividende | null }>()

/**
 * DivvyDiary: angekündigte Termine zuerst, sonst Prognose aus Ausschüttungshistorie.
 */
export async function ladeDivvydiaryAnkuendigteDividende(
  isin: string,
  name: string,
): Promise<DivvydiaryAnkuendigteDividende | null> {
  const isinNorm = isin.trim().toUpperCase()
  if (!isinNorm || isinNorm.length < 10) return null

  const cached = fetchCache.get(isinNorm)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.hit

  const heute = heuteIsoUtc()
  const bis = isoInJahren(HORIZONT_JAHRE)
  const anzeigeName = isinKenntnis(isinNorm)?.name ?? name

  let result: DivvydiaryAnkuendigteDividende | null = null

  const seite = await ladeDivvydiaryHtml(isinNorm, anzeigeName)
  if (seite) {
    const rows = parseDivvydiaryHtml(seite.html)
    const hit = waehleDividendenTermin(rows, heute, bis)
    if (hit) {
      result = {
        zahlungsdatumIso: hit.payDate,
        exDatumIso: hit.exDate,
        dividendeProStueckEur: hit.amount,
        bestaetigt: hit.bestaetigt,
      }
    }
  }

  if (result?.bestaetigt) {
    fetchCache.set(isinNorm, { at: Date.now(), hit: result })
  }
  return result
}

/** ISIN-Positionen seriell vorladen (weniger Parallel-Last beim Scraper). */
export async function vorladeDivvydiary(positionen: Array<{ isin: string; name: string }>): Promise<void> {
  const uniq = new Map<string, string>()
  for (const p of positionen) {
    const isin = p.isin.trim().toUpperCase()
    if (isin.length < 10 || !uniq.has(isin)) uniq.set(isin, p.name)
  }
  for (const [isin, name] of uniq) {
    await ladeDivvydiaryAnkuendigteDividende(isin, name)
  }
}

export { istEuEwrIsin }

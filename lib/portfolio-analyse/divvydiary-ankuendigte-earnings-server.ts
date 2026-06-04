import { heuteIsoUtc, isoInJahren } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { naechsterEarningsTermin } from '@/lib/portfolio-analyse/earnings-prognose'
import {
  divvydiaryFetchInWarteschlange,
  ladeDivvydiaryEarningsRohdaten,
} from '@/lib/portfolio-analyse/divvydiary-scraper-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

const CACHE_MS = 6 * 60 * 60 * 1000
const HORIZONT_JAHRE = 1

export type DivvydiaryAnkuendigtesEarnings = {
  terminDatumIso: string
  bestaetigt: boolean
  securityName: string
}

const termineCache = new Map<string, { at: number; hit: DivvydiaryAnkuendigtesEarnings | null }>()

export async function ladeDivvydiaryAnkuendigtesEarnings(
  isin: string,
  name: string,
): Promise<DivvydiaryAnkuendigtesEarnings | null> {
  const isinNorm = isin.trim().toUpperCase()
  if (!isinNorm || isinNorm.length < 10) return null

  const cached = termineCache.get(isinNorm)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.hit

  const heute = heuteIsoUtc()
  const bis = isoInJahren(HORIZONT_JAHRE)
  const anzeigeName = isinKenntnis(isinNorm)?.name ?? name

  const roh = await ladeDivvydiaryEarningsRohdaten(isinNorm, anzeigeName)
  if (!roh?.earnings) {
    termineCache.set(isinNorm, { at: Date.now(), hit: null })
    return null
  }

  const treffer = naechsterEarningsTermin(roh.earnings, heute, bis)
  const hit = treffer
    ? {
        terminDatumIso: treffer.terminDatumIso,
        bestaetigt: treffer.bestaetigt,
        securityName: roh.earnings.securityName,
      }
    : null

  termineCache.set(isinNorm, { at: Date.now(), hit })
  return hit
}

/** Depot-ISINs seriell vorladen (gleiche Warteschlange wie Dividenden-Scrape). */
export async function vorladeDivvydiaryEarnings(
  positionen: Array<{ isin: string; name: string }>,
): Promise<void> {
  const uniq = new Map<string, string>()
  for (const p of positionen) {
    const isin = p.isin.trim().toUpperCase()
    if (isin.length < 10 || uniq.has(isin)) continue
    uniq.set(isin, p.name)
  }

  for (const [isin, name] of uniq) {
    await divvydiaryFetchInWarteschlange(() => ladeDivvydiaryAnkuendigtesEarnings(isin, name))
  }
}

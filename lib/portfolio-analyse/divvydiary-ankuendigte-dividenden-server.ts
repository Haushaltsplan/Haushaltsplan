import {
  heuteIsoUtc,
  isoInJahren,
  tageZwischenIso,
} from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { istEuEwrIsin } from '@/lib/portfolio-analyse/dividend-isin-region'
import {
  ladeDivvydiaryHtml,
  parseDivvydiaryHtml,
  type DivvydiaryRohZeile,
} from '@/lib/portfolio-analyse/divvydiary-scraper-server'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

const CACHE_MS = 6 * 60 * 60 * 1000
const HORIZONT_JAHRE = 1

export type DivvydiaryAnkuendigteDividende = {
  zahlungsdatumIso: string
  exDatumIso: string | null
  dividendeProStueckEur: number
}

const fetchCache = new Map<string, { at: number; hit: DivvydiaryAnkuendigteDividende | null }>()

function naechsteImHorizont(rows: DivvydiaryRohZeile[], heute: string, bis: string): DivvydiaryRohZeile | null {
  const zukunft = rows
    .filter((r) => r.payDate >= heute && r.payDate <= bis)
    .sort((a, b) => a.payDate.localeCompare(b.payDate))

  const bestaetigt = zukunft.find((r) => !r.forecast)
  if (bestaetigt) return bestaetigt
  return zukunft[0] ?? null
}

function erwarteteUsQuartalszahlung(
  rows: DivvydiaryRohZeile[],
  heute: string,
  bis: string,
): DivvydiaryRohZeile | null {
  const direkt = naechsteImHorizont(rows, heute, bis)
  if (direkt) return direkt

  const monat = Number(heute.slice(5, 7))
  const jahr = heute.slice(0, 4)
  const refRows = rows.filter(
    (r) => Number(r.payDate.slice(5, 7)) === monat && r.payDate < heute,
  )
  if (refRows.length === 0) return null

  const letzte = rows
    .filter((r) => r.payDate < heute)
    .sort((a, b) => b.payDate.localeCompare(a.payDate))[0]
  if (!letzte || tageZwischenIso(letzte.payDate, heute) < 55) return null

  const ref = refRows.sort((a, b) => b.payDate.localeCompare(a.payDate))[0]
  const payProj = `${jahr}-${ref.payDate.slice(5)}`
  const exProj = `${jahr}-${ref.exDate.slice(5)}`
  if (payProj < heute || payProj > bis) return null

  const jahrAmount =
    rows.find((r) => r.exDate.startsWith(jahr) && !r.forecast)?.amount ?? ref.amount

  return {
    exDate: exProj,
    payDate: payProj,
    amount: jahrAmount,
    forecast: true,
  }
}

function waehleZeile(
  rows: DivvydiaryRohZeile[],
  isinNorm: string,
  heute: string,
  bis: string,
): DivvydiaryRohZeile | null {
  if (isinNorm.startsWith('US')) {
    return erwarteteUsQuartalszahlung(rows, heute, bis)
  }
  return naechsteImHorizont(rows, heute, bis)
}

function zeileZuErgebnis(hit: DivvydiaryRohZeile, bis: string): DivvydiaryAnkuendigteDividende {
  return {
    zahlungsdatumIso: hit.payDate,
    exDatumIso: hit.exDate <= bis ? hit.exDate : null,
    dividendeProStueckEur: Math.round(hit.amount * 10000) / 10000,
  }
}

/**
 * DivvyDiary: Ex- und Zahltag je ISIN (Scraper mit Warteschlange).
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

  const seite = await ladeDivvydiaryHtml(isinNorm, anzeigeName)
  let result: DivvydiaryAnkuendigteDividende | null = null

  if (seite) {
    const hit = waehleZeile(parseDivvydiaryHtml(seite.html), isinNorm, heute, bis)
    if (hit) result = zeileZuErgebnis(hit, bis)
  }

  if (result) {
    fetchCache.set(isinNorm, { at: Date.now(), hit: result })
  }
  return result
}

/** EU-Titel zuerst seriell laden (Cache füllen, weniger Parallel-Last). */
export async function vorladeDivvydiaryEu(positionen: Array<{ isin: string; name: string }>): Promise<void> {
  const uniq = new Map<string, string>()
  for (const p of positionen) {
    const isin = p.isin.trim().toUpperCase()
    if (!istEuEwrIsin(isin)) continue
    if (!uniq.has(isin)) uniq.set(isin, p.name)
  }
  for (const [isin, name] of uniq) {
    await ladeDivvydiaryAnkuendigteDividende(isin, name)
  }
}

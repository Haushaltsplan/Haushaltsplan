import 'server-only'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { lookupIsinMetadaten } from '@/lib/portfolio-analyse/isin-lookup-server'
import {
  FX_SYMBOLE,
  fxKurseAusYahooMap,
  waehleBesterKurs,
} from '@/lib/portfolio-analyse/kurs-aufloesung'
import { ladeYahooKurse } from '@/lib/portfolio-analyse/yahoo-kurse-server'
import { ISIN_MUSTER } from '@/lib/finanz-vermoegen'

export type FondsKursErgebnis = {
  isin: string
  name: string | null
  kursEur: number | null
  aenderungTagProzent: number | null
  symbol: string | null
}

function kandidatenFuerIsin(
  isin: string,
  meta: { symbolYahoo: string | null; symbolCandidates: string[]; name: string } | undefined,
): string[] {
  const k = isinKenntnis(isin)
  const liste = [
    ...(k?.symbolCandidates ?? []),
    k?.symbolYahoo,
    k?.kursNurSymbol,
    ...(meta?.symbolCandidates ?? []),
    meta?.symbolYahoo,
    isin,
  ].filter((s): s is string => Boolean(s && String(s).trim()))
  const out: string[] = []
  const seen = new Set<string>()
  for (const s of liste) {
    const u = s.trim().toUpperCase()
    if (seen.has(u)) continue
    seen.add(u)
    out.push(s.trim())
  }
  return out
}

export async function ladeFondsKurseNachIsin(isins: string[]): Promise<FondsKursErgebnis[]> {
  const unique = [...new Set(isins.map((s) => s.trim().toUpperCase()).filter((s) => ISIN_MUSTER.test(s)))]
  if (unique.length === 0) return []

  const meta = await lookupIsinMetadaten(unique)
  const metaMap = new Map(meta.map((m) => [m.isin.toUpperCase(), m]))
  const kandidatenJeIsin = new Map<string, string[]>()
  const symbole: string[] = [...FX_SYMBOLE]
  for (const isin of unique) {
    const kand = kandidatenFuerIsin(isin, metaMap.get(isin))
    kandidatenJeIsin.set(isin, kand)
    symbole.push(...kand)
  }

  const yahoo = await ladeYahooKurse([...new Set(symbole)])
  const fx = fxKurseAusYahooMap(yahoo)

  return unique.map((isin) => {
    const m = metaMap.get(isin)
    const k = isinKenntnis(isin)
    const wahl = waehleBesterKurs(kandidatenJeIsin.get(isin) ?? [], yahoo, k?.kursFallbackEur ?? 0, k?.kursFallbackEur ?? null, {
      isin,
      fx,
      symbolWaehrung: k?.symbolWaehrung,
      verboteneSymbole: k?.verboteneSymbole,
    })
    const name = (k?.name || m?.name || '').trim() || null
    return {
      isin,
      name,
      kursEur: wahl?.kurs ?? k?.kursFallbackEur ?? null,
      aenderungTagProzent: wahl?.zeile.aenderungTagProzent ?? null,
      symbol: wahl?.symbol ?? m?.symbolYahoo ?? k?.symbolYahoo ?? null,
    }
  })
}

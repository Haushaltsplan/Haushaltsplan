/**
 * SEC 10-K — alle XBRL-Umsatz-/Segment-Tabellen + Namenskanonisierung.
 */

import {
  extrahiereIxbrlTextBlock,
  istPeriodenLabel,
  istPlausiblerSegmentname,
  kanonisereSegmentNamen,
  parseMehrjahresSegmente,
  parseMehrjahresSegmenteDetail,
  type SecSegmentJahrEintrag,
  type SecSegmentRoh,
} from '@/lib/portfolio-analyse/sec-edgar-segment-extraktion'
import { extrahiereDynamischeSegmentBloecke } from '@/lib/portfolio-analyse/sec-edgar-dynamic-blocks'

export type SecDetailBlockDef = {
  id: string
  titel: string
  art: 'produkt' | 'geo' | 'geo_assets' | 'umsatz_detail' | 'produkte_services'
  metrik: 'umsatz' | 'assets'
  tag: string
}

/** Alternative Schreibweise (ODFL u. a.). */
const UMSATZ_DETAIL_TAGS = [
  'DisaggregationOfRevenueTableTextBlock',
  'DisaggregatedRevenueTableTextBlock',
] as const

/** Bekannte iXBRL-TextBlocks für maximale Detailtiefe. */
export const SEC_DETAIL_BLOCKS: SecDetailBlockDef[] = [
  {
    id: 'umsatz_detail',
    titel: 'Umsatz-Aufschlüsselung (Disaggregation)',
    art: 'umsatz_detail',
    metrik: 'umsatz',
    tag: 'DisaggregationOfRevenueTableTextBlock',
  },
  {
    id: 'segment_reporting',
    titel: 'Umsatz nach Reportable Segments',
    art: 'produkt',
    metrik: 'umsatz',
    tag: 'ScheduleOfSegmentReportingInformationBySegmentTextBlock',
  },
  {
    id: 'franchise_umsatz',
    titel: 'Franchise-Umsatz',
    art: 'umsatz_detail',
    metrik: 'umsatz',
    tag: 'ScheduleOfFranchiseRevenueTableTextBlock',
  },
  {
    id: 'produkte_services',
    titel: 'Umsatz nach Produkten & Services',
    art: 'produkte_services',
    metrik: 'umsatz',
    tag: 'ScheduleOfEntitysRevenueFromExternalCustomersByProductsAndServicesTextBlock',
  },
  {
    id: 'geo_umsatz',
    titel: 'Umsatz nach Region',
    art: 'geo',
    metrik: 'umsatz',
    tag: 'RevenueFromExternalCustomersByGeographicAreasTableTextBlock',
  },
  {
    id: 'geo_kombiniert',
    titel: 'Umsatz & Assets nach Region',
    art: 'geo',
    metrik: 'umsatz',
    tag: 'ScheduleOfRevenuesFromExternalCustomersAndLongLivedAssetsByGeographicalAreasTableTextBlock',
  },
  {
    id: 'geo_assets',
    titel: 'Anlagevermögen nach Region',
    art: 'geo_assets',
    metrik: 'assets',
    tag: 'LongLivedAssetsByGeographicAreasTableTextBlock',
  },
  {
    id: 'revenues_geo_alt',
    titel: 'Umsatz nach Geografie (Alt.)',
    art: 'geo',
    metrik: 'umsatz',
    tag: 'RevenuesFromExternalCustomersByGeographicAreasTableTextBlock',
  },
]

export type SecDetailKategorieRoh = {
  def: SecDetailBlockDef
  jahre: SecSegmentJahrEintrag[]
}

/** Alle Detail-Tabellen aus einem 10-K HTML. */
export function extrahiereAlleDetailBloeckeAus10kHtml(html: string): SecDetailKategorieRoh[] {
  const out: SecDetailKategorieRoh[] = []
  const seen = new Set<string>()

  for (const def of SEC_DETAIL_BLOCKS) {
    const tags =
      def.id === 'umsatz_detail' ? [...UMSATZ_DETAIL_TAGS] : [def.tag]
    let bestBlock = ''
    let bestJahre: SecSegmentJahrEintrag[] = []

    for (const tag of tags) {
      const block = extrahiereIxbrlTextBlock(html, tag)
      if (block.length < 200 || seen.has(block.slice(0, 120))) continue

      const parseArt = def.art === 'geo_assets' ? 'geo' : def.art === 'umsatz_detail' || def.art === 'produkte_services' ? 'produkt' : def.art
      const detailFirst = def.art === 'umsatz_detail' || def.art === 'produkte_services'
      let jahre = detailFirst
        ? parseMehrjahresSegmenteDetail(block, parseArt, def.metrik)
        : parseMehrjahresSegmente(block, parseArt, def.metrik)
      if (jahre.length < 2 && !detailFirst) {
        const det = parseMehrjahresSegmenteDetail(block, parseArt, def.metrik)
        if (det.length > jahre.length) jahre = det
      }
      if (jahre.length < 2 && detailFirst) {
        const std = parseMehrjahresSegmente(block, parseArt, def.metrik)
        if (std.length > jahre.length) jahre = std
      }
      if (jahre.length > bestJahre.length) {
        bestJahre = jahre
        bestBlock = block
      }
    }

    if (bestJahre.length < 1 || !bestBlock) continue
    seen.add(bestBlock.slice(0, 120))

    out.push({
      def,
      jahre: bestJahre.map((j) => ({
        jahr: j.jahr,
        segmente: kanonisereSegmentNamen(j.segmente),
      })),
    })
  }

  for (const dyn of extrahiereDynamischeSegmentBloecke(html)) {
    if (out.some((o) => o.def.tag === dyn.def.tag)) continue
    out.push(dyn)
  }

  return out
}

export function summeSegmenteMio(segmente: SecSegmentRoh[]): number {
  return segmente.reduce((s, e) => s + (e.umsatzMio ?? 0), 0)
}

/** Bessere Daten überschreiben — neuere 10-K-Quelle bevorzugen. */
export function mergeJahrSmart(
  map: Map<number, SecSegmentRoh[]>,
  jahr: number,
  segmente: SecSegmentRoh[],
  filingBerichtJahr?: number,
  meta?: Map<number, number>,
  opts?: { erzwingen?: boolean },
): void {
  const norm = kanonisereSegmentNamen(segmente).filter(
    (s) => istPlausiblerSegmentname(s.name) && !istPeriodenLabel(s.name),
  )
  if (norm.length < 2) return
  const neuSumme = summeSegmenteMio(norm)
  const alt = map.get(jahr)
  const altSumme = alt ? summeSegmenteMio(alt) : 0
  const prevFiling = meta?.get(jahr) ?? 0
  const filing = filingBerichtJahr ?? 0

  const neuereQuelle = filing > prevFiling
  const gleicheQuelle = filing === prevFiling && filing > 0
  const bessereSumme = neuSumme > altSumme
  const plausibel = neuSumme >= altSumme * 0.85 || altSumme === 0

  const ueberschreiben =
    opts?.erzwingen ||
    !alt ||
    (neuereQuelle && plausibel) ||
    (gleicheQuelle && bessereSumme) ||
    (!meta && bessereSumme)

  if (ueberschreiben) {
    map.set(
      jahr,
      norm.map((s) => ({ ...s })),
    )
    if (meta && filing > 0) meta.set(jahr, Math.max(filing, prevFiling))
  }
}

export function mergeDetailInMap(
  maps: Map<string, Map<number, SecSegmentRoh[]>>,
  kategorie: SecDetailKategorieRoh,
  filingBerichtJahr?: number,
  metaMaps?: Map<string, Map<number, number>>,
): void {
  let map = maps.get(kategorie.def.id)
  if (!map) {
    map = new Map()
    maps.set(kategorie.def.id, map)
  }
  const meta = metaMaps?.get(kategorie.def.id) ?? (metaMaps ? (() => {
    const m = new Map<number, number>()
    metaMaps.set(kategorie.def.id, m)
    return m
  })() : undefined)
  for (const j of kategorie.jahre) {
    mergeJahrSmart(map, j.jahr, j.segmente, filingBerichtJahr, meta)
  }
}

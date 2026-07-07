/**
 * Dynamische Segment-TextBlock-Erkennung — deckt nicht-standardisierte US-10-K-Tags ab.
 */

import type { SecDetailBlockDef, SecDetailKategorieRoh } from '@/lib/portfolio-analyse/sec-edgar-detail-extraktion'
import {
  extrahiereIxbrlTextBlock,
  kanonisereSegmentNamen,
  parseMehrjahresSegmente,
  parseMehrjahresSegmenteDetail,
  type SecSegmentJahrEintrag,
} from '@/lib/portfolio-analyse/sec-edgar-segment-extraktion'

const BEKANNTE_TAGS = new Set([
  'DisaggregationOfRevenueTableTextBlock',
  'ScheduleOfEntitysRevenueFromExternalCustomersByProductsAndServicesTextBlock',
  'ScheduleOfSegmentReportingInformationBySegmentTextBlock',
  'SegmentReportingDisclosureTextBlock',
  'ScheduleOfFranchiseRevenueTableTextBlock',
  'RevenueFromExternalCustomersByGeographicAreasTableTextBlock',
  'ScheduleOfRevenuesFromExternalCustomersAndLongLivedAssetsByGeographicalAreasTableTextBlock',
  'LongLivedAssetsByGeographicAreasTableTextBlock',
  'RevenuesFromExternalCustomersByGeographicAreasTableTextBlock',
])

const TAG_SKIP =
  /policy|accounting|critical|estimate|assumption|fairvalue|derivative|pension|lease|stock|compensation|debt|tax|risk|contingenc|subsequent|recent|goodwill|intangible|impairment|cashflow|balancesheet|equity|share|warrant|convertible|maturity|collateral|credit|allowance|inventory|receivable|payable|footnote/i

const TAG_INCLUDE =
  /segment|revenue|geograph|product|disaggregat|service|customer|operating|area|franchis|business|channel|brand|reportable/i

function inferArtAusTag(tag: string): SecDetailBlockDef['art'] {
  if (/geograph|geographic|area|country|region|domestic|international/i.test(tag)) {
    return /asset|property|longlived/i.test(tag) ? 'geo_assets' : 'geo'
  }
  if (/disaggregat|product|service|channel|brand/i.test(tag)) return 'umsatz_detail'
  return 'produkt'
}

function inferMetrik(tag: string): 'umsatz' | 'assets' {
  return /asset|property|longlived|ppe/i.test(tag) ? 'assets' : 'umsatz'
}

function titelAusTag(tag: string): string {
  return tag
    .replace(/TableTextBlock$/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
}

/** Alle relevanten iXBRL-TableTextBlock-Tags im 10-K HTML. */
export function entdeckeSegmentTextBlockTags(html: string): string[] {
  const tags = new Set<string>()
  const re = /name="(?:[a-zA-Z0-9_-]+:)?([A-Za-z0-9]+TableTextBlock)"/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const tag = m[1]!
    if (TAG_SKIP.test(tag)) continue
    if (!TAG_INCLUDE.test(tag)) continue
    tags.add(tag)
  }
  return [...tags].sort()
}

function parseBlock(
  block: string,
  art: SecDetailBlockDef['art'],
  metrik: 'umsatz' | 'assets',
): SecSegmentJahrEintrag[] {
  const parseArt = art === 'geo_assets' ? 'geo' : art === 'umsatz_detail' || art === 'produkte_services' ? 'produkt' : art
  const detail = art === 'umsatz_detail' || art === 'produkte_services'
  let jahre = detail
    ? parseMehrjahresSegmenteDetail(block, parseArt, metrik)
    : parseMehrjahresSegmente(block, parseArt, metrik)
  if (jahre.length < 2) {
    const alt = detail
      ? parseMehrjahresSegmente(block, parseArt, metrik)
      : parseMehrjahresSegmenteDetail(block, parseArt, metrik)
    if (alt.length > jahre.length) jahre = alt
  }
  return jahre.map((j) => ({
    jahr: j.jahr,
    segmente: kanonisereSegmentNamen(j.segmente),
  }))
}

/** Zusätzliche Blöcke, die nicht in SEC_DETAIL_BLOCKS sind. */
export function extrahiereDynamischeSegmentBloecke(html: string): SecDetailKategorieRoh[] {
  const out: SecDetailKategorieRoh[] = []
  const seenContent = new Set<string>()

  for (const tag of entdeckeSegmentTextBlockTags(html)) {
    if (BEKANNTE_TAGS.has(tag)) continue
    const block = extrahiereIxbrlTextBlock(html, tag)
    if (block.length < 200) continue
    const fingerprint = block.slice(0, 120)
    if (seenContent.has(fingerprint)) continue
    seenContent.add(fingerprint)

    const art = inferArtAusTag(tag)
    const metrik = inferMetrik(tag)
    const jahre = parseBlock(block, art, metrik)
    if (jahre.length < 1) continue

    const maxJahr = Math.max(...jahre.map((j) => j.jahr))
    if (maxJahr < 2015) continue

    out.push({
      def: {
        id: `dyn_${tag.replace(/TableTextBlock$/i, '').toLowerCase()}`,
        titel: titelAusTag(tag),
        art,
        metrik,
        tag,
      },
      jahre,
    })
  }

  return out.sort((a, b) => {
    const maxA = Math.max(...a.jahre.map((j) => j.jahr))
    const maxB = Math.max(...b.jahre.map((j) => j.jahr))
    if (maxB !== maxA) return maxB - maxA
    return b.jahre.length - a.jahre.length
  })
}

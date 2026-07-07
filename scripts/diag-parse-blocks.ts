import { readFileSync } from 'fs'
import {
  extrahiereIxbrlTextBlock,
  parseMehrjahresSegmente,
  parseMehrjahresSegmenteDetail,
} from '../lib/portfolio-analyse/sec-edgar-segment-extraktion.ts'

const sym = process.argv[2] ?? 'ODFL'
const h = readFileSync(`scripts/.cache-${sym}.html`, 'utf8')

const tags = [
  'DisaggregatedRevenueTableTextBlock',
  'DisaggregationOfRevenueTableTextBlock',
  'ScheduleOfSegmentReportingInformationBySegmentTextBlock',
  'SegmentReportingDisclosureTextBlock',
  'RevenueFromExternalCustomersByGeographicAreasTableTextBlock',
  'ScheduleOfRevenuesFromExternalCustomersAndLongLivedAssetsByGeographicalAreasTableTextBlock',
]

for (const tag of tags) {
  const block = extrahiereIxbrlTextBlock(h, tag)
  if (block.length < 200) continue
  console.log(`\n=== ${tag} len=${block.length} ===`)
  const det = parseMehrjahresSegmenteDetail(block, 'produkt')
  const geo = parseMehrjahresSegmenteDetail(block, 'geo')
  const std = parseMehrjahresSegmente(block, 'produkt')
  console.log('detail produkt years:', det.length, det.map((j) => `${j.jahr}:${j.segmente.map((s) => s.name).join('|')}`).join('; '))
  console.log('detail geo years:', geo.length, geo.map((j) => `${j.jahr}:${j.segmente.map((s) => s.name).join('|')}`).join('; '))
  console.log('std produkt years:', std.length)
  // show first table rows text
  const rows = [...block.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].slice(0, 15)
  for (const r of rows) {
    const cells = [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((c) => c[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    if (cells.length) console.log('  row:', cells.join(' | ').slice(0, 200))
  }
}

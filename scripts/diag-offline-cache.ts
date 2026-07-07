/**
 * Offline analysis of cached 10-K HTML
 * npx tsx scripts/diag-offline-cache.ts ODFL UNP KNSL
 */
import { readFileSync } from 'fs'
import { extrahiereAlleDetailBloeckeAus10kHtml } from '../lib/portfolio-analyse/sec-edgar-detail-extraktion.ts'
import { entdeckeSegmentTextBlockTags, extrahiereDynamischeSegmentBloecke } from '../lib/portfolio-analyse/sec-edgar-dynamic-blocks.ts'
import {
  extrahiereBeideSegmentartenAus10kHtml,
  extrahiereErstenGeoBlock,
  extrahiereIxbrlTextBlock,
  extrahiereSegmentHistorieAus10kHtml,
  parseGeoSegmente,
  teileUmsatzDetailInProduktUndGeo,
  validiereSegmente,
} from '../lib/portfolio-analyse/sec-edgar-segment-extraktion.ts'

const syms = process.argv.slice(2).length ? process.argv.slice(2) : ['ODFL', 'UNP', 'KNSL']

for (const sym of syms) {
  const html = readFileSync(`scripts/.cache-${sym.toUpperCase()}.html`, 'utf8')
  console.log(`\n======== ${sym} html=${html.length} ========`)

  const tags = entdeckeSegmentTextBlockTags(html)
  console.log('discovered:', tags.join(', '))

  for (const tag of tags) {
    const block = extrahiereIxbrlTextBlock(html, tag)
    if (block.length < 200) continue
    console.log(`  ${tag}: block len=${block.length}`)
  }

  const dyn = extrahiereDynamischeSegmentBloecke(html)
  for (const k of dyn) {
    const j = k.jahre.map((x) => x.jahr).sort((a, b) => a - b)
    const names = k.jahre[0]?.segmente?.map((s) => s.name).slice(0, 6).join(' | ') ?? ''
    console.log(`  dyn ${k.def.id}: ${j.length}J [${j.join(',')}] → ${names}`)
  }

  const blocks = extrahiereAlleDetailBloeckeAus10kHtml(html)
  for (const b of blocks) {
    const ys = b.jahre.map((j) => j.jahr).join(',')
    const names = b.jahre[0]?.segmente?.map((s) => s.name).slice(0, 6).join(' | ') ?? ''
    console.log(`  block ${b.def.id}: ${b.jahre.length}J [${ys}] → ${names}`)
  }

  const hist = extrahiereSegmentHistorieAus10kHtml(html)
  console.log(`  hist produkt=${hist.produkt?.jahre.length ?? 0} geo=${hist.geo?.jahre.length ?? 0}`)

  const beide = extrahiereBeideSegmentartenAus10kHtml(html)
  console.log(`  beide prod=[${beide.produkt.segmente.map((s) => s.name).join(', ')}]`)
  console.log(`  beide geo=[${beide.geo.segmente.map((s) => s.name).join(', ')}]`)

  const geoBlock = extrahiereErstenGeoBlock(html)
  if (geoBlock.length > 100) {
    const geo = validiereSegmente(parseGeoSegmente(geoBlock, true))
    console.log(`  geoBlock parse: ${geo.length} [${geo.map((s) => s.name).join(', ')}]`)
  }

  const disagg = blocks.find((b) => b.def.id === 'umsatz_detail')
  if (disagg) {
    const split = teileUmsatzDetailInProduktUndGeo(disagg.jahre)
    console.log(`  disagg split prod=${split.produkt.length}J geo=${split.geo.length}J`)
  }
}

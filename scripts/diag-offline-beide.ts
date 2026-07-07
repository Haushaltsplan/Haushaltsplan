/**
 * Offline batch test on cached HTML (ODFL UNP KNSL) or live via diag-fetch first.
 */
import { readFileSync, existsSync } from 'fs'
import { extrahiereAlleDetailBloeckeAus10kHtml } from '../lib/portfolio-analyse/sec-edgar-detail-extraktion.ts'
import { extrahiereUmsatzAusIxbrlDimensionen } from '../lib/portfolio-analyse/sec-edgar-ixbrl-dimensionen.ts'
import { extrahiereNarrativeSegmentTabellen } from '../lib/portfolio-analyse/sec-edgar-narrative-tabellen.ts'
import {
  extrahiereSegmentHistorieAus10kHtml,
  teileUmsatzDetailInProduktUndGeo,
} from '../lib/portfolio-analyse/sec-edgar-segment-extraktion.ts'

const syms = process.argv.slice(2).length ? process.argv.slice(2) : ['ODFL', 'UNP', 'KNSL']

for (const sym of syms) {
  const path = `scripts/.cache-${sym}.html`
  if (!existsSync(path)) {
    console.log(sym, 'no cache — run diag-fetch-10k.ts')
    continue
  }
  const html = readFileSync(path, 'utf8')
  let prodJ = 0
  let geoJ = 0

  const blocks = extrahiereAlleDetailBloeckeAus10kHtml(html)
  const disagg = blocks.find((b) => b.def.id === 'umsatz_detail')
  if (disagg) {
    const split = teileUmsatzDetailInProduktUndGeo(disagg.jahre)
    prodJ = Math.max(prodJ, split.produkt.length, disagg.jahre.length >= 2 ? disagg.jahre.length : 0)
    geoJ = Math.max(geoJ, split.geo.length)
  }
  const seg = blocks.find((b) => b.def.id === 'segment_reporting')
  if (seg && seg.jahre.length > prodJ) prodJ = seg.jahre.length

  const hist = extrahiereSegmentHistorieAus10kHtml(html)
  if (hist.produkt) prodJ = Math.max(prodJ, hist.produkt.jahre.length)
  if (hist.geo) geoJ = Math.max(geoJ, hist.geo.jahre.length)

  const ix = extrahiereUmsatzAusIxbrlDimensionen(html)
  prodJ = Math.max(prodJ, ix.produkt.length)
  geoJ = Math.max(geoJ, ix.geo.length)

  const narr = extrahiereNarrativeSegmentTabellen(html)
  prodJ = Math.max(prodJ, narr.produkt.length)
  geoJ = Math.max(geoJ, narr.geo.length)

  const ok = prodJ >= 2 && geoJ >= 2
  console.log(`${ok ? '✅' : '⚠️'} ${sym.padEnd(6)} Produkt ${prodJ}J  Geo ${geoJ}J`)
}

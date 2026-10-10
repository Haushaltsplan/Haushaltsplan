/**
 * npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/diag-ma-10q.ts
 */
import { cikFuerTicker, secFetch } from '../lib/portfolio-analyse/sec-edgar-common-server'
import { ladeLesbarenBerichtText } from '../lib/portfolio-analyse/sec-edgar-bericht-text-server'
import { extrahiereAlleDetailBloeckeAus10kHtml } from '../lib/portfolio-analyse/sec-edgar-detail-extraktion'
import {
  extrahiereBeideSegmentartenAus10kHtml,
} from '../lib/portfolio-analyse/sec-edgar-segment-extraktion'
import { teileUmsatzDetailInProduktUndGeo } from '../lib/portfolio-analyse/sec-edgar-segment-extraktion'

async function main() {
  const cik = await cikFuerTicker('MA')!
  const accession = '0001141391-26-000083' // 2026-06-30 10-Q
  const doc = 'ma-20260630.htm'
  const bericht = await ladeLesbarenBerichtText(cik!, accession, '10-Q', doc)
  console.log('doc', bericht?.documentName, 'textLen', bericht?.text.length)
  const html = bericht?.url ? await (await secFetch(bericht.url)).text() : ''
  console.log('html len', html.length)

  const beide = extrahiereBeideSegmentartenAus10kHtml(html)
  console.log('beide.prod', beide.produkt.segmente.map((s) => `${s.name}=${s.umsatzMio}`).join(' | '))
  console.log('beide.geo', beide.geo.segmente.map((s) => `${s.name}=${s.umsatzMio}`).join(' | '))

  const details = extrahiereAlleDetailBloeckeAus10kHtml(html)
  console.log('details', details.length)
  for (const d of details) {
    console.log(d.def.id, d.jahre.map((j) => `${j.jahr}:${j.segmente.map((s) => s.name.slice(0, 16)).join(',')}`).join(' || '))
    if (d.def.id === 'umsatz_detail') {
      for (const j of d.jahre) {
        console.log(
          '  raw',
          j.jahr,
          j.segmente.map((s) => `${s.name}=${s.umsatzMio}`).join(' | '),
        )
      }
      const split = teileUmsatzDetailInProduktUndGeo(d.jahre)
      console.log(
        '  split prod',
        split.produkt.map((j) => `${j.jahr}:${j.segmente.map((s) => `${s.name}=${s.umsatzMio}`).join(',')}`).join(' || '),
      )
      console.log(
        '  split geo',
        split.geo.map((j) => `${j.jahr}:${j.segmente.map((s) => `${s.name}=${s.umsatzMio}`).join(',')}`).join(' || '),
      )
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

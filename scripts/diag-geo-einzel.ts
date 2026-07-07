/** npx tsx scripts/diag-geo-einzel.ts UNH */
import { extrahiereAlleDetailBloeckeAus10kHtml } from '../lib/portfolio-analyse/sec-edgar-detail-extraktion.ts'
import {
  extrahiereErstenGeoBlock,
  extrahiereIxbrlTextBlock,
  extrahiereSegmentHistorieAus10kHtml,
} from '../lib/portfolio-analyse/sec-edgar-segment-extraktion.ts'
import { extrahiereUmsatzAusIxbrlDimensionen } from '../lib/portfolio-analyse/sec-edgar-ixbrl-dimensionen.ts'
import { extrahiereNarrativeSegmentTabellen } from '../lib/portfolio-analyse/sec-edgar-narrative-tabellen.ts'
import { ISIN_KENNTNISSE } from '../lib/portfolio-analyse/isin-kenntnisse'
import { NACHKAUF_RADAR_WHITELIST } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'

const sym = (process.argv[2] ?? 'UNH').toUpperCase()
const UA = process.env.SEC_EDGAR_USER_AGENT || 'test@example.com'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const pos = NACHKAUF_RADAR_WHITELIST.find((p) => {
    const s = ISIN_KENNTNISSE[p.isin]?.symbolYahoo?.split('.')[0]?.toUpperCase()
    return s === sym
  })
  if (!pos?.cik) throw new Error('no cik')
  const cik = parseInt(pos.cik.replace(/^0+/, ''), 10)
  const sub = await (await fetch(`https://data.sec.gov/submissions/CIK${pos.cik}.json`, { headers: { 'User-Agent': UA } })).json()
  const f = sub.filings.recent
  let acc = ''
  let doc = ''
  for (let i = 0; i < f.form.length; i++) {
    if (f.form[i] === '10-K') {
      acc = f.accessionNumber[i]
      doc = f.primaryDocument[i]
      break
    }
  }
  await sleep(400)
  const accPath = acc.replace(/-/g, '')
  const html = await (await fetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${doc}`, { headers: { 'User-Agent': UA } })).text()
  console.log(sym, 'html', html.length)

  for (const kat of extrahiereAlleDetailBloeckeAus10kHtml(html)) {
    const names = [...new Set(kat.jahre.flatMap((j) => j.segmente.map((s) => s.name)))].slice(0, 8)
    console.log(kat.def.id, kat.jahre.length, 'J', names.join(' | '))
  }

  const hist = extrahiereSegmentHistorieAus10kHtml(html)
  console.log('hist produkt', hist.produkt?.jahre.length, hist.produkt?.jahre[0]?.segmente.map((s) => s.name).join(', '))
  console.log('hist geo', hist.geo?.jahre.length, hist.geo?.jahre[0]?.segmente.map((s) => s.name).join(', '))

  const ix = extrahiereUmsatzAusIxbrlDimensionen(html)
  console.log('ix prod', ix.produkt.length, ix.produkt[0]?.segmente.map((s) => s.name).join(', '))
  console.log('ix geo', ix.geo.length, ix.geo[0]?.segmente.map((s) => s.name).join(', '))

  const narr = extrahiereNarrativeSegmentTabellen(html)
  console.log('narr geo', narr.geo.length)

  const geoBlock = extrahiereErstenGeoBlock(html)
  console.log('geo block len', geoBlock.length, geoBlock.slice(0, 200).replace(/\s+/g, ' '))

  const tags = [...html.matchAll(/name="(?:[a-zA-Z0-9_-]+:)?([A-Za-z0-9]*Geograph[A-Za-z0-9]*TableTextBlock)"/gi)].map((m) => m[1])
  console.log('geo tags', [...new Set(tags)])
  for (const t of [...new Set(tags)].slice(0, 3)) {
    const b = extrahiereIxbrlTextBlock(html, t)
    console.log(' ', t, 'len', b.length)
  }
}

main().catch(console.error)

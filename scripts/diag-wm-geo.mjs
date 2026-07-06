import { extrahiereAlleDetailBloeckeAus10kHtml } from '../lib/portfolio-analyse/sec-edgar-detail-extraktion'
import { extrahiereErstenGeoBlock, parseGeoSegmente, validiereSegmente } from '../lib/portfolio-analyse/sec-edgar-segment-extraktion'

const UA = 'test@example.com'
const sym = process.argv[2] ?? 'WM'

const tickers = await (await fetch('https://www.sec.gov/files/company_tickers.json', { headers: { 'User-Agent': UA } })).json()
let cik
for (const r of Object.values(tickers)) if (r.ticker === sym) cik = r.cik_str
const sub = await (await fetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10,'0')}.json`, { headers: { 'User-Agent': UA } })).json()
const f = sub.filings.recent
let acc, doc, report
for (let i = 0; i < f.form.length; i++) if (f.form[i] === '10-K') { acc = f.accessionNumber[i]; doc = f.primaryDocument[i]; report = f.reportDate[i]; break }
const html = await (await fetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${acc.replace(/-/g,'')}/${doc}`, { headers: { 'User-Agent': UA } })).text()
console.log('report', report, 'html', html.length)

const d = extrahiereAlleDetailBloeckeAus10kHtml(html)
for (const k of d) {
  const j = k.jahre.map((x) => x.jahr).sort((a,b)=>a-b)
  console.log(k.def.id, j.join(','))
}

const geoBlock = extrahiereErstenGeoBlock(html)
console.log('geoBlock len', geoBlock.length)
const raw = parseGeoSegmente(geoBlock, true)
console.log('parseGeo raw', raw.map(s => `${s.name}:${s.umsatzMio}`))
const val = validiereSegmente(raw)
console.log('validiert', val.map(s => `${s.name}:${s.umsatzMio}`))

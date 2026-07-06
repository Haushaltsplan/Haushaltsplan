import { extrahiereIxbrlTextBlock, parseMehrjahresSegmente, parseSpaltenOrientierteSegmente, validiereSegmente } from '../lib/portfolio-analyse/sec-edgar-segment-extraktion.ts'

const UA = 'Omnia Haushalt test@example.com'
const sym = process.argv[2] ?? 'UNH'
const tag = process.argv[3] ?? 'ScheduleOfSegmentReportingInformationBySegmentTextBlock'

const tickers = await (await fetch('https://www.sec.gov/files/company_tickers.json', { headers: { 'User-Agent': UA } })).json()
let cik
for (const r of Object.values(tickers)) if (r.ticker === sym) cik = r.cik_str
const sub = await (await fetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10,'0')}.json`, { headers: { 'User-Agent': UA } })).json()
const f = sub.filings.recent
let acc, doc
for (let i = 0; i < f.form.length; i++) if (f.form[i] === '10-K') { acc = f.accessionNumber[i]; doc = f.primaryDocument[i]; break }
const accPath = acc.replace(/-/g,'')
let pick = doc
try {
  const idx = await (await fetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${acc}-index.json`, { headers: { 'User-Agent': UA } })).json()
  pick = idx.directory.item.filter(i => /\.htm/i.test(i.name) && !/index/i.test(i.name)).sort((a,b)=>parseInt(b.size||0)-parseInt(a.size||0))[0].name
} catch {}
const html = await (await fetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${pick}`, { headers: { 'User-Agent': UA } })).text()
const block = extrahiereIxbrlTextBlock(html, tag)
console.log('block len', block.length)
const mj = parseMehrjahresSegmente(block, 'produkt')
console.log('mehrjahre', mj.map(j => j.jahr + ':' + j.segmente.map(s=>s.name).join('|')))
const sp = validiereSegmente(parseSpaltenOrientierteSegmente(block))
console.log('spalten', sp.map(s => s.name + ':' + s.umsatzMio))

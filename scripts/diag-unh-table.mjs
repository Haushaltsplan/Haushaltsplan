import { extrahiereIxbrlTextBlock, parseTabellenZeilen, nichtLeereZellen, bereinigeLabel } from '../lib/portfolio-analyse/sec-edgar-segment-extraktion.ts'

const UA = 'Omnia Haushalt test@example.com'
const sym = 'UNH'
const tag = 'ScheduleOfSegmentReportingInformationBySegmentTextBlock'

const tickers = await (await fetch('https://www.sec.gov/files/company_tickers.json', { headers: { 'User-Agent': UA } })).json()
let cik
for (const r of Object.values(tickers)) if (r.ticker === sym) cik = r.cik_str
const sub = await (await fetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10,'0')}.json`, { headers: { 'User-Agent': UA } })).json()
const f = sub.filings.recent
let acc, doc
for (let i = 0; i < f.form.length; i++) if (f.form[i] === '10-K') { acc = f.accessionNumber[i]; doc = f.primaryDocument[i]; break }
const accPath = acc.replace(/-/g,'')
const idx = await (await fetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${acc}-index.json`, { headers: { 'User-Agent': UA } })).json()
const pick = idx.directory.item.filter(i => /\.htm/i.test(i.name) && !/index/i.test(i.name)).sort((a,b)=>parseInt(b.size||0)-parseInt(a.size||0))[0].name
const html = await (await fetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${pick}`, { headers: { 'User-Agent': UA } })).text()
const block = extrahiereIxbrlTextBlock(html, tag)
const zeilen = parseTabellenZeilen(block)
let n = 0
for (const z of zeilen) {
  const s = nichtLeereZellen(z.zellen).map(bereinigeLabel)
  if (s.some(x => /202[0-9]|revenue|optum|united/i.test(x))) {
    console.log({ zellen: s.slice(0, 8), betraege: z.betraege.slice(0, 6) })
    if (++n >= 15) break
  }
}

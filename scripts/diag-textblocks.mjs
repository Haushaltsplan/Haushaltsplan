/** Finde alle Segment-TextBlocks in 10-K */
const UA = 'test@example.com'
const sym = process.argv[2] ?? 'MCD'

const tickers = await (await fetch('https://www.sec.gov/files/company_tickers.json', { headers: { 'User-Agent': UA } })).json()
let cik
for (const r of Object.values(tickers)) if (r.ticker === sym) cik = r.cik_str
const sub = await (await fetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10,'0')}.json`, { headers: { 'User-Agent': UA } })).json()
const f = sub.filings.recent
let acc, doc
for (let i = 0; i < f.form.length; i++) if (f.form[i] === '10-K') { acc = f.accessionNumber[i]; doc = f.primaryDocument[i]; break }
const idx = await (await fetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${acc.replace(/-/g,'')}/${acc}-index.json`, { headers: { 'User-Agent': UA } })).json()
const pick = idx.directory.item.filter(i => /\.htm/i.test(i.name) && !/index/i.test(i.name)).sort((a,b)=>parseInt(b.size||0)-parseInt(a.size||0))[0].name
const html = await (await fetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${acc.replace(/-/g,'')}/${pick}`, { headers: { 'User-Agent': UA } })).text()

const tags = new Set()
for (const m of html.matchAll(/name="(?:[a-zA-Z0-9_-]+:)?([A-Za-z0-9]+TableTextBlock)"/gi)) tags.add(m[1])
console.log(sym, 'TableTextBlocks:')
for (const t of [...tags].sort()) if (/segment|revenue|geograph|product|disaggregat|service|area|customer/i.test(t)) console.log(' ', t)

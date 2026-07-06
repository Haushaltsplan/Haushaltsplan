const UA = 'Omnia Haushalt test@example.com'
const sym = process.argv[2] ?? 'UNH'

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
  const idxRes = await fetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${acc}-index.json`, { headers: { 'User-Agent': UA } })
  if (idxRes.ok) {
    const idx = await idxRes.json()
    const sorted = (idx.directory?.item ?? []).filter(i => /\.htm/i.test(i.name) && !/index/i.test(i.name)).sort((a,b)=>parseInt(b.size||0)-parseInt(a.size||0))
    if (sorted[0]?.name) pick = sorted[0].name
  }
} catch {}
const html = await (await fetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${pick}`, { headers: { 'User-Agent': UA } })).text()

for (const kw of ['Optum', 'UnitedHealthcare', 'SegmentReporting', 'reportable segment', 'RevenuesBySegment', 'BusinessSegment']) {
  const i = html.indexOf(kw)
  console.log(kw, i >= 0 ? `found at ${i}` : 'not found')
}

const tags = new Set()
for (const m of html.matchAll(/name="(?:[a-zA-Z0-9_-]+:)?([A-Za-z0-9]+)"/gi)) {
  const t = m[1]
  if (/segment|optum|health|revenue|geograph|product|disaggregat/i.test(t) && /table|schedule|revenue|segment/i.test(t)) tags.add(t)
}
console.log('relevant names:', [...tags].sort().slice(0, 40).join('\n  '))

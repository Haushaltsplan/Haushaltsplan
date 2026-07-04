const UA = 'Omnia Haushalt test@example.com'

async function secFetch(url) {
  return fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, cache: 'no-store' })
}

async function cik(sym) {
  const r = await secFetch('https://www.sec.gov/files/company_tickers.json')
  const j = await r.json()
  for (const row of Object.values(j)) {
    if (row.ticker === sym) return row.cik_str
  }
  return null
}

async function latest10k(cik) {
  const r = await secFetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, '0')}.json`)
  const j = await r.json()
  const f = j.filings.recent
  for (let i = 0; i < f.form.length; i++) {
    if (f.form[i] === '10-K') return { acc: f.accessionNumber[i], doc: f.primaryDocument[i] }
  }
}

async function filingIndex(cik, acc) {
  const accPath = acc.replace(/-/g, '')
  const r = await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${acc}-index.json`)
  if (r.ok) return (await r.json()).directory?.item ?? []
  return []
}

function pickDoc(items, primary) {
  const k = items
    .filter((i) => /\.(htm|html)$/i.test(i.name) && !/index\.htm/i.test(i.name) && !/\.xsd|_cal|_def|_lab|_pre/i.test(i.name))
    .sort((a, b) => parseInt(b.size || 0) - parseInt(a.size || 0))
  return k[0]?.name || primary
}

const sym = process.argv[2] || 'MSFT'
const c = await cik(sym)
const f = await latest10k(c)
const items = await filingIndex(c, f.acc)
const doc = pickDoc(items, f.doc)
const accPath = f.acc.replace(/-/g, '')
const url = `https://www.sec.gov/Archives/edgar/data/${c}/${accPath}/${doc}`
console.log('doc', doc, url)
const html = await (await secFetch(url)).text()
console.log('len', html.length)

const patterns = [
  'RevenueFromExternalCustomersByGeographicAreas',
  'RevenuesNetOfInterestExpense',
  'SegmentReporting',
  'segment information',
  'revenue by geographic',
  'operating segments',
  'Productivity and Business Processes',
  'Intelligent Cloud',
]
for (const p of patterns) {
  const idx = html.toLowerCase().indexOf(p.toLowerCase())
  console.log(p, idx >= 0 ? `@${idx}` : 'MISS')
}

// find ix nonfraction with segment context
const ctxSeg = [...html.matchAll(/contextRef="([^"]*(?:Segment|Member|Region)[^"]*)"/gi)].slice(0, 20).map(m => m[1])
console.log('contexts', [...new Set(ctxSeg)].slice(0, 12))

// sample table near segment information
const si = html.search(/segment information/i)
if (si >= 0) {
  const slice = html.slice(si, si + 8000)
  const rows = [...slice.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].slice(0, 15)
  for (const r of rows) {
    const text = r[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
    if (text.length > 5) console.log('ROW:', text)
  }
}

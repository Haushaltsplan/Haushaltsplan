const UA = 'Omnia Haushalt test@example.com'
const sym = process.argv[2] || 'MSFT'

async function secFetch(url) {
  return fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
}

async function loadHtml(sym) {
  const tickers = await (await secFetch('https://www.sec.gov/files/company_tickers.json')).json()
  let cik
  for (const row of Object.values(tickers)) if (row.ticker === sym) cik = row.cik_str
  const sub = await (await secFetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10,'0')}.json`)).json()
  const f = sub.filings.recent
  let acc, doc
  for (let i = 0; i < f.form.length; i++) {
    if (f.form[i] === '10-K') { acc = f.accessionNumber[i]; doc = f.primaryDocument[i]; break }
  }
  const accPath = acc.replace(/-/g,'')
  const idxUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${acc}-index.json`
  const idxRes = await secFetch(idxUrl)
  let pick = doc
  if (idxRes.ok) {
    const items = (await idxRes.json()).directory?.item ?? []
    const sorted = items
      .filter(i => /\.(htm|html)$/i.test(i.name) && !/-index\.htm/i.test(i.name) && !/\.xsd|_cal|_def|_lab|_pre|filingsummary/i.test(i.name))
      .sort((a,b) => parseInt(String(b.size||0).replace(/,/g,'')) - parseInt(String(a.size||0).replace(/,/g,'')))
    if (sorted[0]?.name) pick = sorted[0].name
  }
  const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${pick}`
  console.error(sym, pick, url)
  return await (await secFetch(url)).text()
}

function dumpRows(html, marker, n = 15) {
  const idx = html.search(new RegExp(marker, 'i'))
  if (idx < 0) return console.log('NO', marker)
  console.log('\n---', marker, '@', idx, '---')
  const slice = html.slice(idx, idx + 15000)
  const rows = [...slice.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].slice(0, n)
  for (const r of rows) {
    const ix = [...r[1].matchAll(/<ix:nonfraction[^>]*>([\s\S]*?)<\/ix:nonfraction>/gi)].map(m => m[1].replace(/<[^>]+>/g,'').replace(/,/g,'').trim())
    const cells = [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => m[1].replace(/<[^>]+>/g,' ').replace(/&#160;/g,'').replace(/&nbsp;/g,'').replace(/\s+/g,' ').trim()).filter(Boolean)
    if (cells.length >= 1 || ix.length) console.log({ cells: cells.slice(0,5), ix })
  }
}

const h = await loadHtml(sym)
console.log('html len', h.length)

if (process.argv.includes('--xbrl')) {
  const geo = h.indexOf('RevenueFromExternalCustomersByGeographicAreas')
  if (geo >= 0) console.log(h.slice(geo - 100, geo + 2500).replace(/></g, '>\n<'))
  for (const name of ['Productivity and Business Processes', 'Intelligent Cloud', 'More Personal Computing']) {
    const i = h.indexOf(name)
    if (i >= 0) { console.log('\n===', name, '==='); console.log(h.slice(i, i + 900).replace(/></g, '>\n<')) }
  }
  if (sym === 'NOW') {
    const si = h.search(/segment information/i)
    console.log('\nNOW seg:', h.slice(si, si + 3500).replace(/></g, '>\n<'))
  }
  process.exit(0)
}

for (const m of ['operating segments', 'geographic', 'North America', 'Productivity and Business', 'Intelligent Cloud', 'revenue by geographic']) {
  dumpRows(h, m, 10)
}

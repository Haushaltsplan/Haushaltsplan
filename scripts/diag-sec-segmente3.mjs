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
  let acc
  for (let i = 0; i < f.form.length; i++) if (f.form[i] === '10-K') { acc = f.accessionNumber[i]; break }
  const accPath = acc.replace(/-/g,'')
  const idx = await (await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${acc}-index.json`)).json()
  const pick = idx.directory.item.filter(i => /\.htm/i.test(i.name) && !/index/i.test(i.name)).sort((a,b)=>b.size-a.size)[0].name
  return await (await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${pick}`)).text()
}

const h = await loadHtml(sym)

// MSFT XBRL geographic at ~7213311
const geo = h.indexOf('RevenueFromExternalCustomersByGeographicAreas')
if (geo >= 0) {
  console.log('XBRL geo snippet:')
  console.log(h.slice(geo - 200, geo + 3000).replace(/></g, '>\n<').slice(0, 2500))
}

// operating segment table - search for ix facts with segment names
for (const name of ['Productivity and Business Processes', 'Intelligent Cloud', 'More Personal Computing']) {
  const i = h.indexOf(name)
  if (i < 0) continue
  console.log('\n===', name, '===')
  console.log(h.slice(i, i + 1200).replace(/></g, '>\n<').slice(0, 1000))
}

// NOW segment information
if (sym === 'NOW') {
  const si = h.indexOf('Segment information')
  console.log('\nNOW segment info:')
  console.log(h.slice(si, si + 4000).replace(/></g, '>\n<').slice(0, 3500))
}

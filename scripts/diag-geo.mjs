const UA = 'Omnia test@example.com'

async function block(sym, tag) {
  const tickers = await (await fetch('https://www.sec.gov/files/company_tickers.json', { headers: { 'User-Agent': UA } })).json()
  let cik
  for (const row of Object.values(tickers)) if (row.ticker === sym) cik = row.cik_str
  const sub = await (await fetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10,'0')}.json`, { headers: { 'User-Agent': UA } })).json()
  const f = sub.filings.recent
  let acc, doc
  for (let i = 0; i < f.form.length; i++) if (f.form[i] === '10-K') { acc = f.accessionNumber[i]; doc = f.primaryDocument[i]; break }
  const accPath = acc.replace(/-/g,'')
  const idx = await (await fetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${acc}-index.json`, { headers: { 'User-Agent': UA } })).json()
  const pick = idx.directory.item.filter(i => /\.htm/i.test(i.name) && !/index/i.test(i.name)).sort((a,b)=>b.size-a.size)[0].name
  const h = await (await fetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${pick}`, { headers: { 'User-Agent': UA } })).text()
  const i = h.indexOf(tag)
  if (i < 0) return null
  const start = h.lastIndexOf('<ix:nonNumeric', i)
  let end = h.indexOf('</ix:nonNumeric>', start)
  const cont = h.slice(start, start + 500).match(/continuedAt="([^"]+)"/)
  if (cont) {
    const cid = cont[1]
    const cstart = h.indexOf(`<ix:continuation id="${cid}"`, start)
    const cend = h.indexOf('</ix:continuation>', cstart)
    return h.slice(cstart, cend)
  }
  return h.slice(start, end)
}

function rows(block) {
  function z(td) {
    return td.replace(/<ix:nonfraction[^>]*>([\s\S]*?)<\/ix:nonfraction>/gi, '$1')
      .replace(/<[^>]+>/g, ' ').replace(/&#160;/g,'').replace(/\s+/g,' ').trim()
  }
  for (const row of block.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => z(m[1])).filter(c => c && c !== '$')
    const ix = [...row[1].matchAll(/<ix:nonfraction[^>]*>([\s\S]*?)<\/ix:nonfraction>/gi)].map(m => m[1].replace(/<[^>]+>/g,'').replace(/,/g,'').trim())
    if (cells.length) console.log({ cells: cells.slice(0,4), ix: ix.slice(0,2) })
  }
}

for (const sym of ['MSFT', 'NOW', 'MA']) {
  console.log('\n###', sym, 'GEO ###')
  const b = await block(sym, 'RevenueFromExternalCustomersByGeographicAreasTableTextBlock')
  if (b) rows(b)
}

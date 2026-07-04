const UA = 'Omnia test@example.com'
const syms = ['MA', 'GOOGL', 'V', 'NOW', 'UNH']

async function secFetch(url) {
  return fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
}

async function html(sym) {
  const tickers = await (await secFetch('https://www.sec.gov/files/company_tickers.json')).json()
  let cik
  for (const row of Object.values(tickers)) if (row.ticker === sym) cik = row.cik_str
  const sub = await (await secFetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10,'0')}.json`)).json()
  const f = sub.filings.recent
  let acc, doc
  for (let i = 0; i < f.form.length; i++) if (f.form[i] === '10-K') { acc = f.accessionNumber[i]; doc = f.primaryDocument[i]; break }
  const accPath = acc.replace(/-/g,'')
  let pick = doc
  const idxRes = await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${acc}-index.json`)
  if (idxRes.ok) {
    try {
      const items = (await idxRes.json()).directory?.item ?? []
      const sorted = items.filter(i => /\.htm/i.test(i.name) && !/index/i.test(i.name)).sort((a,b)=>parseInt(b.size||0)-parseInt(a.size||0))
      if (sorted[0]?.name) pick = sorted[0].name
    } catch { /* use doc */ }
  }
  return await (await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${pick}`)).text()
}

for (const sym of syms) {
  const h = await html(sym)
  const tags = [...h.matchAll(/name="([^"]*(?:Segment|Geograph|RevenueFrom)[^"]*)"/gi)].map(m => m[1])
  console.log('\n', sym, [...new Set(tags)].filter(t => /TableTextBlock|DisclosureTextBlock/i.test(t)).join(' | '))
  for (const t of ['RevenueFromExternalCustomersByGeographicAreasTableTextBlock', 'ScheduleOfSegmentReportingInformationBySegmentTextBlock']) {
    console.log(' ', t, h.includes(t) ? 'YES' : 'no')
  }
}

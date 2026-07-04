import { extrahiereIxbrlTextBlock, parseGeoSegmente, parseOperatingSegmente, validiereSegmente } from '../lib/portfolio-analyse/sec-edgar-segment-extraktion.ts'

const UA = 'Omnia test@example.com'
const sym = process.argv[2] || 'GOOGL'

async function secFetch(url) {
  return fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
}

async function load(sym) {
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
      pick = items.filter(i => /\.htm/i.test(i.name) && !/index/i.test(i.name)).sort((a,b)=>b.size-a.size)[0]?.name || doc
    } catch {}
  }
  return await (await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${pick}`)).text()
}

const h = await load(sym)
for (const tag of [
  'RevenueFromExternalCustomersByGeographicAreasTableTextBlock',
  'ScheduleOfRevenuesFromExternalCustomersAndLongLivedAssetsByGeographicalAreasTableTextBlock',
  'ScheduleOfSegmentReportingInformationBySegmentTextBlock',
  'SegmentReportingDisclosureTextBlock',
]) {
  const block = extrahiereIxbrlTextBlock(h, tag)
  const op = parseOperatingSegmente(block)
  const geo = parseGeoSegmente(block, true)
  const vop = validiereSegmente(op)
  const vgeo = validiereSegmente(geo)
  console.log('\n', tag.slice(0, 60), 'block', block.length)
  console.log('  op raw', op.map(s => `${s.name}:${s.umsatzMio}`))
  console.log('  geo raw', geo.map(s => `${s.name}:${s.umsatzMio}`))
  console.log('  valid op', vop.length, 'valid geo', vgeo.length)
}

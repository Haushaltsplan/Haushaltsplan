import {
  extrahiereIxbrlTextBlock,
  parseGeoSegmente,
  parseOperatingSegmente,
  validiereSegmente,
} from '@/lib/portfolio-analyse/sec-edgar-segment-extraktion'

const UA = 'Omnia test@example.com'
const sym = process.argv[2] || 'GOOGL'

async function secFetch(url: string) {
  return fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
}

async function load(sym: string) {
  const tickers = await (await secFetch('https://www.sec.gov/files/company_tickers.json')).json()
  let cik: number | undefined
  for (const row of Object.values(tickers) as { ticker: string; cik_str: number }[]) {
    if (row.ticker === sym) cik = row.cik_str
  }
  const sub = await (
    await secFetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, '0')}.json`)
  ).json()
  const f = sub.filings.recent
  let acc = ''
  let doc = ''
  for (let i = 0; i < f.form.length; i++) {
    if (f.form[i] === '10-K') {
      acc = f.accessionNumber[i]
      doc = f.primaryDocument[i]
      break
    }
  }
  const accPath = acc.replace(/-/g, '')
  let pick = doc
  const idxRes = await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${acc}-index.json`)
  if (idxRes.ok) {
    try {
      const items = (await idxRes.json()).directory?.item ?? []
      pick =
        items
          .filter((i: { name: string }) => /\.htm/i.test(i.name) && !/index/i.test(i.name))
          .sort((a: { size: string }, b: { size: string }) => parseInt(b.size || '0') - parseInt(a.size || '0'))[0]
          ?.name || doc
    } catch {
      /* */
    }
  }
  return await (await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${pick}`)).text()
}

async function main() {
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
    const rowCount = (block.match(/<tr/gi) ?? []).length
    console.log('\n', tag.slice(0, 70), 'block', block.length, 'rows', rowCount)
    console.log('  op raw', op.map((s) => `${s.name}:${s.umsatzMio}`))
    console.log('  geo raw', geo.map((s) => `${s.name}:${s.umsatzMio}`))
    console.log('  valid op', vop.length, 'valid geo', vgeo.length)
  }
}

main().catch(console.error)

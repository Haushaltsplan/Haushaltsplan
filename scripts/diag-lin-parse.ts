import {
  extrahiereIxbrlTextBlock,
  parseMehrjahresSegmente,
  parseMehrjahresSegmenteDetail,
} from '../lib/portfolio-analyse/sec-edgar-segment-extraktion'

const UA = 'Omnia Haushalt test@example.com'
const sym = process.argv[2] ?? 'LIN'

async function secFetch(url: string) {
  return fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
}

async function main() {
  const tickers = await (await secFetch('https://www.sec.gov/files/company_tickers.json')).json()
  let cik: number | undefined
  for (const r of Object.values(tickers) as { ticker: string; cik_str: number }[]) {
    if (r.ticker === sym.toUpperCase()) cik = r.cik_str
  }
  const sub = await (await secFetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, '0')}.json`)).json()
  const f = sub.filings.recent
  let acc = ''
  let doc = ''
  for (let i = 0; i < f.form.length; i++) {
    if (f.form[i] !== '10-K') continue
    acc = f.accessionNumber[i]
    doc = f.primaryDocument[i]
    break
  }
  const accPath = acc.replace(/-/g, '')
  let pick = doc
  try {
    const idx = await (await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${acc}-index.json`)).json()
    const sorted = (idx.directory?.item ?? [])
      .filter((i: { name: string }) => /\.htm/i.test(i.name) && !/index/i.test(i.name))
      .sort((a: { size: string }, b: { size: string }) => parseInt(b.size || '0') - parseInt(a.size || '0'))
    if (sorted[0]?.name) pick = sorted[0].name
  } catch { /* */ }

  const html = await (await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${pick}`)).text()
  console.log(sym, 'html', html.length, pick)

  for (const tag of [
    'DisaggregationOfRevenueTableTextBlock',
    'ScheduleOfSegmentReportingInformationBySegmentTextBlock',
    'SegmentReportingDisclosureTextBlock',
    'RevenueFromExternalCustomersByGeographicAreasTableTextBlock',
    'ScheduleOfRevenuesFromExternalCustomersAndLongLivedAssetsByGeographicalAreasTableTextBlock',
  ]) {
    const block = extrahiereIxbrlTextBlock(html, tag)
    if (block.length < 200) continue
    const std = parseMehrjahresSegmente(block, 'produkt')
    const det = parseMehrjahresSegmenteDetail(block, 'produkt')
    const geo = parseMehrjahresSegmente(block, 'geo')
    console.log(tag, 'len', block.length)
    console.log('  std', std.map((j) => j.jahr).join(','))
    console.log('  det', det.map((j) => j.jahr).join(','))
    console.log('  geo', geo.map((j) => j.jahr).join(','))
    if (det[0]) console.log('  sample', det[det.length - 1]!.segmente.map((s) => s.name).join(' | '))
  }
}

main().catch(console.error)

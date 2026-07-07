import {
  extrahiereIxbrlTextBlock,
  parseMehrjahresSegmente,
  parseMehrjahresSegmenteDetail,
} from '../lib/portfolio-analyse/sec-edgar-segment-extraktion'

const UA = process.env.SEC_EDGAR_USER_AGENT || 'Omnia test@example.com'

async function secFetch(url: string) {
  await new Promise((r) => setTimeout(r, 350))
  return fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
}

async function main() {
  const cik = 63908
  const sub = await (await secFetch(`https://data.sec.gov/submissions/CIK0000063908.json`)).json()
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
  const idx = await (await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${acc}-index.json`)).json()
  const pick = idx.directory.item
    .filter((i: { name: string }) => /\.htm/i.test(i.name) && !/index/i.test(i.name))
    .sort((a: { size: string }, b: { size: string }) => parseInt(b.size) - parseInt(a.size))[0].name
  const html = await (await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${pick}`)).text()

  for (const tag of [
    'ScheduleOfFranchiseRevenueTableTextBlock',
    'ScheduleOfSegmentReportingInformationBySegmentTextBlock',
    'DisaggregationOfRevenueTableTextBlock',
  ]) {
    const block = extrahiereIxbrlTextBlock(html, tag)
    const std = parseMehrjahresSegmente(block, 'produkt')
    const det = parseMehrjahresSegmenteDetail(block, 'produkt')
    console.log(tag, 'len', block.length, 'std', std.map((j) => j.jahr).join(','), 'det', det.map((j) => j.jahr).join(','))
    if (std[0]) console.log('  sample', std[0].segmente.map((s) => s.name).join(' | '))
  }
}

main().catch(console.error)

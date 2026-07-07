import {
  extrahiereIxbrlTextBlock,
  parseMehrjahresSegmente,
} from '../lib/portfolio-analyse/sec-edgar-segment-extraktion.ts'
import { extrahiereAlleDetailBloeckeAus10kHtml } from '../lib/portfolio-analyse/sec-edgar-detail-extraktion.ts'

const UA = process.env.SEC_EDGAR_USER_AGENT || 'Omnia test@example.com'

async function test(cik: number, acc: string, primary: string, label: string) {
  await new Promise((r) => setTimeout(r, 500))
  const accPath = acc.replace(/-/g, '')
  const base = `https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/`
  let pick = primary
  const idx = await (await fetch(`${base}${acc}-index.json`, { headers: { 'User-Agent': UA } })).json()
  const sorted = (idx.directory?.item ?? [])
    .filter((i: { name: string }) => /\.htm/i.test(i.name) && !/index/i.test(i.name))
    .sort((a: { size: string }, b: { size: string }) => parseInt(b.size || '0') - parseInt(a.size || '0'))
  if (sorted[0]?.name) pick = sorted[0].name
  const html = await (await fetch(`${base}${pick}`, { headers: { 'User-Agent': UA } })).text()
  console.log('\n', label, 'pick', pick, 'html', html.length)
  for (const tag of [
    'ScheduleOfSegmentReportingInformationBySegmentTextBlock',
    'SegmentReportingDisclosureTextBlock',
  ]) {
    const block = extrahiereIxbrlTextBlock(html, tag)
    const jahre = parseMehrjahresSegmente(block, 'produkt')
    console.log(' ', tag.slice(0, 40), 'block', block.length, 'years', jahre.map((j) => j.jahr).join(','))
  }
  const all = extrahiereAlleDetailBloeckeAus10kHtml(html)
  const seg = all.find((k) => k.def.id === 'segment_reporting')
  console.log('  extracted segment_reporting:', seg?.jahre.map((j) => j.jahr).join(',') ?? '—')
}

async function main() {
  await test(789019, '0001564590-20-034944', 'msft-20200630.htm', 'MSFT 2020')
  await test(789019, '000095017025100235', 'msft-20250630.htm', 'MSFT 2025')
}

main().catch(console.error)

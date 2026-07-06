import { extrahiereIxbrlTextBlock, parseMehrjahresSegmenteDetail } from '../lib/portfolio-analyse/sec-edgar-segment-extraktion'

const UA = 'Omnia Haushalt test@example.com'

async function main() {
  const sub = await (await fetch('https://data.sec.gov/submissions/CIK0001707925.json', { headers: { 'User-Agent': UA } })).json()
  const f = sub.filings.recent
  let acc = ''
  for (let i = 0; i < f.form.length; i++) {
    if (f.form[i] === '10-K') { acc = f.accessionNumber[i]; break }
  }
  const html = await (await fetch(`https://www.sec.gov/Archives/edgar/data/1707925/${acc.replace(/-/g, '')}/lin-20251231.htm`, {
    headers: { 'User-Agent': UA },
  })).text()
  const block = extrahiereIxbrlTextBlock(html, 'DisaggregationOfRevenueTableTextBlock')
  const teile = block.split(/(?=Year Ended[^0-9]{0,60}(20\d{2}))/gi)
  console.log('teile', teile.length, 'block', block.length, 'years', (block.match(/Year Ended/gi) || []).length)
  const idx = block.search(/Year Ended/i)
  console.log('snippet', block.slice(idx, idx + 200).replace(/<[^>]+>/g, '|'))
  const det = parseMehrjahresSegmenteDetail(block, 'produkt')
  const geo = parseMehrjahresSegmenteDetail(block, 'geo')
  console.log('det', det.map((j) => `${j.jahr}:${j.segmente.length}`).join(' '))
  console.log('geo', geo.map((j) => `${j.jahr}:${j.segmente.map((s) => s.name).join('+')}`).join(' | '))
}

main().catch(console.error)

import { extrahiereIxbrlTextBlock } from '@/lib/portfolio-analyse/sec-edgar-segment-extraktion'

const UA = 'Omnia test@example.com'
const sym = 'V'

async function load() {
  const tickers = await (await fetch('https://www.sec.gov/files/company_tickers.json', { headers: { 'User-Agent': UA } })).json()
  let cik: number | undefined
  for (const row of Object.values(tickers) as { ticker: string; cik_str: number }[]) {
    if (row.ticker === sym) cik = row.cik_str
  }
  const sub = await (await fetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, '0')}.json`, { headers: { 'User-Agent': UA } })).json()
  const f = sub.filings.recent
  let acc = ''
  for (let i = 0; i < f.form.length; i++) if (f.form[i] === '10-K') acc = f.accessionNumber[i]
  const accPath = acc.replace(/-/g, '')
  const idx = await (await fetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${acc}-index.json`, { headers: { 'User-Agent': UA } })).json()
  const pick = idx.directory.item.filter((i: { name: string }) => /\.htm/i.test(i.name) && !/index/i.test(i.name)).sort((a: { size: string }, b: { size: string }) => parseInt(b.size || '0') - parseInt(a.size || '0'))[0].name
  return await (await fetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${pick}`, { headers: { 'User-Agent': UA } })).text()
}

async function main() {
  const h = await load()
  const i = h.search(/geographic|segment information|net revenue/i)
  console.log('snippet', h.slice(i, i + 5000).replace(/></g, '>\n<'))
  const block = extrahiereIxbrlTextBlock(h, 'SegmentReportingDisclosureTextBlock')
  console.log('block len', block.length)
}
main()

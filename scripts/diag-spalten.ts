import {
  extrahiereIxbrlTextBlock,
  parseSpaltenOrientierteSegmente,
  validiereSegmente,
} from '@/lib/portfolio-analyse/sec-edgar-segment-extraktion'

const UA = 'Omnia Haushalt test@example.com'

async function lade10kHtml(sym: string) {
  const tickers = await (await fetch('https://www.sec.gov/files/company_tickers.json', { headers: { 'User-Agent': UA } })).json()
  let cik: number | undefined
  for (const row of Object.values(tickers) as { ticker: string; cik_str: number }[]) {
    if (row.ticker === sym.toUpperCase()) cik = row.cik_str
  }
  const sub = await (await fetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, '0')}.json`, { headers: { 'User-Agent': UA } })).json()
  const f = sub.filings.recent
  let acc = ''
  let doc = ''
  for (let i = 0; i < f.form.length; i++) {
    if (f.form[i] === '10-K') { acc = f.accessionNumber[i]; doc = f.primaryDocument[i]; break }
  }
  const accPath = acc.replace(/-/g, '')
  let pick = doc
  const idxRes = await fetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${acc}-index.json`, { headers: { 'User-Agent': UA } })
  if (idxRes.ok) {
    try {
      const items = (await idxRes.json()).directory?.item ?? []
      const sorted = items.filter((i: { name: string }) => /\.htm/i.test(i.name) && !/index/i.test(i.name)).sort((a: { size: string }, b: { size: string }) => parseInt(String(b.size || 0).replace(/,/g, '')) - parseInt(String(a.size || 0).replace(/,/g, '')))
      if (sorted[0]?.name) pick = sorted[0].name
    } catch { /* */ }
  }
  return await (await fetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${pick}`, { headers: { 'User-Agent': UA } })).text()
}

async function main() {
  const sym = process.argv[2] || 'UNH'
  const h = await lade10kHtml(sym)
  const block = extrahiereIxbrlTextBlock(h, 'ScheduleOfSegmentReportingInformationBySegmentTextBlock')
  console.log('block len', block.length)
  const raw = parseSpaltenOrientierteSegmente(block)
  console.log('raw', raw)
  console.log('valid', validiereSegmente(raw))
}
main()

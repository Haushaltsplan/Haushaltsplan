import { extrahiereIxbrlTextBlock } from '@/lib/portfolio-analyse/sec-edgar-segment-extraktion'

const UA = 'Omnia test@example.com'
const sym = process.argv[2] || 'UNH'

async function load(sym: string) {
  const tickers = await (await fetch('https://www.sec.gov/files/company_tickers.json', { headers: { 'User-Agent': UA } })).json()
  let cik: number | undefined
  for (const row of Object.values(tickers) as { ticker: string; cik_str: number }[]) {
    if (row.ticker === sym) cik = row.cik_str
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
      pick = items.filter((i: { name: string }) => /\.htm/i.test(i.name) && !/index/i.test(i.name)).sort((a: { size: string }, b: { size: string }) => parseInt(b.size || '0') - parseInt(a.size || '0'))[0]?.name || doc
    } catch { /* */ }
  }
  return await (await fetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${pick}`, { headers: { 'User-Agent': UA } })).text()
}

async function main() {
  const h = await load(sym)
  const block = extrahiereIxbrlTextBlock(h, 'ScheduleOfSegmentReportingInformationBySegmentTextBlock')
    || extrahiereIxbrlTextBlock(h, 'SegmentReportingDisclosureTextBlock')
  for (const row of block.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim())
      .filter(c => c && c !== '$' && c !== '\u00a0')
    if (cells.length && /united|optum|walmart|segment|revenue|americas|u\.s/i.test(cells.join(' '))) {
      console.log(cells.slice(0,4))
    }
  }
}
main()

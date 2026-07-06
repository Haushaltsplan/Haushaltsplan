import { extrahiereIxbrlTextBlock } from '../lib/portfolio-analyse/sec-edgar-segment-extraktion'

const UA = 'Omnia Haushalt test@example.com'

async function main() {
  const sym = 'LIN'
  const tickers = await (await fetch('https://www.sec.gov/files/company_tickers.json', { headers: { 'User-Agent': UA } })).json()
  let cik: number | undefined
  for (const r of Object.values(tickers) as { ticker: string; cik_str: number }[]) {
    if (r.ticker === sym) cik = r.cik_str
  }
  const sub = await (await fetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, '0')}.json`, { headers: { 'User-Agent': UA } })).json()
  const f = sub.filings.recent
  let acc = ''
  for (let i = 0; i < f.form.length; i++) {
    if (f.form[i] === '10-K') { acc = f.accessionNumber[i]; break }
  }
  const accPath = acc.replace(/-/g, '')
  let pick = f.primaryDocument[0]
  for (let i = 0; i < f.form.length; i++) {
    if (f.form[i] === '10-K') { pick = f.primaryDocument[i]; break }
  }
  try {
    const idxRes = await fetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${acc}-index.json`, { headers: { 'User-Agent': UA } })
    if (idxRes.ok) {
      const idx = await idxRes.json()
      const sorted = (idx.directory?.item ?? [])
        .filter((i: { name: string }) => /\.htm/i.test(i.name) && !/index/i.test(i.name))
        .sort((a: { size: string }, b: { size: string }) => parseInt(b.size || '0') - parseInt(a.size || '0'))
      if (sorted[0]?.name) pick = sorted[0].name
    }
  } catch { /* */ }
  const html = await (await fetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${pick}`, { headers: { 'User-Agent': UA } })).text()
  const block = extrahiereIxbrlTextBlock(html, 'DisaggregationOfRevenueTableTextBlock')
  const rows = [...block.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
  let n = 0
  for (const row of rows) {
    const text = row[1]!.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (/202[0-9]|revenue|americas|emea|apac|segment|industrial|gas/i.test(text)) {
      console.log(text.slice(0, 250))
      if (++n >= 60) break
    }
  }
}

main().catch(console.error)

import { extrahiereAlleDetailBloeckeAus10kHtml } from '../lib/portfolio-analyse/sec-edgar-detail-extraktion.ts'

const UA = 'Omnia Haushalt test@example.com'
const sym = process.argv[2] ?? 'MSFT'

async function secFetch(url: string) {
  await new Promise((r) => setTimeout(r, 350))
  return fetch(url, { headers: { 'User-Agent': UA } })
}

async function main() {
  const tickers = await (await secFetch('https://www.sec.gov/files/company_tickers.json')).json()
  let cik = 0
  for (const r of Object.values(tickers) as { ticker: string; cik_str: number }[]) {
    if (r.ticker === sym) cik = r.cik_str
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
  const idx = await (await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${acc}-index.json`)).json()
  const pick = idx.directory.item
    .filter((i: { name: string }) => /\.htm/i.test(i.name) && !/index/i.test(i.name))
    .sort((a: { size: string }, b: { size: string }) => parseInt(b.size) - parseInt(a.size))[0].name
  const html = await (await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${pick}`)).text()
  const d = extrahiereAlleDetailBloeckeAus10kHtml(html)
  for (const k of d) {
    console.log(k.def.id, k.def.tag, '→', k.jahre.map((j) => j.jahr).join(', '))
  }
}

main().catch(console.error)

import { extrahiereAlleDetailBloeckeAus10kHtml } from '../lib/portfolio-analyse/sec-edgar-detail-extraktion.ts'

const UA = process.env.SEC_EDGAR_USER_AGENT || 'Omnia test@example.com'
const sym = process.argv[2] ?? 'MSFT'
const reportYear = process.argv[3] ?? '2020'

async function secFetch(url: string) {
  await new Promise((r) => setTimeout(r, 350))
  return fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
}

async function pickHtml(cik: number, acc: string, primary: string) {
  const accPath = acc.replace(/-/g, '')
  const base = `https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/`
  let pick = primary
  const idx = await (await secFetch(`${base}${acc}-index.json`)).json()
  const sorted = (idx.directory?.item ?? [])
    .filter((i: { name: string }) => /\.htm/i.test(i.name) && !/index/i.test(i.name))
    .sort((a: { size: string }, b: { size: string }) => parseInt(b.size || '0') - parseInt(a.size || '0'))
  if (sorted[0]?.name) pick = sorted[0].name
  return await (await secFetch(`${base}${pick}`)).text()
}

async function main() {
  const tickers = await (await secFetch('https://www.sec.gov/files/company_tickers.json')).json()
  let cik = 0
  for (const r of Object.values(tickers) as { ticker: string; cik_str: number }[]) {
    if (r.ticker === sym.toUpperCase()) cik = r.cik_str
  }
  const sub = await (await secFetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, '0')}.json`)).json()
  const f = sub.filings.recent
  for (let i = 0; i < f.form.length; i++) {
    if (f.form[i] !== '10-K') continue
    const report = f.reportDate?.[i]?.slice(0, 4)
    if (report !== reportYear) continue
    const html = await pickHtml(cik, f.accessionNumber[i], f.primaryDocument[i])
    const d = extrahiereAlleDetailBloeckeAus10kHtml(html)
    console.log(sym, 'report', report, 'html', html.length)
    for (const k of d) {
      if (k.def.id === 'segment_reporting' || k.def.id === 'umsatz_detail') {
        console.log(' ', k.def.id, k.jahre.map((j) => j.jahr).join(', '))
      }
    }
    return
  }
  console.log('filing not found')
}

main().catch(console.error)

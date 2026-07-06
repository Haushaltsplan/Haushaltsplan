import { extrahiereAlleDetailBloeckeAus10kHtml } from '../lib/portfolio-analyse/sec-edgar-detail-extraktion'

const UA = 'Omnia Haushalt test@example.com'
const sym = process.argv[2] ?? 'ROL'

async function secFetch(url: string) {
  return fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
}

async function main() {
  const tickers = await (await secFetch('https://www.sec.gov/files/company_tickers.json')).json()
  let cik: number | undefined
  for (const r of Object.values(tickers) as { ticker: string; cik_str: number }[]) {
    if (r.ticker === sym.toUpperCase()) cik = r.cik_str
  }
  console.log('cik', cik)
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
  const base = `https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/`

  const picks: string[] = [doc]
  const htm = await (await secFetch(`${base}${acc}-index.htm`)).text()
  for (const m of htm.matchAll(/href="([^"]+\.htm)"/gi)) {
    const name = m[1]!.split('/').pop() ?? m[1]!
    if (!/index/i.test(name) && !picks.includes(name)) picks.push(name)
  }

  for (const pick of picks.slice(0, 4)) {
    const html = await (await secFetch(`${base}${pick}`)).text()
    const details = extrahiereAlleDetailBloeckeAus10kHtml(html)
    const max = details.length ? Math.max(...details.flatMap((d) => d.jahre.map((j) => j.jahr))) : 0
    console.log(pick, 'len', html.length, 'blocks', details.length, 'max', max)
  }
}

main().catch(console.error)

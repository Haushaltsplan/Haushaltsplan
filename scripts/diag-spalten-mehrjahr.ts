import {
  extrahiereIxbrlTextBlock,
  parseMehrjahresSegmente,
} from '../lib/portfolio-analyse/sec-edgar-segment-extraktion'

const UA = 'Omnia Haushalt test@example.com'
const sym = process.argv[2] ?? 'UNH'

async function secFetch(url: string) {
  return fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
}

async function main() {
  const tickers = await (await secFetch('https://www.sec.gov/files/company_tickers.json')).json()
  let cik: number | undefined
  for (const r of Object.values(tickers) as { ticker: string; cik_str: number }[]) {
    if (r.ticker === sym.toUpperCase()) cik = r.cik_str
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
  const html = await (await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${doc}`)).text()
  const block = extrahiereIxbrlTextBlock(html, 'ScheduleOfSegmentReportingInformationBySegmentTextBlock')
  const jahre = parseMehrjahresSegmente(block, 'produkt')
  console.log(sym, 'jahre:', jahre.length, jahre.map((j) => j.jahr).join(', '))
  for (const j of jahre) {
    console.log(` ${j.jahr}:`, j.segmente.map((s) => `${s.name}=${s.umsatzMio}`).join(' | '))
  }
}

main().catch(console.error)

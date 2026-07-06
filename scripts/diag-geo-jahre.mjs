/**
 * Debug: pro Jahr Validierung in Geo-Tabelle
 */
import {
  extrahiereIxbrlTextBlock,
  parseMehrjahresSegmente,
} from '../lib/portfolio-analyse/sec-edgar-segment-extraktion'

const UA = 'Omnia test@example.com'
const sym = process.argv[2] ?? 'GOOGL'
const tag = process.argv[3] ?? 'RevenueFromExternalCustomersByGeographicAreasTableTextBlock'

async function secFetch(url: string) {
  return fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
}

const tickers = await (await secFetch('https://www.sec.gov/files/company_tickers.json')).json()
let cik: number | undefined
for (const row of Object.values(tickers) as { ticker: string; cik_str: number }[]) {
  if (row.ticker === sym.toUpperCase()) cik = row.cik_str
}
const sub = await (await secFetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, '0')}.json`)).json()
const f = sub.filings.recent
let acc = ''
let doc = ''
for (let i = 0; i < f.form.length; i++) {
  if (f.form[i] !== '10-K') { continue }
  acc = f.accessionNumber[i]
  doc = f.primaryDocument[i]
  break
}
const html = await (await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${acc.replace(/-/g, '')}/${doc}`)).text()
const block = extrahiereIxbrlTextBlock(html, tag)
console.log('block len', block.length)
const jahre = parseMehrjahresSegmente(block, 'geo')
console.log('parsed years:', jahre.map((j) => j.jahr))
for (const j of jahre) {
  console.log(`\n${j.jahr}:`)
  for (const s of j.segmente) console.log(`  ${s.name}: ${s.umsatzMio} (${s.anteilPct}%)`)
}

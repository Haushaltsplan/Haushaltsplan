/**
 * Diagnose: welche Jahre fehlen in SEC-Segment-Tabellen?
 * npx tsx scripts/diag-jahre-fehlen.ts GOOGL MSFT MA V UNH
 */
import { extrahiereAlleDetailBloeckeAus10kHtml } from '../lib/portfolio-analyse/sec-edgar-detail-extraktion'

const UA = process.env.SEC_EDGAR_USER_AGENT || 'Omnia Haushalt test@example.com'
const TICKERS = process.argv.slice(2).length ? process.argv.slice(2) : ['GOOGL', 'MSFT', 'MA', 'V']

async function secFetch(url: string) {
  return fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, cache: 'no-store' })
}

async function cik(sym: string) {
  const tickers = await (await secFetch('https://www.sec.gov/files/company_tickers.json')).json()
  for (const row of Object.values(tickers) as { ticker: string; cik_str: number }[]) {
    if (row.ticker === sym.toUpperCase()) return row.cik_str
  }
  return null
}

async function ladeNeuestes10kHtml(c: number) {
  const sub = await (await secFetch(`https://data.sec.gov/submissions/CIK${String(c).padStart(10, '0')}.json`)).json()
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
  const idxRes = await secFetch(`https://www.sec.gov/Archives/edgar/data/${c}/${accPath}/${acc}-index.json`)
  let pick = doc
  if (idxRes.ok) {
    const items = (await idxRes.json()).directory?.item ?? []
    const sorted = items
      .filter((i: { name: string }) => /\.htm/i.test(i.name) && !/index/i.test(i.name))
      .sort((a: { size: string }, b: { size: string }) => parseInt(b.size || '0') - parseInt(a.size || '0'))
    if (sorted[0]?.name) pick = sorted[0].name
  }
  const html = await (await secFetch(`https://www.sec.gov/Archives/edgar/data/${c}/${accPath}/${pick}`)).text()
  const reportDate = f.reportDate?.[f.accessionNumber.indexOf(acc)] ?? f.reportDate?.[0]
  return { html, reportDate }
}

async function main() {
  for (const sym of TICKERS) {
    const c = await cik(sym)
    if (!c) continue
    const { html, reportDate } = await ladeNeuestes10kHtml(c)
    const details = extrahiereAlleDetailBloeckeAus10kHtml(html)
    console.log(`\n=== ${sym} (10-K report ${reportDate?.slice(0, 4) ?? '?'}) ===`)
    for (const d of details) {
      const jahre = d.jahre.map((j) => j.jahr).sort((a, b) => a - b)
      const max = jahre[jahre.length - 1] ?? 0
      const fehlt2025 = !jahre.includes(2025)
      const fehlt2024 = !jahre.includes(2024)
      const flag = fehlt2025 || (max < 2024 && jahre.length > 0) ? ' ⚠️' : ''
      console.log(`  ${d.def.id}: ${jahre.length}J [${jahre.join(', ')}]${flag}`)
    }
  }
}

main().catch(console.error)

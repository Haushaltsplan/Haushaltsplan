/**
 * Simuliert Historie-Merge über mehrere 10-Ks
 */
import { extrahiereAlleDetailBloeckeAus10kHtml, mergeDetailInMap } from '../lib/portfolio-analyse/sec-edgar-detail-extraktion'

const UA = process.env.SEC_EDGAR_USER_AGENT || 'test@example.com'
const sym = process.argv[2] ?? 'GOOGL'
const katId = process.argv[3] ?? 'geo_umsatz'

async function secFetch(url: string) {
  return fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
}

async function main() {
  const tickers = await (await secFetch('https://www.sec.gov/files/company_tickers.json')).json()
  let cik: number | null = null
  for (const row of Object.values(tickers) as { ticker: string; cik_str: number }[]) {
    if (row.ticker === sym.toUpperCase()) cik = row.cik_str
  }
  if (!cik) return

  const sub = await (await secFetch(`https://data.sec.gov/submissions/CIK${String(cik).padStart(10, '0')}.json`)).json()
  const f = sub.filings.recent
  const filings: { acc: string; doc: string; report: string }[] = []
  for (let i = 0; i < f.form.length && filings.length < 14; i++) {
    if (f.form[i] !== '10-K') continue
    filings.push({ acc: f.accessionNumber[i], doc: f.primaryDocument[i], report: f.reportDate[i] })
  }

  const maps = new Map()
  const meta = new Map()

  for (let i = 0; i < filings.length; i++) {
    const fl = filings[i]!
    if (i > 0) await new Promise((r) => setTimeout(r, 300))
    const html = await (await secFetch(`https://www.sec.gov/Archives/edgar/data/${cik}/${fl.acc.replace(/-/g, '')}/${fl.doc}`)).text()
    if (html.length < 5000) continue
    const filingJahr = parseInt(fl.report.slice(0, 4), 10)
    const details = extrahiereAlleDetailBloeckeAus10kHtml(html)
    for (const d of details) {
      if (d.def.id === katId) mergeDetailInMap(maps, d, filingJahr, meta)
    }
  }

  const m = maps.get(katId)
  if (!m) {
    console.log('keine Daten für', katId)
    return
  }
  const jahre = [...m.keys()].sort((a, b) => a - b)
  console.log(`${sym} ${katId}: ${jahre.length}J [${jahre[0]}–${jahre[jahre.length - 1]}]`)
  console.log('  alle:', jahre.join(', '))
  const max = jahre[jahre.length - 1]!
  if (max < 2025) console.log('  ⚠️ fehlt 2025')
}

main().catch(console.error)

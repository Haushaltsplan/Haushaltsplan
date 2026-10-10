/**
 * npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/diag-ma-index-items.ts
 */
import { cikFuerTicker, secFetch } from '../lib/portfolio-analyse/sec-edgar-common-server'
import {
  ladeFilingIndexItems,
  waehleLesbaresBerichtDokument,
} from '../lib/portfolio-analyse/sec-edgar-bericht-text-server'

async function main() {
  const cik = await cikFuerTicker('MA')
  const accession = '0001141391-26-000013'
  const items = await ladeFilingIndexItems(accession, cik)
  console.log('items', items.length)
  for (const i of items) {
    const name = i.name ?? ''
    if (!/\.(htm|html)$/i.test(name)) continue
    console.log(`${String(i.size).padStart(12)} | ${(i.type ?? '').padEnd(8)} | ${name}`)
  }
  const pick = waehleLesbaresBerichtDokument(items, '10-K', 'ma-20251231.htm')
  console.log('\nwaehle →', pick)

  // Fetch primary vs pick content lengths
  for (const doc of ['ma-20251231.htm', pick, 'Financial_Report.xlsx'].filter(Boolean)) {
    const url = `https://www.sec.gov/Archives/edgar/data/${cik}/000114139126000013/${doc}`
    const res = await secFetch(url)
    const body = res.ok ? await res.text() : ''
    console.log(doc, 'status', res.status, 'len', body.length, 'Payment', body.includes('Payment network'))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

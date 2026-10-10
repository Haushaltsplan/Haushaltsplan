/**
 * npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/diag-ma-filing-docs.ts
 */
import { cikFuerTicker, padCik, secFetch } from '../lib/portfolio-analyse/sec-edgar-common-server'
import { leseAlsJson } from '../lib/http/safe-json-response'
import { ladeLesbarenBerichtText } from '../lib/portfolio-analyse/sec-edgar-bericht-text-server'

async function main() {
  const cik = await cikFuerTicker('MA')!
  const accession = '0001141391-26-000013'
  const accPath = accession.replace(/-/g, '')
  const idxUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${accession}-index.json`
  const idxRes = await secFetch(idxUrl)
  const idx = (await leseAlsJson<{ directory?: { item?: { name: string; size?: string; type?: string }[] } }>(
    idxRes,
  )) ?? {}
  const items = idx.directory?.item ?? []
  const htmlish = items
    .filter((i) => /\.(htm|html)$/i.test(i.name))
    .sort((a, b) => Number(b.size ?? 0) - Number(a.size ?? 0))
  console.log(
    'HTML docs by size:\n',
    htmlish
      .slice(0, 15)
      .map((i) => `${i.size}\t${i.name}`)
      .join('\n'),
  )

  const bericht = await ladeLesbarenBerichtText(cik!, accession, '10-K', 'ma-20251231.htm')
  console.log('\nladeLesbarenBerichtText →', bericht?.documentName, 'url', bericht?.url, 'textLen', bericht?.text.length)

  if (bericht?.url) {
    const r = await secFetch(bericht.url)
    const html = r.ok ? await r.text() : ''
    console.log('fetched html len', html.length)
    console.log('has Payment network', html.includes('Payment network'))
    console.log('has Net revenue', /net revenue/i.test(html))
  }

  // Try largest html manually
  const largest = htmlish[0]
  if (largest) {
    const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/${largest.name}`
    const r = await secFetch(url)
    const html = r.ok ? await r.text() : ''
    console.log('\nlargest', largest.name, 'len', html.length, 'Payment network', html.includes('Payment network'))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

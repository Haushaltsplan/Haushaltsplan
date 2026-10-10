/**
 * npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/diag-ma-10q-headers.ts
 */
import { cikFuerTicker, secFetch } from '../lib/portfolio-analyse/sec-edgar-common-server'
import { ladeLesbarenBerichtText } from '../lib/portfolio-analyse/sec-edgar-bericht-text-server'
import { extrahiereIxbrlTextBlock } from '../lib/portfolio-analyse/sec-edgar-segment-extraktion'

async function main() {
  const cik = await cikFuerTicker('MA')!
  const bericht = await ladeLesbarenBerichtText(cik!, '0001141391-26-000083', '10-Q', 'ma-20260630.htm')
  const html = bericht?.url ? await (await secFetch(bericht.url)).text() : ''
  const block = extrahiereIxbrlTextBlock(html, 'DisaggregationOfRevenueTableTextBlock')
  console.log('block len', block.length)

  // Print first table-ish rows as text snippets around year headers
  const lines = block
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 5)

  for (const l of lines.slice(0, 40)) {
    if (/three|six|nine|month|2025|2026|payment|ended/i.test(l)) console.log(l.slice(0, 200))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

/**
 * npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/diag-ma-10q-cols.ts
 */
import { cikFuerTicker, secFetch } from '../lib/portfolio-analyse/sec-edgar-common-server'
import { ladeLesbarenBerichtText } from '../lib/portfolio-analyse/sec-edgar-bericht-text-server'
import { extrahiereIxbrlTextBlock } from '../lib/portfolio-analyse/sec-edgar-segment-extraktion'

// Local copy of row parser via dynamic - use HTML table dump
async function main() {
  const cik = await cikFuerTicker('MA')!
  const bericht = await ladeLesbarenBerichtText(cik!, '0001141391-26-000083', '10-Q', 'ma-20260630.htm')
  const html = bericht?.url ? await (await secFetch(bericht.url)).text() : ''
  const block = extrahiereIxbrlTextBlock(html, 'DisaggregationOfRevenueTableTextBlock')

  const rows = [...block.matchAll(/<tr[\s\S]*?<\/tr>/gi)].slice(0, 12)
  for (let ri = 0; ri < rows.length; ri++) {
    const cells = [...rows[ri]![0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      c[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 40),
    )
    if (cells.some((c) => /2025|2026|Payment|Three|Six|Americas|Value/i.test(c))) {
      console.log(`R${ri}:`, cells.join(' | '))
    }
  }
}

main().catch(console.error)

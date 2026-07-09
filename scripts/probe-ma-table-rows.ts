/** Parse MS financial table rows for MA. */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function main() {
  const html = await fetch('https://www.marketscreener.com/quote/stock/MASTERCARD-INC-17163/finances-segments/', {
    headers: { 'User-Agent': UA, Referer: 'https://www.marketscreener.com/' },
  }).then((r) => r.text())

  const tableIdx = html.indexOf('Breakdown by Business Segment (USD)')
  const chunk = html.slice(tableIdx, tableIdx + 12000)
  for (const row of chunk.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      c[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    )
    if (cells.length >= 2 && !/fiscal period/i.test(cells[0] ?? '')) {
      console.log(cells.slice(0, 4).join(' | '), '... last:', cells.at(-1))
    }
  }

  // SA with mock-server-only pattern
  const paths = [
    'https://stockanalysis.com/stocks/ma/metrics/revenue-by-segment/',
    'https://stockanalysis.com/quote/nyse/ma/metrics/revenue-by-segment/',
  ]
  const { extrahiereStockanalysisSegmentHistorieAusHtml } = await import(
    '../lib/portfolio-analyse/stockanalysis-segment-parser'
  )
  for (const url of paths) {
    try {
      const h = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'text/html' },
        signal: AbortSignal.timeout(30_000),
      }).then((r) => r.text())
      console.log('\nSA', url, 'len', h.length)
      const p = extrahiereStockanalysisSegmentHistorieAusHtml(h, 'produkt', 'MA')
      console.log('parsed', p?.segmentNamen, p?.jahre.at(-1)?.segmente.map((s) => s.name))
    } catch (e) {
      console.log('SA fail', url, e)
    }
  }
}

main().catch(console.error)

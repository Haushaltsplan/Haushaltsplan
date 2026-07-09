/** Dump raw MS segment sources for Mastercard. */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function main() {
  const slug = 'MASTERCARD-INC-17163'
  const html = await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`, {
    headers: { 'User-Agent': UA, Referer: 'https://www.marketscreener.com/' },
  }).then((r) => r.text())

  const chartIds = [
    'financialSegmentCA1',
    'financialSegmentRevenueChar1',
    'financialSegmentCA2',
    'financialSegmentRevenueChar2',
  ]
  for (const id of chartIds) {
    const m = html.match(new RegExp(`id="${id}"[\\s\\S]{0,2000}`, 'i'))
    if (!m) {
      console.log(id, ': not found')
      continue
    }
    const names = [...m[0].matchAll(/"name":"([^"]+)"/g)].map((x) => x[1])
    console.log(id, 'names:', names.join(' | ') || '(none in snippet)')
  }

  const headings = [...html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, ' ').trim(),
  )
  console.log('\nheadings:', headings.filter((h) => /segment|breakdown|geograph/i.test(h)).slice(0, 12))

  const { extrahiereMsSegmentHistorien } = await import('../lib/portfolio-analyse/marketscreener-segment-parser')
  const { produkt, geo } = extrahiereMsSegmentHistorien(html)
  console.log('\nparsed produkt segs:', produkt?.segmentNamen)
  console.log('parsed geo segs:', geo?.segmentNamen)

  // SA metrics
  const saHtml = await fetch('https://stockanalysis.com/stocks/ma/metrics/revenue-by-segment/', {
    headers: { 'User-Agent': UA },
  }).then((r) => r.text())
  const { extrahiereStockanalysisSegmentHistorieAusHtml } = await import(
    '../lib/portfolio-analyse/stockanalysis-segment-parser'
  )
  const sa = extrahiereStockanalysisSegmentHistorieAusHtml(saHtml, 'produkt', 'MA')
  console.log('\nSA segs:', sa?.segmentNamen)
  console.log('SA FY', sa?.jahre.at(-1)?.segmente.map((s) => `${s.name} ${s.anteilPct?.toFixed(0)}%`))
}

main().catch(console.error)

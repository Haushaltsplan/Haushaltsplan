/** npx tsx scripts/test-sa-segment-parser.ts */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function fetchHtml(slug: string) {
  const res = await fetch(`https://stockanalysis.com/stocks/${slug}/metrics/revenue-by-segment/`, {
    headers: { 'User-Agent': UA },
  })
  return res.text()
}

async function main() {
  const { extrahiereStockanalysisSegmentHistorieAusHtml } = await import(
    '../lib/portfolio-analyse/stockanalysis-segment-parser'
  )
  const { extrahiereStockanalysisBacklogAusHtml } = await import(
    '../lib/portfolio-analyse/stockanalysis-backlog-parser'
  )

  for (const slug of ['msft', 'now', 'anet']) {
    const [segHtml, metHtml] = await Promise.all([
      fetchHtml(slug),
      fetch(`https://stockanalysis.com/stocks/${slug}/metrics/`, { headers: { 'User-Agent': UA } }).then((r) =>
        r.text(),
      ),
    ])
    const seg = extrahiereStockanalysisSegmentHistorieAusHtml(segHtml)
    const backlog = extrahiereStockanalysisBacklogAusHtml(metHtml)
    console.log('\n', slug.toUpperCase())
    console.log('  produkt', seg?.anzahlJahre, seg?.segmentNamen?.join(' | '))
    console.log('  jahre', seg?.jahre.map((j) => j.jahr).join(', '))
    console.log('  backlog', backlog?.label, backlog?.anzahlJahre)
  }
}

main()

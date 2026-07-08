/** npx tsx scripts/probe-backlog-googl.ts */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function main() {
  const { extrahiereMarketbeatBacklogAusHtml } = await import('../lib/portfolio-analyse/marketbeat-backlog-parser')
  const { extrahiereStockanalysisBacklogAusHtml } = await import('../lib/portfolio-analyse/stockanalysis-backlog-parser')

  for (const [ex, sym] of [
    ['NASDAQ', 'GOOGL'],
    ['NASDAQ', 'NOW'],
    ['NASDAQ', 'MSFT'],
  ] as const) {
    const html = await fetch(`https://www.marketbeat.com/stocks/${ex}/${sym}/financials/`, {
      headers: { 'User-Agent': UA },
    }).then((r) => r.text())
    const mb = extrahiereMarketbeatBacklogAusHtml(html)
    console.log('\n=== MB', sym, '===')
    console.log(mb?.quelleTag, mb?.label)
    console.log(mb?.eintraege.map((e) => `${e.jahr}: ${e.wertMio}`).join(', '))
  }

  for (const slug of ['googl', 'now', 'msft']) {
    const html = await fetch(`https://stockanalysis.com/stocks/${slug}/metrics/`, {
      headers: { 'User-Agent': UA },
    }).then((r) => r.text())
    const sa = extrahiereStockanalysisBacklogAusHtml(html)
    console.log('\n=== SA', slug, '===')
    console.log(sa?.quelleTag, sa?.label)
    console.log(sa?.eintraege.map((e) => `${e.jahr}: ${e.wertMio}`).join(', '))
    const labels = [...html.matchAll(/>([^<]{10,80}(?:backlog|Backlog|RPO|Deferred|Performance)[^<]{0,40})</gi)].map(
      (m) => m[1]!.trim(),
    )
    console.log('labels on page:', [...new Set(labels)].slice(0, 10))
  }
}

main()

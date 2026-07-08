/** npx tsx scripts/test-backlog-fixed.ts */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function test(ticker: string, slug: string) {
  const { extrahiereStockanalysisBacklogAusHtml } = await import('../lib/portfolio-analyse/stockanalysis-backlog-parser')
  const { extrahiereMarketbeatBacklogAusHtml } = await import('../lib/portfolio-analyse/marketbeat-backlog-parser')

  const saHtml = await fetch(`https://stockanalysis.com/stocks/${slug}/metrics/`, { headers: { 'User-Agent': UA } }).then(
    (r) => r.text(),
  )
  const mbHtml = await fetch(`https://www.marketbeat.com/stocks/NASDAQ/${ticker}/financials/`, {
    headers: { 'User-Agent': UA },
  }).then((r) => r.text())

  const sa = extrahiereStockanalysisBacklogAusHtml(saHtml, ticker)
  const mb = extrahiereMarketbeatBacklogAusHtml(mbHtml)
  console.log('\n===', ticker, '===')
  console.log('SA', sa?.quelleTag, sa?.eintraege.map((e) => `${e.jahr}: ${e.wertMio}M`).join(', '))
  console.log('MB', mb?.quelleTag ?? 'null')
}

async function main() {
  await test('GOOGL', 'googl')
  await test('NOW', 'now')
  await test('MSFT', 'msft')
}

main()

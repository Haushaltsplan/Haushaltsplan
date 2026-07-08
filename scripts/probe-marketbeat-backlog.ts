/** npx tsx scripts/probe-marketbeat-backlog.ts */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function scan(ticker: string, exchange = 'NYSE') {
  const html = await fetch(`https://www.marketbeat.com/stocks/${exchange}/${ticker}/financials/`, {
    headers: { 'User-Agent': UA },
  }).then((r) => r.text())

  const years = [...html.matchAll(/<th[^>]*>\s*(20\d{2})\s*<\/th>/g)].map((m) => Number(m[1]))
  console.log('\n', ticker, 'years', years.slice(0, 15))

  for (const m of html.matchAll(/<tr[^>]*id="(row-[^"]+)"[\s\S]*?<\/tr>/gi)) {
    const row = m[0]
    const id = m[1]
    if (!/backlog|deferred|remaining|order book|rpo|unearned|contract/i.test(row)) continue
    const label = row.match(/<td[^>]*>(?:<div[^>]*><\/div>)?([^<]+)<\/td>/)?.[1]?.trim()
    const vals = [...row.matchAll(/data-value="([^"]+)"/g)].map((x) => x[1])
    console.log(' ', id, label, vals.slice(0, 12))
  }
}

async function main() {
  await scan('NOW')
  await scan('MSFT', 'NASDAQ')
  await scan('ANET', 'NYSE')
  await scan('DDOG', 'NASDAQ')
}

main()

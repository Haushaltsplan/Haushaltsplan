/** npx tsx scripts/probe-backlog-sources.ts */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function probe(name: string, url: string) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
    const html = await r.text()
    const bl = [...html.matchAll(/backlog|order book|remaining performance|deferred revenue|RPO/gi)].length
    const years = [...html.matchAll(/\b(20\d{2})\b/g)].length
    console.log(name, r.status, html.length, 'mentions', bl, 'years', years)
    if (bl > 0) {
      const i = html.toLowerCase().search(/backlog|remaining performance|deferred revenue/)
      if (i >= 0) console.log('  ctx:', html.slice(i, i + 200).replace(/\s+/g, ' '))
    }
  } catch (e) {
    console.log(name, 'ERR', e)
  }
}

async function main() {
  const t = 'NOW'
  await probe('finviz', `https://finviz.com/quote.ashx?t=${t}`)
  await probe('stockanalysis-fin', `https://stockanalysis.com/stocks/${t.toLowerCase()}/financials/`)
  await probe('stockanalysis-metrics', `https://stockanalysis.com/stocks/${t.toLowerCase()}/metrics/`)
  await probe('marketbeat', `https://www.marketbeat.com/stocks/NYSE/${t}/financials/`)
  await probe('csimarket', `https://csimarket.com/stocks/singleFinancials.php?code=${t}`)
  await probe('gurufocus', `https://www.gurufocus.com/stock/${t}/financials`)
  await probe('macrotrends-rpo', `https://www.macrotrends.net/stocks/charts/${t}/servicenow/revenue-remaining-performance-obligation`)
  await probe('macrotrends-deferred', `https://www.macrotrends.net/stocks/charts/${t}/servicenow/deferred-revenue`)
  await probe('wsj', `https://www.wsj.com/market-data/quotes/${t}/financials`)
  await probe('ms-company', `https://www.marketscreener.com/quote/stock/SERVICENOW-INC-10912979/company/`)
  await probe('ms-finances-ratios', `https://www.marketscreener.com/quote/stock/SERVICENOW-INC-10912979/finances/`)
}

main()

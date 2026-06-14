// Search DWS/Xtrackers pages for product API
const isin = 'IE00BLNMYC90'
const pages = [
  `https://etf.dws.com/en-gb/Institutional/Products/263206/${isin}-xtrackers-sp-500-equal-weight-ucits-etf-1c/`,
  `https://etf.dws.com/en-gb/Institutional/Products/263206/IE00BLNMYC90-Xtrackers-S-P-500-Equal-Weight-UCITS-ETF-1C/`,
  `https://www.xtrackers.com/en/individual/products/263206/IE00BLNMYC90`,
]

for (const url of pages) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' })
    const t = await r.text()
    console.log('\n', url, '->', r.url, r.status, t.length)
    for (const term of ['holdings', 'Top 10', 'composition', 'api/', 'graphql', 'NVIDIA', 'Apple', '__NEXT_DATA__', 'productId']) {
      if (t.includes(term)) console.log(' ', term)
    }
    const next = t.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
    if (next) {
      const j = JSON.parse(next[1])
      console.log(' NEXT page', j.page)
      const s = JSON.stringify(j)
      const i = s.search(/hold|compos|weight/i)
      if (i >= 0) console.log(' ', s.slice(i, i + 400))
    }
  } catch (e) {
    console.log(url, e.message)
  }
}

// try dws fund data api patterns
for (const url of [
  `https://etf.dws.com/etf-data-api/v1/etfs/${isin}/holdings`,
  `https://etf.dws.com/api/etf/${isin}/holdings`,
  `https://www.dws.com/.rest/etf/v1/products/${isin}`,
  `https://www.dws.com/etf-data/v1/holdings?isin=${isin}`,
]) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } })
    console.log('\n', url, r.status, (await r.text()).slice(0, 300))
  } catch (e) {
    console.log(url, e.message)
  }
}

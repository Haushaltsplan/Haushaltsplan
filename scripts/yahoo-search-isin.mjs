const isin = 'IE00BJXRZJ40'
const u = new URL('https://query1.finance.yahoo.com/v1/finance/search')
u.searchParams.set('q', isin)
u.searchParams.set('quotesCount', '10')
const res = await fetch(u.toString(), {
  headers: {
    'User-Agent': 'Mozilla/5.0',
    Referer: 'https://finance.yahoo.com/',
  },
})
const j = await res.json()
for (const q of j.quotes ?? []) {
  console.log(q.symbol, q.quoteType, q.exchange, q.longname?.slice(0, 50))
}

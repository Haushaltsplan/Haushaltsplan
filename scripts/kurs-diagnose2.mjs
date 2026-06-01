const isins = ['FR0000052292', 'IE00BLNMYC90', 'US5801351017']

const res = await fetch('https://api.openfigi.com/v3/mapping', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(isins.map((idValue) => ({ idType: 'ID_ISIN', idValue }))),
})
const rows = await res.json()
for (let i = 0; i < isins.length; i++) {
  console.log('\n', isins[i], 'hits:', rows[i]?.data?.slice(0, 5).map((r) => `${r.ticker}/${r.exchCode}`))
}

const u = new URL('https://query1.finance.yahoo.com/v1/finance/search')
for (const isin of isins) {
  u.searchParams.set('q', isin)
  u.searchParams.set('quotesCount', '8')
  const j = await (await fetch(u.toString(), { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://finance.yahoo.com/' } })).json()
  console.log('\nYahoo', isin, j.quotes?.map((q) => `${q.symbol} ${q.quoteType} ${q.exchange}`))
}

// Batch alignment test
const batch = ['HMI.DE', 'XDEW.DE', 'MDO.DE', 'INVALID999', 'MCD']
const spark = new URL('https://query1.finance.yahoo.com/v7/finance/spark')
spark.searchParams.set('symbols', batch.join(','))
const sj = await (await fetch(spark.toString(), { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://finance.yahoo.com/' } })).json()
sj.spark?.result?.forEach((r, i) => {
  console.log('batch idx', i, 'requested', batch[i], 'returned sym', r.symbol, 'price', r.response?.[0]?.meta?.regularMarketPrice)
})

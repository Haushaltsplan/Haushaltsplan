const urls = [
  'https://stockanalysis.com/list/nasdaq-100-stocks/',
  'https://stockanalysis.com/list/sp-500-stocks/',
  'https://www.nasdaq.com/market-activity/quotes/nasdaq-100',
  'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=ndx_100&count=100',
  'https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=sp_500&count=500',
]

for (const url of urls) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json, text/html' },
    })
    const ct = r.headers.get('content-type') || ''
    const t = await r.text()
    console.log('\n', url.split('?')[0], r.status, ct.slice(0, 35), t.length)
    if (ct.includes('json')) {
      const j = JSON.parse(t)
      const quotes = j.finance?.result?.[0]?.quotes ?? j.quotes
      console.log('quotes', quotes?.length, quotes?.[0]?.symbol, quotes?.[0]?.longName)
    } else if (t.includes('NVIDIA') || t.includes('Apple')) {
      console.log('has big tech')
      const syms = [...t.matchAll(/data-symbol="([A-Z.]+)"/g)].slice(0, 5).map((m) => m[1])
      console.log('syms', syms)
    }
  } catch (e) {
    console.log(url, e.message)
  }
}

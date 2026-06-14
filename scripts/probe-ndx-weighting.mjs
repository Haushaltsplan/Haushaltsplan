const urls = [
  'https://indexes.nasdaqomx.com/Index/Weighting/NDX',
  'https://www.nasdaq.com/api/quote/list-type/nasdaq100',
  'https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=101&offset=0&download=true',
]

for (const url of urls) {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json, text/html',
        Origin: 'https://www.nasdaq.com',
        Referer: 'https://www.nasdaq.com/',
      },
    })
    const ct = r.headers.get('content-type') || ''
    const t = await r.text()
    console.log('\n', url, r.status, ct.slice(0, 40), t.length)
    console.log(t.slice(0, 500))
  } catch (e) {
    console.log(url, e.message)
  }
}

// SSGA nasdaq related files
for (const sym of ['oneq', 'qqq', 'qqqm', 'ndqw', 'ndxp']) {
  const url = `https://www.ssga.com/library-content/products/fund-data/etfs/us/holdings-daily-us-en-${sym}.xlsx`
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (r.status === 200) console.log('SSGA', sym, (await r.arrayBuffer()).byteLength)
}

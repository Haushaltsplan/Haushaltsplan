for (const ext of ['csv', 'xlsx', 'txt']) {
  const url = `https://www.ssga.com/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.${ext}`
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  console.log(ext, r.status, r.headers.get('content-type')?.slice(0, 40), (await r.arrayBuffer()).byteLength)
}

// try BlackRock iShares CSPX (S&P 500 UCITS proxy) holdings
for (const url of [
  'https://www.ishares.com/us/products/239725/ishares-core-sp-500-etf/1467271812596.ajax?fileType=csv&fileName=IVV_holdings&dataType=fund',
  'https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf/1467271812596.ajax?fileType=csv&fileName=IVV_holdings&dataType=fund',
]) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const t = await r.text()
  console.log('\n', url.includes('239725') ? 'IVV' : 'other', r.status, t.slice(0, 300))
}

const isin = process.argv[2] || 'LU1681038243'

// ExtraETF
for (const url of [
  `https://extraetf.com/de/etf-profile/${isin}`,
  `https://extraetf.com/de/etf/${isin}`,
  `https://www.extraetf.com/de/etf-profile/${isin}`,
  `https://extraetf.com/api/etf/${isin}/holdings`,
  `https://extraetf.com/api/v1/etf/${isin}`,
]) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      redirect: 'follow',
    })
    const ct = r.headers.get('content-type') || ''
    const t = await r.text()
    console.log(url, r.status, ct.slice(0, 40), t.length)
    if (ct.includes('json') || t.startsWith('{')) console.log(t.slice(0, 400))
    else if (t.includes('NVIDIA') || t.includes('Microsoft') || t.includes('__NEXT')) {
      console.log('  has holdings keywords')
      const next = t.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
      if (next) {
        const j = JSON.parse(next[1])
        const s = JSON.stringify(j)
        const idx = s.search(/hold|alloc|compos|weight/i)
        if (idx >= 0) console.log(' NEXT', s.slice(idx, idx + 300))
      }
    }
  } catch (e) {
    console.log(url, e.message)
  }
}

// ETFdb / etf.com style
for (const url of [
  `https://www.etf.com/${isin}`,
  `https://api.finanzfluss.de/v1/etf/${isin}`,
]) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    console.log('\n', url, r.status, (await r.text()).slice(0, 200))
  } catch (e) {
    console.log(url, e.message)
  }
}

const isin = (process.argv[2] || 'LU1681038243').toUpperCase()

// ExtraETF Top 10 from profile HTML
const r = await fetch(`https://extraetf.com/de/etf-profile/${isin}`, {
  headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'de-DE' },
})
const html = await r.text()

// Top 10 block
const top10Idx = html.indexOf('Top 10')
console.log('Top10 context:', html.slice(top10Idx - 200, top10Idx + 3000).replace(/\s+/g, ' ').slice(0, 2500))

// app.extraetf.com API probes
for (const url of [
  `https://app.extraetf.com/api/security/${isin}`,
  `https://app.extraetf.com/api/v1/security/${isin}`,
  `https://app.extraetf.com/api/securities/${isin}/holdings`,
  `https://app.extraetf.com/de/api/security/${isin}`,
  `https://extraetf.com/backend/api/security/${isin}`,
  `https://extraetf.com/backend/security/${isin}`,
]) {
  try {
    const rr = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    })
    const ct = rr.headers.get('content-type') || ''
    const t = await rr.text()
    console.log('\n', url, rr.status, ct.slice(0, 40))
    if (t.length < 2000) console.log(t)
    else if (ct.includes('json')) console.log(t.slice(0, 800))
  } catch (e) {
    console.log(url, e.message)
  }
}

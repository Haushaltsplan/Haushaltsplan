const isin = (process.argv[2] || 'LU1681038243').toUpperCase()

// ExtraETF components tab - might SSR data
for (const url of [
  `https://extraetf.com/de/etf-profile/${isin}?tab=components`,
  `https://extraetf.com/de/etf-profile/${isin}?tab=analysis`,
]) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'de-DE' } })
  const html = await r.text()
  console.log('\n', url, r.status, html.length)
  for (const term of ['NVIDIA', 'Microsoft', 'Alphabet', 'Apple', 'Meta', 'Amazon', 'components', 'sector', 'country', 'weight', 'allocation']) {
    if (html.includes(term)) console.log('  has', term)
  }
  // embedded state
  const state = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/)
  if (state) console.log('INITIAL_STATE', state[1].slice(0, 500))
  const ng = html.match(/"holdings"[\s\S]{0,500}/)
  if (ng) console.log('holdings snippet', ng[0].slice(0, 400))
}

// fetch main JS bundle from extraetf page
const main = await fetch(`https://extraetf.com/de/etf-profile/${isin}`, {
  headers: { 'User-Agent': 'Mozilla/5.0' },
})
const html = await main.text()
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1])
console.log('\nscripts', scripts.filter((s) => s.includes('main') || s.includes('chunk')).slice(0, 10))

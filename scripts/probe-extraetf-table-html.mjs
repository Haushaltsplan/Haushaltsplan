const isin = process.argv[2] || 'IE00BLNMYC90'
const r = await fetch(`https://extraetf.com/de/etf-profile/${isin}?tab=components`, {
  headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'de-DE' },
})
const html = await r.text()

const idx = html.indexOf('table-top-holdings')
console.log('idx', idx)
console.log(html.slice(idx - 200, idx + 4000).replace(/\s+/g, ' ').slice(0, 3500))

const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1])
console.log('\nscripts', scripts.filter((s) => s.endsWith('.js')).slice(0, 8))

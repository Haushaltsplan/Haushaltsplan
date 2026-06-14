const isin = process.argv[2] || 'LU1681038243'

const r = await fetch(`https://www.justetf.com/de/etf-profile.html?isin=${isin}`, {
  headers: { 'User-Agent': 'Mozilla/5.0' },
})
const html = await r.text()

const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1])
console.log('scripts', scripts.length)

for (const src of scripts.slice(0, 5)) {
  const url = src.startsWith('http') ? src : `https://www.justetf.com${src}`
  const jr = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const js = await jr.text()
  console.log('\n', url, js.length)
  for (const term of ['holdings', 'composition', 'topHoldings', '/api/', 'sector', 'countryWeight']) {
    if (js.includes(term)) {
      const i = js.indexOf(term)
      console.log(' ', term, js.slice(Math.max(0, i - 60), i + 120).replace(/\s+/g, ' '))
    }
  }
}

// inline scripts
for (const m of html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)) {
  const s = m[1]
  if (/holding|composition|Gewicht/i.test(s)) {
    console.log('\nINLINE', s.slice(0, 500).replace(/\s+/g, ' '))
  }
}

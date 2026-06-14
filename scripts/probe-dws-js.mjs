const r = await fetch('https://etf.dws.com/de-de/', { headers: { 'User-Agent': 'Mozilla/5.0' } })
const html = await r.text()
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1])
console.log('scripts', scripts.slice(0, 15))

for (const src of scripts.filter((s) => s.includes('main') || s.includes('chunk') || s.includes('app')).slice(0, 5)) {
  const url = src.startsWith('http') ? src : `https://etf.dws.com${src}`
  const js = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((x) => x.text())
  console.log('\n', url, js.length)
  for (const term of ['holdings', 'composition', 'topTen', 'TopTen', '/api/', 'graphql', 'isin']) {
    let pos = 0
    let c = 0
    while ((pos = js.indexOf(term, pos)) >= 0 && c < 1) {
      console.log(' ', term, js.slice(Math.max(0, pos - 60), pos + 120))
      pos += term.length
      c++
    }
  }
}

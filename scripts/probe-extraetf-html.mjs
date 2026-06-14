const isin = process.argv[2] || 'LU1681038243'
const r = await fetch(`https://extraetf.com/de/etf-profile/${isin}`, {
  headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'de-DE' },
})
const html = await r.text()
console.log('len', html.length)

const next = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
if (next) {
  const j = JSON.parse(next[1])
  console.log('NEXT keys', Object.keys(j))
  const s = JSON.stringify(j)
  for (const term of ['holdings', 'topHoldings', 'allocation', 'composition', 'sectors', 'countries', 'weights']) {
    let pos = 0
    let c = 0
    while ((pos = s.toLowerCase().indexOf(term.toLowerCase(), pos)) >= 0 && c < 2) {
      console.log(term, s.slice(Math.max(0, pos - 60), pos + 120))
      pos += term.length
      c++
    }
  }
}

for (const term of ['NVIDIA', 'Microsoft', 'Alphabet', 'Apple', 'Top 10', 'topHoldings', 'holdings']) {
  const i = html.indexOf(term)
  if (i >= 0) console.log('HTML', term, i, html.slice(i, i + 100).replace(/\s+/g, ' '))
}

// find api urls in page scripts
const apis = [...html.matchAll(/https?:\/\/[^"'\s]+/g)].map((m) => m[0])
console.log(
  'API urls:',
  [...new Set(apis.filter((u) => /api|hold|alloc|etf/i.test(u)))].slice(0, 25),
)

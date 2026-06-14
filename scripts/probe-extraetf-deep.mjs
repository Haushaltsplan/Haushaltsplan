const isin = process.argv[2] || 'IE00BLNMYC90'
const r = await fetch(`https://extraetf.com/de/etf-profile/${isin}?tab=components`, {
  headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'de-DE' },
})
const html = await r.text()
console.log('len', html.length)

for (const pat of ['table-top-holdings', 'Top 10 Holdings', 'app-top-holdings', 'top-holdings', 'Gewicht', 'col-val']) {
  console.log(pat, html.includes(pat))
}

// all tables
const tables = [...html.matchAll(/<table[^>]*class="([^"]*)"[^>]*>/g)]
console.log('tables', tables.map((m) => m[1]).slice(0, 20))

// percentages in page
const pcts = [...html.matchAll(/(\d+[,.]\d+)\s*&nbsp;?\s*%/g)].map((m) => m[1]).slice(0, 20)
console.log('pcts', pcts)

// company names near percentages  
for (const name of ['Apple', 'Microsoft', 'NVIDIA', 'Alphabet', 'Amazon', 'Meta', 'Tesla', 'JPMorgan', 'Exxon']) {
  const i = html.indexOf(name)
  if (i >= 0) console.log(name, html.slice(i, i + 80))
}

// ng-state
const ng = html.match(/<script id="ng-state" type="application\/json">([\s\S]*?)<\/script>/)
if (ng) console.log('ng-state len', ng[1].length, ng[1].slice(0, 500))

// fetch main.js and search for API
const mainUrl = 'https://extraetf.com/main.1af067ff27df1ffd.js'
const js = await fetch(mainUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((x) => x.text())
console.log('main.js len', js.length)
for (const term of ['top-holdings', 'topHoldings', 'holdings', '/api/', 'components', 'allocation']) {
  let pos = 0
  let c = 0
  while ((pos = js.indexOf(term, pos)) >= 0 && c < 2) {
    console.log(term, js.slice(pos, pos + 150))
    pos += term.length
    c++
  }
}

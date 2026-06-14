const url = 'https://www.justetf.com/scripts/custom/nbk-components.min.js?20260521-093909'
const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
const js = await r.text()
console.log('len', js.length)

const urls = [...js.matchAll(/["'](\/[^"']{5,120})["']/g)]
  .map((m) => m[1])
  .filter((u) => /hold|compos|sector|country|etf|profile|api|weight|breakdown/i.test(u))
console.log([...new Set(urls)].join('\n'))

for (const term of ['composition', 'holdings', 'topHoldings', 'sector', 'country', 'ajax', 'fetch(']) {
  let pos = 0
  let c = 0
  while ((pos = js.indexOf(term, pos)) >= 0 && c < 2) {
    console.log('\n', term, js.slice(Math.max(0, pos - 80), pos + 200).replace(/\s+/g, ' '))
    pos += term.length
    c++
  }
}

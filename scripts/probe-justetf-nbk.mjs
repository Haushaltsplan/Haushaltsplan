const r = await fetch('https://www.justetf.com/custom/nbk-components.min.js?20260521-094441', {
  headers: { 'User-Agent': 'Mozilla/5.0' },
})
const js = await r.text()
console.log('len', js.length)
for (const term of [
  'composition',
  'holdings',
  'topHoldings',
  'sector',
  'country',
  '/api/',
  'etf-profile',
  'breakdown',
  'wicket',
  'ajax',
]) {
  let pos = 0
  let c = 0
  while ((pos = js.indexOf(term, pos)) >= 0 && c < 3) {
    console.log('\n', term, js.slice(Math.max(0, pos - 80), pos + 180).replace(/\s+/g, ' '))
    pos += term.length
    c++
  }
}

const urls = [...new Set([...js.matchAll(/["'](\/[^"']{4,100})["']/g)].map((m) => m[1]))]
console.log(
  '\npaths',
  urls.filter((u) => /hold|compos|sector|country|etf|api|break/i.test(u)).slice(0, 40),
)

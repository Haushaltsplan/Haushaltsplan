const r = await fetch(
  'https://amundiprodcdn2.azureedge.net/widgets-assets/product-page/20.1.69/amundi-product-page.js',
)
const t = await r.text()

for (const term of [
  'top_ten_fund_holdings',
  'top_ten_index',
  'product-holdings',
  'fundHoldings',
  'indexHoldings',
  'getHoldings',
  'holdingsUrl',
  '/holdings',
  'api-gateway',
  'amundi-api',
  'widgets-api',
  'productApi',
]) {
  let pos = 0
  let c = 0
  while ((pos = t.indexOf(term, pos)) >= 0 && c < 2) {
    console.log('\n', term, pos, t.slice(Math.max(0, pos - 100), pos + 250).replace(/\s+/g, ' '))
    pos += term.length
    c++
  }
}

// Find URL patterns near top_ten
const idx = t.indexOf('top_ten_fund_holdings')
if (idx >= 0) {
  const chunk = t.slice(idx - 5000, idx + 5000)
  const urls = [...chunk.matchAll(/["']([^"']*(?:api|hold|fund|product|widget)[^"']*)["']/gi)].map((m) => m[1])
  console.log('\nNearby strings:', [...new Set(urls)].slice(0, 40))
}

const r = await fetch(
  'https://amundiprodcdn2.azureedge.net/widgets-assets/product-page/20.1.69/amundi-product-page.js',
)
const t = await r.text()
console.log('len', t.length)

for (const term of [
  'holdings',
  'allocation',
  'composition',
  'sectorAllocation',
  'countryAllocation',
  'topHoldings',
  'constituent',
  '/api/',
  'azureedge',
  'fund-data',
  'product-data',
]) {
  let pos = 0
  let c = 0
  while ((pos = t.indexOf(term, pos)) >= 0 && c < 3) {
    console.log('\n', term, pos, t.slice(Math.max(0, pos - 80), pos + 120).replace(/\s+/g, ' '))
    pos += term.length
    c++
  }
}

const urls = [...new Set([...t.matchAll(/https?:\/\/[^"'`\s]+/g)].map((m) => m[0]))]
console.log(
  '\nURLs with hold/alloc:',
  urls.filter((u) => /hold|alloc|compos|fund|sector|country|product/i.test(u)).slice(0, 30),
)

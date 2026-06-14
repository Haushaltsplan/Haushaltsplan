const r = await fetch(
  'https://amundiprodcdn2.azureedge.net/widgets-assets/product-page/20.1.69/amundi-product-page.js',
)
const t = await r.text()

for (const term of [
  'getProductsData',
  'ProductApiService',
  'productApiService',
  'breakdown',
  'FUND_BREAKDOWN',
  'INDEX_BREAKDOWN',
  'topTen',
  'top-ten',
  'weightedAverage',
]) {
  let pos = 0
  let c = 0
  while ((pos = t.indexOf(term, pos)) >= 0 && c < 2) {
    console.log('\n', term, pos, t.slice(Math.max(0, pos - 80), pos + 200).replace(/\s+/g, ' '))
    pos += term.length
    c++
  }
}

// Search for http endpoints in product api chunk
const apiIdx = t.indexOf('getProductsData')
const chunk = t.slice(Math.max(0, apiIdx - 20000), apiIdx + 20000)
const paths = [...chunk.matchAll(/["'](\/[^"']{5,120})["']/g)].map((m) => m[1])
console.log('\nPaths near getProductsData:', [...new Set(paths.filter((p) => /product|fund|hold|break|api/i.test(p)))].slice(0, 50))

// Also search full file for amundi api host
for (const host of [
  'amundi-api',
  'api.amundi',
  'product-api',
  'widgets-api',
  'gateway',
  'azure-api',
]) {
  const i = t.indexOf(host)
  if (i >= 0) console.log(host, t.slice(i, i + 150))
}

const hosts = [...new Set([...t.matchAll(/https:\/\/[a-z0-9.-]+\.amundi[a-z0-9.-]*/gi)].map((m) => m[0]))]
console.log('\nAmundi hosts:', hosts.slice(0, 20))

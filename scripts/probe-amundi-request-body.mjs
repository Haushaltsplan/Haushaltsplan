const r = await fetch(
  'https://amundiprodcdn2.azureedge.net/widgets-assets/product-page/20.1.69/amundi-product-page.js',
)
const t = await r.text()
const idx = t.indexOf('breakDown:{aggregationFields')
console.log(t.slice(idx - 500, idx + 800))

// find productConfig.breakdown default values
const idx2 = t.indexOf('INDEX_TOP10')
console.log('\n--- INDEX_TOP10 context ---')
console.log(t.slice(idx2 - 200, idx2 + 600))

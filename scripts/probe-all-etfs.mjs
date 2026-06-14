const isins = ['LU1681048804', 'IE00BLNMYC90', 'IE00BJXRZJ40']

for (const isin of isins) {
  console.log('\n===', isin, '===')
  const r = await fetch('https://www.amundietf.de/mapi/ProductAPI/getProductsData', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({
      productIds: [isin],
      context: { bcp47Code: 'de-DE', countryCode: 'DEU' },
      breakDown: {
        aggregationFields: ['FUND_TOP10', 'INDEX_TOP10', 'FUND_SECTORS', 'INDEX_SECTORS', 'FUND_COUNTRIES', 'INDEX_COUNTRIES'],
      },
    }),
  })
  const j = await r.json()
  const p = j.products?.[0]
  console.log('Amundi', p?.productId, 'breakDowns', p?.breakDowns?.length)
  const top = p?.breakDowns?.find((b) => b.aggregationField === 'FUND_TOP10' || b.aggregationField === 'INDEX_TOP10')
  console.log('top sample', top?.breakDownData?.slice(0, 3))

  const ex = await fetch(`https://extraetf.com/de/etf-profile/${isin}?tab=components`, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'de-DE' },
  })
  const html = await ex.text()
  const hasTop = html.includes('Top 10 Holdings')
  const nvda = html.includes('NVIDIA') || html.includes('Nvidia')
  console.log('ExtraETF tab', ex.status, 'top10', hasTop, 'nvidia', nvda)
}

// Xtrackers product page
const xt = await fetch('https://www.xtrackers.com/de/professional/products/263206/IE00BLNMYC90', {
  headers: { 'User-Agent': 'Mozilla/5.0' },
  redirect: 'follow',
})
const xhtml = await xt.text()
console.log('\nXtrackers', xt.status, xt.url, xhtml.length)
for (const term of ['holdings', 'Top 10', 'composition', 'api', 'NVIDIA', 'Microsoft']) {
  if (xhtml.includes(term)) console.log(' has', term)
}

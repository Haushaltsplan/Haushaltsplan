const isins = ['LU1681038243', 'LU1681048804', 'IE00BLNMYC90']
for (const isin of isins) {
  const r = await fetch('https://www.amundietf.de/mapi/ProductAPI/getProductsData', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productIds: [isin],
      context: { bcp47Code: 'de-DE', countryCode: 'DEU' },
      breakDown: {
        aggregationFields: ['INDEX_TOP10', 'FUND_TOP10', 'INDEX_SECTORS', 'INDEX_COUNTRIES'],
      },
    }),
  })
  const j = await r.json()
  const bds = j.products?.[0]?.breakDowns ?? []
  const top = bds.find((b) => b.aggregationField === 'INDEX_TOP10')?.breakDownData ?? []
  console.log(isin, top.length ? `Amundi OK: ${top[0].aggregationName}` : 'Amundi miss')
}

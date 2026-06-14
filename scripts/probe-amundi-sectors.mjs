const isin = 'LU1681038243'
const r = await fetch('https://www.amundietf.de/mapi/ProductAPI/getProductsData', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
  body: JSON.stringify({
    productIds: [isin],
    context: { bcp47Code: 'de-DE', countryCode: 'DEU' },
    breakDown: { aggregationFields: ['INDEX_SECTORS', 'INDEX_COUNTRIES', 'FUND_SECTORS', 'FUND_COUNTRIES'] },
  }),
})
const j = await r.json()
for (const bd of j.products[0].breakDowns) {
  console.log('\n', bd.aggregationField, 'rows', bd.breakDownData.length)
  console.log(JSON.stringify(bd.breakDownData.slice(0, 4), null, 2))
}

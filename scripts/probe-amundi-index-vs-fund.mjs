const isin = 'LU1681038243'
const r = await fetch('https://www.amundietf.de/mapi/ProductAPI/getProductsData', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
  body: JSON.stringify({
    productIds: [isin],
    context: { bcp47Code: 'de-DE', countryCode: 'DEU' },
    breakDown: { aggregationFields: ['FUND_TOP10', 'INDEX_TOP10'] },
  }),
})
const j = await r.json()
for (const bd of j.products[0].breakDowns) {
  console.log('\n', bd.aggregationField)
  for (const row of bd.breakDownData.slice(0, 5)) {
    console.log(
      ' ',
      row.aggregationName,
      (row.adjustedWeight ?? row.weight) * 100,
      row.additionalProperties?.isin,
    )
  }
}

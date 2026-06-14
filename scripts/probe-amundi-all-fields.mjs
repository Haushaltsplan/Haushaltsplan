const isin = 'LU1681038243'
const fields = [
  'INDEX_TOP10','FUND_TOP10','INDEX_ALL','FUND_ALL','INDEX_HOLDINGS','FUND_HOLDINGS',
  'INDEX_COMPOSITION','FUND_COMPOSITION','INDEX_CONSTITUENTS','FUND_CONSTITUENTS',
  'INDEX_FULL','FUND_FULL','ALL_HOLDINGS','FULL_HOLDINGS','INDEX_POSITIONS','FUND_POSITIONS',
  'INDEX_TOP25','FUND_TOP25','INDEX_TOP50','FUND_TOP50','INDEX_TOP100','FUND_TOP100',
]
const r = await fetch('https://www.amundietf.de/mapi/ProductAPI/getProductsData', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productIds: [isin],
    context: { bcp47Code: 'de-DE', countryCode: 'DEU' },
    breakDown: { aggregationFields: fields },
  }),
})
const j = await r.json()
for (const bd of j.products?.[0]?.breakDowns ?? []) {
  console.log(bd.aggregationField, bd.breakDownData?.length ?? 0)
}

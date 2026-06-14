const isin = 'LU1681038243'
const fields = [
  'INDEX_TOP10',
  'FUND_TOP10',
  'INDEX_SECTORS',
  'INDEX_COUNTRIES',
  'FUND_SECTORS',
  'FUND_COUNTRIES',
]

const bodies = [
  {
    productIds: [isin],
    context: { bcp47Code: 'de-DE', countryCode: 'DEU' },
    breakDown: { aggregationFields: fields },
  },
  {
    productIds: [isin],
    context: { bcp47Code: 'de-DE', countryCode: 'DEU' },
    payload: {
      breakDown: { aggregationFields: fields },
    },
  },
  {
    productIds: [isin],
    context: { bcp47Code: 'de-DE', countryCode: 'DEU' },
    characteristics: [],
    metrics: [],
    historics: [],
    breakDown: { aggregationFields: fields },
  },
]

for (const body of bodies) {
  const r = await fetch('https://www.amundietf.de/mapi/ProductAPI/getProductsData', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0',
      Referer: `https://www.amundietf.de/de/privatanleger/products/equity/amundi-nasdaq100-swap-ucits-etf-eur-acc/${isin.toLowerCase()}`,
    },
    body: JSON.stringify(body),
  })
  const j = await r.json()
  const bd = j.products?.[0]?.breakDowns
  console.log('\nbody keys', Object.keys(body), 'breakDowns len', bd?.length ?? 0)
  if (bd?.length) console.log(JSON.stringify(bd, null, 2).slice(0, 3000))
}

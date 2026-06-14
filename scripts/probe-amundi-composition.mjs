const isin = 'LU1681038243'
const bodies = [
  { productIds: [isin], context: { bcp47Code: 'de-DE', countryCode: 'DEU' }, characteristics: ['COMPOSITION'] },
  { productIds: [isin], context: { bcp47Code: 'de-DE', countryCode: 'DEU' }, composition: true },
  {
    productIds: [isin],
    context: { bcp47Code: 'de-DE', countryCode: 'DEU' },
    payload: {
      characteristics: [],
      metrics: [],
      historics: [],
      breakDown: { aggregationFields: ['INDEX_TOP10'] },
      composition: { full: true },
    },
  },
]

for (const body of bodies) {
  const r = await fetch('https://www.amundietf.de/mapi/ProductAPI/getProductsData', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = await r.json()
  const p = j.products?.[0]
  console.log('\nkeys', Object.keys(body), 'composition', p?.composition != null, JSON.stringify(p?.composition)?.slice(0, 200))
}

// Document API
for (const url of [
  `https://www.amundietf.de/mapi/DocumentAPI/getDocumentsByProductIds`,
]) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productIds: [isin], context: { bcp47Code: 'de-DE', countryCode: 'DEU' } }),
  })
  console.log('\nDocAPI', r.status, (await r.text()).slice(0, 400))
}

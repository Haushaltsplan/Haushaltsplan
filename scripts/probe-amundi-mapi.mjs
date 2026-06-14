const isin = (process.argv[2] || 'LU1681038243').toUpperCase()
const url = `https://www.amundietf.de/de/privatanleger/products/equity/amundi-nasdaq100-swap-ucits-etf-eur-acc/${isin.toLowerCase()}`
const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
const html = await r.text()

// find productIds / context in page
for (const term of ['productId', 'productIds', 'getProductsData', 'mapi', 'breakdown', 'INDEX_TOP10', 'FUND_TOP10']) {
  let pos = 0
  let c = 0
  while ((pos = html.indexOf(term, pos)) >= 0 && c < 3) {
    console.log(term, html.slice(Math.max(0, pos - 80), pos + 200).replace(/\s+/g, ' '))
    pos += term.length
    c++
  }
}

// JSON blobs
for (const m of html.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g)) {
  const t = m[1].trim()
  if (t.length > 50 && /product|breakdown|hold/i.test(t)) {
    console.log('\nJSON script', t.slice(0, 500))
  }
}

// try generic product API with isin
const bodies = [
  { productIds: [isin], context: { bcp47Code: 'de-DE', countryCode: 'DEU' } },
  { isin },
  { isins: [isin] },
  { productIds: [isin], breakdown: ['INDEX_TOP10', 'INDEX_SECTORS', 'INDEX_COUNTRIES'] },
]

for (const body of bodies) {
  const rr = await fetch('https://www.amundietf.de/mapi/ProductAPI/getProductsData', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/json',
      Referer: url,
    },
    body: JSON.stringify(body),
  })
  const t = await rr.text()
  console.log('\nPOST', JSON.stringify(body).slice(0, 120), rr.status, t.slice(0, 500))
}

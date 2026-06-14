const isin = process.argv[2] || 'LU1681038243'
const r = await fetch(`https://www.justetf.com/de/etf-profile.html?isin=${isin}`, {
  headers: { 'User-Agent': 'Mozilla/5.0' },
})
const html = await r.text()
const anchors = [...html.matchAll(/profile-anchor" id="([^"]+)"/g)].map((m) => m[1])
console.log('anchors', anchors)

// Amundi product page
const amundiUrls = [
  `https://www.amundietf.de/de/privatanleger/products/equity/amundi-nasdaq100-ucits-etf-eur-c/lu1681038243`,
  `https://www.amundi-etp.com/de/privatkunden/products/equity/amundi-nasdaq-100-ucits-etf-acc/lu1681038243`,
  `https://www.amundi.lu/professional/product/view/LU1681038243`,
]
for (const u of amundiUrls) {
  try {
    const rr = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' })
    const t = await rr.text()
    console.log('\n', u, rr.status, rr.url)
    for (const term of ['holdings', 'Top 10', 'composition', 'allocation', '__NEXT', 'api/', 'NVIDIA', 'Microsoft']) {
      if (t.includes(term)) console.log('  has', term)
    }
  } catch (e) {
    console.log(u, e.message)
  }
}

// TrackInsight graphql
try {
  const gq = await fetch('https://www.trackinsight.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({
      query: `query { fund(isin:"${isin}") { name holdings { name weight } } }`,
    }),
  })
  console.log('\nTI graphql', gq.status, (await gq.text()).slice(0, 300))
} catch (e) {
  console.log('TI graphql err', e.message)
}

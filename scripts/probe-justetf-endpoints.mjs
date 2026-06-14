const isin = process.argv[2] || 'LU1681038243'

const r = await fetch(`https://www.justetf.com/de/etf-profile.html?isin=${isin}`, {
  headers: { 'User-Agent': 'Mozilla/5.0' },
})
const html = await r.text()

const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1])
for (const src of scripts) {
  const url = src.startsWith('http') ? src : `https://www.justetf.com${src}`
  if (!/justetf\.com/i.test(url)) continue
  const jr = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const js = await jr.text()
  const hits = []
  for (const term of ['holdings', 'Holding', 'composition', 'topHoldings', 'sectorWeight', 'countryWeight', 'etf-profile', 'breakdown']) {
    if (js.includes(term)) hits.push(term)
  }
  if (hits.length) console.log(url.split('/').slice(-2).join('/'), js.length, hits.join(','))
}

// Try common justetf internal endpoints discovered online
const endpoints = [
  `/de/etf-profile/${isin}/holdings`,
  `/de/etf-profile/${isin}/composition`,
  `/de/etf-profile/${isin}/holdings.json`,
  `/de/etf-profile/${isin}/holdings-data`,
  `/de/etf-profile/${isin}/holdings-data.json`,
  `/de/etf-profile/${isin}/holdings-data.html`,
  `/de/etf-profile/${isin}/holdings-data?format=json`,
  `/de/etf-profile/${isin}/holdings-data?lang=de`,
  `/de/etf-profile/${isin}/holdings-data?lang=de&format=json`,
  `/de/etf-profile/${isin}/holdings-data?lang=de&format=html`,
  `/de/etf-profile/${isin}/holdings-data?lang=de&format=xml`,
  `/de/etf-profile/${isin}/holdings-data?lang=de&format=csv`,
  `/de/etf-profile/${isin}/holdings-data?lang=de&format=txt`,
  `/de/etf-profile/${isin}/holdings-data?lang=de&format=pdf`,
  `/de/etf-profile/${isin}/holdings-data?lang=de&format=xls`,
  `/de/etf-profile/${isin}/holdings-data?lang=de&format=xlsx`,
  `/de/etf-profile/${isin}/holdings-data?lang=de&format=ods`,
  `/de/etf-profile/${isin}/holdings-data?lang=de&format=odt`,
  `/de/etf-profile/${isin}/holdings-data?lang=de&format=odp`,
  `/de/etf-profile/${isin}/holdings-data?lang=de&format=odg`,
  `/de/etf-profile/${isin}/holdings-data?lang=de&format=odf`,
  `/de/etf-profile/${isin}/holdings-data?lang=de&format=odm`,
  `/de/etf-profile/${isin}/holdings-data?lang=de&format=odc`,
  `/de/etf-profile/${isin}/holdings-data?lang=de&format=odb`,
  `/de/etf-profile/${isin}/holdings-data?lang=de&format=odt`,
  `/de/etf-profile/${isin}/holdings-data?lang=de&format=odp`,
  `/de/etf-profile/${isin}/holdings-data?lang=de&format=odg`,
  `/de/etf-profile/${isin}/holdings-data?lang=de&format=odf`,
  `/de/etf-profile/${isin}/holdings-data?lang=de&format=odm`,
  `/de/etf-profile/${isin}/holdings-data?lang=de&format=odc`,
  `/de/etf-profile/${isin}/holdings-data?lang=de&format=odb`,
]

for (const ep of [
  `/de/etf-profile/${isin}/holdings-data.json`,
  `/de/etf-profile/${isin}/holdings-data`,
  `/de/etf-profile/${isin}/holdings.json`,
  `/de/etf-profile/${isin}/holdings`,
  `/de/etf-profile/${isin}/composition.json`,
  `/de/etf-profile/${isin}/composition`,
  `/de/etf-profile/${isin}/sectors.json`,
  `/de/etf-profile/${isin}/countries.json`,
  `/de/etf-profile/${isin}/sectors`,
  `/de/etf-profile/${isin}/countries`,
  `/de/etf-profile/${isin}/breakdown.json`,
  `/de/etf-profile/${isin}/breakdown`,
  `/de/etf-profile/${isin}/top-holdings.json`,
  `/de/etf-profile/${isin}/top-holdings`,
  `/de/etf-profile/${isin}/top10-holdings.json`,
  `/de/etf-profile/${isin}/top10-holdings`,
  `/de/etf-profile/${isin}/top-10-holdings.json`,
  `/de/etf-profile/${isin}/top-10-holdings`,
]) {
  const u = `https://www.justetf.com${ep}`
  try {
    const rr = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } })
    const ct = rr.headers.get('content-type') || ''
    const t = await rr.text()
    if (rr.status !== 404) console.log(ep, rr.status, ct, t.slice(0, 120).replace(/\s+/g, ' '))
  } catch {}
}

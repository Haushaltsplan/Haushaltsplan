const isin = 'IE00BLNMYC90'
const urls = [
  `https://etf.dws.com/de-de/Investieren/Produkte/IE00BLNMYC90/`,
  `https://www.dws.com/de-de/produkte/etf/ie00blnmyc90/`,
  `https://www.etf.dws.de/DE/Retail/de/Produkte/Produkt/IE00BLNMYC90`,
]
for (const url of urls) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' })
    const t = await r.text()
    console.log('\n', url, '->', r.url, r.status, t.length)
    for (const term of ['holdings', 'Top Holdings', 'composition', 'NVIDIA', 'Apple', 'api', '__NEXT']) {
      if (t.includes(term)) console.log(' ', term)
    }
  } catch (e) {
    console.log(url, e.message)
  }
}

// DWS API patterns from etf.dws.com homepage
const home = await fetch('https://etf.dws.com/de-de/', { headers: { 'User-Agent': 'Mozilla/5.0' } })
const h = await home.text()
const scripts = [...h.matchAll(/src="([^"]+\.js)"/g)].map((m) => m[1]).slice(0, 5)
console.log('\nscripts', scripts)

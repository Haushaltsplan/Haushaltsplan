const urls = [
  'https://www.ssga.com/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx',
  'https://www.ssga.com/library-content/products/fund-data/etfs/us/holdings-daily-us-en-qqq.xlsx',
  'https://www.ssga.com/us/en/intermediary/etfs/funds/spdr-sp-500-etf-trust-spy',
  'https://www.invesco.com/us/financial-products/etfs/holdings/main/holdings/0?audienceType=Investor&ticker=QQQ',
]

for (const url of urls) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' })
    console.log(url.split('/').slice(-2).join('/'), r.status, r.headers.get('content-type')?.slice(0, 40), (await r.arrayBuffer()).byteLength)
  } catch (e) {
    console.log(url, e.message)
  }
}

// Wikipedia S&P 500 constituents
const wiki = await fetch('https://en.wikipedia.org/w/api.php?action=parse&page=List_of_S%26P_500_companies&prop=text&format=json', {
  headers: { 'User-Agent': 'MeinHaushalt/1.0' },
})
const wj = await wiki.json()
const html = wj.parse?.text?.['*'] ?? ''
const rows = [...html.matchAll(/<td><a[^>]*title="([^"]+)"[^>]*>([A-Z.]+)<\/a><\/td>/g)]
console.log('\nwiki sp500 symbols', rows.length, rows.slice(0, 5).map((m) => m[2]))

const wiki2 = await fetch('https://en.wikipedia.org/w/api.php?action=parse&page=Nasdaq-100&prop=text&format=json', {
  headers: { 'User-Agent': 'MeinHaushalt/1.0' },
})
const wj2 = await wiki2.json()
const html2 = wj2.parse?.text?.['*'] ?? ''
const rows2 = [...html2.matchAll(/>([A-Z]{1,5})<\/a><\/td>/g)]
console.log('wiki ndx sample', rows2.slice(0, 10).map((m) => m[1]))

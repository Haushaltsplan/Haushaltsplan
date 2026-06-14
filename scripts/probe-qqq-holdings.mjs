const bases = [
  'holdings-daily-us-en-qqq',
  'holdings-daily-us-en-qqqm',
  'holdings-daily-us-en-ndx',
  'holdings-daily-us-en-oneq',
]
for (const name of bases) {
  const url = `https://www.ssga.com/library-content/products/fund-data/etfs/us/${name}.xlsx`
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  console.log(name, r.status, r.headers.get('content-type')?.slice(0, 30), (await r.arrayBuffer()).byteLength)
}

// Invesco QQQ
for (const url of [
  'https://www.invesco.com/us/financial-products/etfs/holdings/main/holdings/0?audienceType=Investor&ticker=QQQ',
  'https://www.invesco.com/us/financial-products/etfs/product-detail?audienceType=Investor&ticker=QQQ',
]) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const t = await r.text()
  console.log('\n', url.split('?')[0], r.status, t.length, t.includes('holdings'))
}

// Wikipedia parse table properly
const wiki = await fetch('https://en.wikipedia.org/w/api.php?action=query&prop=extracts&titles=List_of_S%26P_500_companies&explaintext=1&format=json', {
  headers: { 'User-Agent': 'MeinHaushalt/1.0' },
})
const wj = await wiki.json()
const pages = Object.values(wj.query?.pages ?? {})
console.log('\nwiki pages', pages.length)

// use wikitext
const wt = await fetch('https://en.wikipedia.org/w/api.php?action=parse&page=List_of_S%26P_500_companies&prop=wikitext&format=json', {
  headers: { 'User-Agent': 'MeinHaushalt/1.0' },
})
const wtj = await wt.json()
const wikitext = wtj.parse?.wikitext?.['*'] ?? ''
const symbols = [...wikitext.matchAll(/\|\s*([A-Z]{1,5}(?:\.[A-Z])?)\s*\n\|\s*(?:NASDAQ|NYSE|NYSE American)/g)]
console.log('wikitext symbols', symbols.length, symbols.slice(0, 5).map((m) => m[1]))

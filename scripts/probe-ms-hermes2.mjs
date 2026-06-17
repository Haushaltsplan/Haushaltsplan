const slug = 'HERMES-INTERNATIONAL-4635'
const h = await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances/`, {
  headers: { 'User-Agent': 'Mozilla/5.0' },
}).then((r) => r.text())

console.log('2012', h.includes('2012'), '2018', h.includes('2018'), '2020', h.includes('2020'))
console.log('year th sample', [...h.matchAll(/>(20\d{2})[\s*]*<\//g)].slice(0, 20).map((m) => m[1]))

const idx = h.indexOf('Net sales')
console.log('net sales context', h.slice(idx, idx + 3000).replace(/\s+/g, ' ').slice(0, 1500))

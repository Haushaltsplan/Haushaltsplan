const isin = process.argv[2] || 'LU1681038243'

const r = await fetch(`https://www.justetf.com/de/etf-profile.html?isin=${isin}`, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
  },
})
const html = await r.text()

const needles = [
  'Top 10',
  'top 10',
  'Holdings',
  'holdings',
  'Positionen',
  'Bestand',
  'NVIDIA',
  'Microsoft',
  'Apple Inc',
  'Alphabet',
  'portfolio-breakdown',
  'etf-holdings',
  'holding-list',
  'dataTable',
  'chartData',
]

for (const n of needles) {
  let pos = 0
  let count = 0
  while ((pos = html.indexOf(n, pos)) >= 0 && count < 3) {
    console.log('\n===', n, 'at', pos, '===')
    console.log(html.slice(Math.max(0, pos - 80), pos + 200).replace(/\s+/g, ' '))
    pos += n.length
    count++
  }
}

// Search for numeric weight patterns near company names
const re = /([A-Z][A-Za-z0-9 .&'-]{2,40})\s*<[^>]+>\s*([0-9]{1,2}[.,][0-9]{1,2})\s*%/g
let m
let n = 0
while ((m = re.exec(html)) && n < 20) {
  console.log('PAIR', m[1], m[2])
  n++
}

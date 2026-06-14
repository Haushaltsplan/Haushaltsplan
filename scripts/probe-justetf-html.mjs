const isin = process.argv[2] || 'LU1681038243'

const r = await fetch(`https://www.justetf.com/de/etf-profile.html?isin=${isin}`, {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
})
const html = await r.text()

const idx = html.indexOf('Gewicht')
console.log(html.slice(idx - 500, idx + 3000))

// look for json blobs
for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
  console.log('LD+JSON', m[1].slice(0, 500))
}

for (const m of html.matchAll(/data:[a-z-]+="([^"]{20,200})"/gi)) {
  if (/holding|weight|sector|country/i.test(m[0])) console.log('data attr', m[0].slice(0, 200))
}

// div blocks with percentage
const pctBlocks = [...html.matchAll(/>([A-Z][^<]{3,60})<\/[^>]+>\s*<[^>]+>\s*([0-9]+[.,][0-9]+)\s*%/g)]
console.log('pct blocks', pctBlocks.slice(0, 15).map((m) => [m[1], m[2]]))

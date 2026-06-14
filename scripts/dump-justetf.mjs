const isin = process.argv[2] || 'LU1681038243'
const r = await fetch(`https://www.justetf.com/de/etf-profile.html?isin=${isin}`, {
  headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'de-DE' },
})
const html = await r.text()
const fs = await import('fs')
fs.writeFileSync('scripts/justetf-sample.html', html.slice(410000, 435000), 'utf8')
console.log('written slice 410k-435k')

// search for vue data / json state
for (const pat of [/window\.__[A-Z_]+__\s*=\s*(\{[\s\S]{100,5000}?\});/, /"holdings"\s*:\s*\[/]) {
  const m = html.match(pat)
  if (m) console.log('match', pat, (m[0] || m[1] || '').slice(0, 400))
}

// datatable ajax urls in html
for (const m of html.matchAll(/ajax[^"']{0,20}["']([^"']+)["']/gi)) console.log('ajax', m[1])

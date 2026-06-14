const isin = process.argv[2] || 'LU1681038243'
const r = await fetch(`https://www.justetf.com/de/etf-profile.html?isin=${isin}`, {
  headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'de-DE' },
})
const html = await r.text()

for (const term of [
  'Top-10',
  'Top 10',
  'top10',
  'zusammensetzung',
  'Zusammensetzung',
  'holdings',
  'Holdings',
  'portfolio-breakdown',
  'etf-holdings',
  'holding',
  'Wertpapiere',
  'Positionen',
  'id="holdings',
  'data-testid="etf-holdings',
  'profile-anchor" id="',
]) {
  let pos = 0
  let c = 0
  while ((pos = html.indexOf(term, pos)) >= 0 && c < 3) {
    console.log('\n===', term, pos, '===')
    console.log(html.slice(Math.max(0, pos - 60), pos + 180).replace(/\s+/g, ' '))
    pos += term.length
    c++
  }
}

// Wicket ajax callback URLs
for (const m of html.matchAll(/Wicket\.Ajax\.get\(\s*['"]([^'"]+)['"]/g)) {
  console.log('WICKET GET', m[1].slice(0, 200))
}
for (const m of html.matchAll(/wicket\.ajax\([^)]+\)/gi)) {
  console.log('wicket.ajax', m[0].slice(0, 200))
}

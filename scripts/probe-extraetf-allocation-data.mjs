const isin = (process.argv[2] || 'LU1681038243').toUpperCase()
const r = await fetch(`https://extraetf.com/de/etf-profile/${isin}?tab=components`, {
  headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'de-DE' },
})
const html = await r.text()

// Find allocation tables / JSON in page
for (const term of ['NVIDIA', 'Microsoft', 'Alphabet', 'Meta Platforms', 'Amazon', 'Tesla']) {
  const i = html.indexOf(term)
  if (i >= 0) console.log(term, i, html.slice(i - 100, i + 150).replace(/\s+/g, ' '))
}

// ng-state or transfer state
for (const pat of [
  /type="application\/json"[^>]*id="[^"]*state[^"]*"[^>]*>([\s\S]*?)<\/script>/gi,
  /<script id="ng-state" type="application\/json">([\s\S]*?)<\/script>/,
  /"topHoldings"[\s\S]{0,2000}/,
  /"components"[\s\S]{0,2000}/,
  /"allocations"[\s\S]{0,2000}/,
]) {
  const m = html.match(pat)
  if (m) {
    console.log('\nMATCH', pat.toString().slice(0, 60), (m[1] || m[0]).slice(0, 1200))
  }
}

// table rows with percentages
const rows = [...html.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/gi)]
  .map((m) => m[0].replace(/<[^>]+>/g, '|').replace(/\s+/g, ' '))
  .filter((r) => /%/.test(r) && r.length < 300)
console.log('\nTable rows with %:', rows.slice(0, 15))

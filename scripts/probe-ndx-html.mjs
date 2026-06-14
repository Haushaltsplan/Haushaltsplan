const r = await fetch('https://indexes.nasdaqomx.com/Index/Weighting/NDX', {
  headers: { 'User-Agent': 'Mozilla/5.0' },
})
const html = await r.text()
console.log('len', html.length)
for (const term of ['NVDA', 'AAPL', 'Weight', 'Symbol', 'json', 'api', 'table']) {
  if (html.includes(term)) console.log('has', term)
}

// parse tables
const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)]
console.log('tables', tables.length)
if (tables[0]) {
  const rows = [...tables[0][0].matchAll(/<tr[\s\S]*?<\/tr>/gi)]
  console.log('rows in first table', rows.length)
  console.log(rows[1]?.[0]?.replace(/<[^>]+>/g, '|').replace(/\s+/g, ' ').slice(0, 300))
}

// look for js data
const dataMatch = html.match(/var\s+\w+\s*=\s*(\[[\s\S]*?\]);/)
if (dataMatch) console.log('js data', dataMatch[1].slice(0, 400))

// stockanalysis nasdaq with symbols only
const sa = await fetch('https://stockanalysis.com/list/nasdaq-100-stocks/', { headers: { 'User-Agent': 'Mozilla/5.0' } })
const sah = await sa.text()
const syms = [...sah.matchAll(/<a href="\/stocks\/([a-z0-9.-]+)\/">([A-Z0-9.-]+)<\/a>/g)]
  .filter((m) => m[1] === m[2].toLowerCase())
  .map((m) => m[2])
console.log('\nstockanalysis nasdaq symbols', syms.length, syms.slice(0, 10))

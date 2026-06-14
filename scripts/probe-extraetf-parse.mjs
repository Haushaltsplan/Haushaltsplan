const isin = process.argv[2] || 'IE00BLNMYC90'
const r = await fetch(`https://extraetf.com/de/etf-profile/${isin}?tab=components`, {
  headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'de-DE' },
})
const html = await r.text()

const tableMatch = html.match(/table-top-holdings[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/)
if (!tableMatch) {
  console.log('no table')
  process.exit(1)
}
const tbody = tableMatch[1]
const rows = [...tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
console.log('rows', rows.length)
for (const row of rows.slice(0, 12)) {
  const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim(),
  )
  console.log(cells)
}

// sectors
const sectorMatch = html.match(/Sektor[\s\S]{0,5000}/i)
if (sectorMatch) {
  const sectorRows = [...sectorMatch[0].matchAll(/(\d+[,.]\d+)\s*%/g)].map((m) => m[1])
  console.log('sector pcts sample', sectorRows.slice(0, 5))
}

// country table
for (const title of ['Länder', 'Sektor', 'Währung', 'Top 10']) {
  const i = html.indexOf(title)
  if (i >= 0) console.log('section', title, 'at', i)
}

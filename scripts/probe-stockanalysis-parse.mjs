const r = await fetch('https://stockanalysis.com/list/sp-500-stocks/', {
  headers: { 'User-Agent': 'Mozilla/5.0' },
})
const html = await r.text()

// parse table rows - look for symbol patterns
const rows = [...html.matchAll(/href="\/stocks\/([a-z0-9.-]+)\/"[^>]*>[\s\S]*?(\d+\.\d+)%/gi)]
console.log('regex rows', rows.length, rows.slice(0, 3).map((m) => [m[1], m[2]]))

// alternative: JSON in page
const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
console.log('jsonld', jsonLd.length)

// parse __NEXT_DATA__
const next = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
if (next) {
  const j = JSON.parse(next[1])
  const s = JSON.stringify(j)
  const idx = s.indexOf('"symbol"')
  console.log('next has symbol', idx >= 0, s.slice(idx, idx + 300))
}

// tr based parse
const trs = [...html.matchAll(/<tr[^>]*class="[^"]*s-table-row[^"]*"[^>]*>([\s\S]*?)<\/tr>/g)]
console.log('s-table-row', trs.length)
if (trs[0]) {
  const cells = trs[0][1].replace(/<[^>]+>/g, '|').replace(/\s+/g, ' ')
  console.log('first row', cells.slice(0, 200))
}

// nasdaq100
const r2 = await fetch('https://stockanalysis.com/list/nasdaq-100-stocks/', { headers: { 'User-Agent': 'Mozilla/5.0' } })
const h2 = await r2.text()
const trs2 = [...h2.matchAll(/<tr[^>]*class="[^"]*s-table-row[^"]*"[^>]*>([\s\S]*?)<\/tr>/g)]
console.log('nasdaq rows', trs2.length)

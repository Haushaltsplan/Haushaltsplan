import { readFileSync } from 'fs'

const h = readFileSync('scripts/.cache-KNSL.html', 'utf8')

const needles = [
  'premiums written',
  'Net earned premiums',
  'product line',
  'geographic',
  'United States',
  'domestic',
  'foreign',
  'Commercial property',
  'Casualty',
  'Schedule of',
]

for (const n of needles) {
  let idx = 0
  let c = 0
  while (c < 2) {
    idx = h.toLowerCase().indexOf(n.toLowerCase(), idx)
    if (idx < 0) break
    const snip = h.slice(idx, idx + 200).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    console.log(`[${n}]`, snip.slice(0, 180))
    idx += n.length
    c++
  }
}

// Find table with multiple PremiumsWrittenGross rows in visible HTML
const re = /PremiumsWrittenGross[\s\S]{0,5000}?<\/table>/gi
let m
let i = 0
while ((m = re.exec(h)) && i < 3) {
  const rows = [...m[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
  if (rows.length >= 4) {
    console.log('\n=== Premiums table candidate ===')
    for (const r of rows.slice(0, 12)) {
      const cells = [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map((c) => c[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
      if (cells.length >= 2) console.log(cells.join(' | ').slice(0, 200))
    }
    i++
  }
}

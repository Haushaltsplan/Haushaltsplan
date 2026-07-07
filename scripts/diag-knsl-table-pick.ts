import { readFileSync } from 'fs'

const h = readFileSync('scripts/.cache-KNSL.html', 'utf8')
const idx = h.search(/premiums written by division/i)
console.log('idx', idx)
const chunk = h.slice(idx, idx + 100_000)
const t0 = chunk.indexOf('<table')
const t1 = chunk.indexOf('</table>', t0)
const table = chunk.slice(t0, t1 + 8)
console.log('table len', table.length)

const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
let found = 0
for (const row of rows) {
  const z0 = row[1].replace(/<[^>]+>/g, ' ').trim()
  if (/total (commercial|personal)/i.test(z0)) {
    console.log('FOUND', z0.slice(0, 100))
    found++
  }
}
console.log('found rows', found)

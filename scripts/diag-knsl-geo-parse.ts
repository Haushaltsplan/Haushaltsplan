import { readFileSync } from 'fs'
import { anteileBerechnen } from '../lib/portfolio-analyse/sec-edgar-segment-extraktion.ts'

const h = readFileSync('scripts/.cache-KNSL.html', 'utf8')
const idx = h.search(/premiums written by division/i)
const chunk = h.slice(idx, idx + 100_000)
const table = chunk.slice(chunk.indexOf('<table'), chunk.indexOf('</table>', chunk.indexOf('<table')) + 8)

function zellenText(tdHtml: string): string {
  return tdHtml.replace(/<[^>]+>/g, ' ').replace(/&#\d+;/g, ' ').replace(/\s+/g, ' ').trim()
}

const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
const jahre: number[] = []
for (const row of rows.slice(0, 6)) {
  const zellen = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => zellenText(c[1]!))
  for (const z of zellen) {
    const y = parseInt(z, 10)
    if (y >= 2015 && y <= 2035) jahre.push(y)
  }
  if (jahre.length >= 2) break
}
console.log('jahre', jahre)

for (const row of rows) {
  const zellen = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => zellenText(c[1]!))
  if (zellen.length < 2) continue
  const label = zellen[0]!.toLowerCase()
  if (!label.startsWith('total commercial') && !label.startsWith('total personal')) continue
  console.log(label, 'zellen', zellen.slice(1, 10))
  const betraege: number[] = []
  for (const z of zellen.slice(1)) {
    const s = z.replace(/[$,%]/g, '').replace(/\s/g, '').trim()
    if (!/^\d{1,3}(?:,\d{3})+$/.test(s)) continue
    const n = parseFloat(s.replace(/,/g, ''))
    if (n >= 10_000) betraege.push(n)
  }
  console.log(label, 'betraege', betraege)
}

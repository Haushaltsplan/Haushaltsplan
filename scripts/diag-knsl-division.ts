import { readFileSync, writeFileSync } from 'fs'
import {
  parseMehrjahresSegmenteDetail,
} from '../lib/portfolio-analyse/sec-edgar-segment-extraktion.ts'

const h = readFileSync('scripts/.cache-KNSL.html', 'utf8')
const idx = h.indexOf('premiums written by division')
const chunk = h.slice(idx, idx + 80000)
const t0 = chunk.indexOf('<table')
const t1 = chunk.indexOf('</table>', t0)
const table = chunk.slice(t0, t1 + 8)
writeFileSync('scripts/.cache-KNSL-division-table.html', table)

const det = parseMehrjahresSegmenteDetail(table, 'produkt')
console.log('parse detail:', det.length, 'years')
for (const j of det) {
  console.log(j.jahr, j.segmente.length, 'segs', j.segmente.slice(0, 5).map((s) => `${s.name}=${s.umsatzMio}`).join(', '))
}

const text = table.replace(/<[^>]+>/g, '\n').replace(/\s+/g, ' ')
const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean)
console.log('\nLines with %:', lines.filter((l) => /%|Commercial|Personal|Property|Casualty/i.test(l)).slice(0, 30).join('\n'))

// search geo table
for (const kw of ['premiums written by state', 'geographic', 'by region', 'United States', 'Personal:']) {
  const i = h.toLowerCase().indexOf(kw.toLowerCase())
  if (i >= 0) {
    console.log(`\nFound "${kw}" at ${i}:`, h.slice(i, i + 150).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '))
  }
}

import { readFileSync } from 'fs'
import { parseMehrjahresSegmenteDetail } from '../lib/portfolio-analyse/sec-edgar-segment-extraktion.ts'

const h = readFileSync('scripts/.cache-KNSL.html', 'utf8')
const idx = h.indexOf('UNITED STATES', 200000)
console.log('idx', idx)
const chunk = h.slice(idx - 500, idx + 15000)
const t0 = chunk.indexOf('<table')
if (t0 >= 0) {
  const t1 = chunk.indexOf('</table>', t0)
  const table = chunk.slice(t0, t1 + 8)
  console.log('table text:', table.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 500))
  const det = parseMehrjahresSegmenteDetail(table, 'geo')
  console.log('geo parse:', det.length, det.map((j) => j.segmente.map((s) => s.name).join('|')).join('; '))
}

// Commercial vs Personal as 2-segment "geo" fallback from division table
const divIdx = h.indexOf('premiums written by division')
const divChunk = h.slice(divIdx, divIdx + 80000)
const dt0 = divChunk.indexOf('<table')
const dt1 = divChunk.indexOf('</table>', dt0)
const divTable = divChunk.slice(dt0, dt1 + 8)
const det = parseMehrjahresSegmenteDetail(divTable, 'produkt')
console.log('\nDivision table segments:', det[0]?.segmente.map((s) => s.name).join(', '))

// Extract Commercial total vs Personal total manually
const text = divTable.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
for (const label of ['Total commercial', 'Total personal', 'Total gross written premiums']) {
  const m = text.match(new RegExp(label + '[^$]*\\$?\\s*([\\d,]+)'))
  console.log(label, m?.[1])
}

import { readFileSync } from 'fs'
import { parseMehrjahresSegmenteDetail } from '../lib/portfolio-analyse/sec-edgar-segment-extraktion.ts'

const h = readFileSync('scripts/.cache-KNSL-division-table.html', 'utf8')
const det = parseMehrjahresSegmenteDetail(h, 'produkt')
for (const j of det) {
  const totals = j.segmente.filter((s) => /total/i.test(s.name))
  console.log(j.jahr, 'totals:', totals.map((s) => `${s.name}=${s.umsatzMio}`).join(', '))
}

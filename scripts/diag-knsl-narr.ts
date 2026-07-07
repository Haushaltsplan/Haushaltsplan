import { readFileSync } from 'fs'
import { extrahiereNarrativeSegmentTabellen } from '../lib/portfolio-analyse/sec-edgar-narrative-tabellen.ts'

const h = readFileSync('scripts/.cache-KNSL.html', 'utf8')
const r = extrahiereNarrativeSegmentTabellen(h)
console.log('geo years', r.geo.length)
for (const j of r.geo) {
  console.log(j.jahr, j.segmente.map((s) => `${s.name}=${s.umsatzMio}`).join(', '))
}

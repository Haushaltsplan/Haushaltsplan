/**
 * npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/diag-googl-q4.ts
 */
import { ladeSecSegmentHistorie } from '../lib/portfolio-analyse/sec-edgar-segment-historie-server'

async function main() {
  const p = await ladeSecSegmentHistorie('GOOGL')
  if (!p) {
    console.log('null paket')
    return
  }
  console.log('quelle', p.quelle, 'berichtJahr', p.berichtJahr)
  console.log(
    'produkt jahre',
    p.produkt?.jahre.map((j) => j.jahr).join(','),
  )
  console.log(
    'produkt segs',
    p.produkt?.jahre.at(-1)?.segmente.map((s) => s.name).join(' | '),
  )
  const pq = p.produktQuartale?.perioden ?? []
  console.log(
    'quartale',
    pq.map((x) => `${x.label}${x.quartal === 4 ? '*' : ''}`).join(', '),
  )
  console.log('q4 count', pq.filter((x) => x.quartal === 4).length)
  for (const q of pq.filter((x) => x.quartal === 4).slice(-3)) {
    console.log(
      q.label,
      q.segmente.map((s) => `${s.name}:${s.anteilPct}`).join(' | '),
    )
  }
  const geoq = p.geoQuartale?.perioden ?? []
  console.log(
    'geo quartale',
    geoq.map((x) => `${x.label}${x.quartal === 4 ? '*' : ''}`).join(', '),
  )
  console.log('geo q4', geoq.filter((x) => x.quartal === 4).length)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

/**
 * npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/diag-segment-jahre.ts GOOGL
 */
import { ladeSecSegmentHistorie } from '../lib/portfolio-analyse/sec-edgar-segment-historie-server'

async function main() {
  const ticker = (process.argv[2] ?? 'GOOGL').toUpperCase()
  const p = await ladeSecSegmentHistorie(ticker)
  if (!p) {
    console.log('null paket')
    return
  }
  const jahre = p.produkt?.jahre?.map((j) => j.jahr) ?? []
  console.log('quelle', p.quelle, 'bericht', p.berichtJahr, 'cacheV', 'anzahl10k', p.anzahl10k)
  console.log('produkt jahre', jahre.join(','))
  console.log('has2023', jahre.includes(2023))
  const gaps: string[] = []
  for (let i = 1; i < jahre.length; i++) {
    if (jahre[i]! - jahre[i - 1]! > 1) gaps.push(`${jahre[i - 1]}→${jahre[i]}`)
  }
  console.log('gaps', gaps)
  console.log('geo jahre', (p.geo?.jahre ?? []).map((j) => j.jahr).join(','))
  for (const j of p.produkt?.jahre ?? []) {
    if (j.jahr < 2020) continue
    console.log(
      j.jahr,
      j.segmente.map((s) => `${s.name}:${s.anteilPct ?? '?'}`).join(' | '),
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

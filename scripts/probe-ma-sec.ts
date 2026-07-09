/** Test SEC segment historie for MA. */
async function main() {
  const { ladeSecSegmentHistorie } = await import('../lib/portfolio-analyse/sec-edgar-segment-historie-server')
  const paket = await ladeSecSegmentHistorie('MA')
  const j = paket?.produkt?.jahre.at(-1)
  const sum = j?.segmente.reduce((a, s) => a + (s.umsatzMio ?? 0), 0) ?? 0
  console.log('quelle', paket?.quelle)
  console.log('produkt segs', paket?.produkt?.segmentNamen)
  console.log('FY', j?.jahr, (sum / 1000).toFixed(1) + 'B')
  console.log(j?.segmente.map((s) => `${s.name} ${s.anteilPct?.toFixed(0)}%`).join(' | '))
  const gj = paket?.geo?.jahre.at(-1)
  console.log('geo', gj?.segmente.map((s) => s.name).join(' | '))
}

main().catch(console.error)

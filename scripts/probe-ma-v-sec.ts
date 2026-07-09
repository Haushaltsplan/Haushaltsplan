/** Compare MS vs SEC for MA and V. */
async function main() {
  const { ladeMarketscreenerSegmentHistorie } = await import(
    '../lib/portfolio-analyse/marketscreener-segment-historie-server'
  )
  const { ladeSecSegmentHistorie } = await import('../lib/portfolio-analyse/sec-edgar-segment-historie-server')

  for (const t of ['MA', 'V'] as const) {
    const isin = t === 'MA' ? 'US57636Q1040' : 'US92826C8394'
    const name = t === 'MA' ? 'Mastercard' : 'Visa'
    const ms = await ladeMarketscreenerSegmentHistorie({
      isin,
      name,
      ticker: t,
      symbolYahoo: t,
      refresh: true,
    })
    const sec = await ladeSecSegmentHistorie(t)
    const mj = ms?.produkt?.jahre.at(-1)
    const sj = sec?.produkt?.jahre.at(-1)
    console.log('\n', t, 'MS prod segs:', mj?.segmente.map((s) => s.name).join(' | '))
    console.log(t, 'SEC prod segs:', sj?.segmente.map((s) => `${s.name} ${s.anteilPct?.toFixed(0)}%`).join(' | '))
  }
}

main().catch(console.error)

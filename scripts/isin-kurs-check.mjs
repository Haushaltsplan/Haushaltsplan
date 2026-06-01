import { lookupIsinMetadaten } from '../lib/portfolio-analyse/isin-lookup-server.ts'
import { ladeYahooKurse } from '../lib/portfolio-analyse/yahoo-kurse-server.ts'

const isin = process.argv[2] ?? 'IE00BJXRZJ40'
const m = await lookupIsinMetadaten([isin])
console.log('meta:', JSON.stringify(m, null, 2))
const sym = m[0]?.symbolYahoo
if (sym) {
  const k = await ladeYahooKurse([sym, 'CYBR', 'CYBR.L', 'CYBP.L', '2B7K.DE', 'RCRS.DE', 'RCRS.GR', 'XDWP.DE'])
  for (const [s, v] of k) console.log('kurs', s, v)
}

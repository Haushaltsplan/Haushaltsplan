import { lookupIsinMetadaten } from '../lib/portfolio-analyse/isin-lookup-server.ts'
import { ladeYahooKurse } from '../lib/portfolio-analyse/yahoo-kurse-server.ts'

const cases = [
  ['FR0000052292', 'Hermès', 1708],
  ['IE00BLNMYC90', 'S&P 500 Equal Weight ETF', 96],
  ['US5801351017', 'McDonalds', 245],
]

const isins = cases.map((c) => c[0])
const meta = await lookupIsinMetadaten(isins)
const syms = [...new Set(meta.map((m) => m.symbolYahoo).filter(Boolean))]
const extra = ['RMS.PA', 'MC.PA', 'XDEW.DE', 'XDWE.DE', 'SPPE.DE', 'A1106A.DE', 'MCD', 'MCD.DE']
const k = await ladeYahooKurse([...syms, ...extra])

for (const [isin, name, einstand] of cases) {
  const m = meta.find((x) => x.isin === isin)
  const sym = m?.symbolYahoo
  const row = sym ? k.get(sym.toUpperCase()) : null
  console.log('\n', isin, name)
  console.log('  meta:', sym, m?.name?.slice(0, 50))
  console.log('  kurs:', row?.preis, 'einstand~', einstand, 'ratio', row?.preis ? row.preis / einstand : null)
}

import {
  baueUmsatzProJahrAusMacrotrends,
  loeseMacrotrendsIdent,
  ladeMacrotrendsFundamentaldaten,
} from '../lib/portfolio-analyse/macrotrends-scraper-server'

const cases = [
  { t: 'H11', name: 'Halma', slug: 'halma', mt: 'HLMA' },
  { t: 'SIKA', name: 'Sika', slug: 'sika', mt: 'SXYAY' },
  { t: 'ATD', name: 'Couche-Tard', slug: 'alimentation-couche-tard', mt: 'ATD' },
  { t: 'RMS', name: 'Hermes', slug: 'hermes-international', mt: 'HESAY' },
]

async function main() {
  for (const c of cases) {
    const ident = await loeseMacrotrendsIdent(c.t, {
      erwarteterTicker: c.t,
      firmenname: c.name,
      slug: c.slug,
      macrotrendsTicker: c.mt,
    })
    console.log(c.t, ident)
    if (!ident) continue
    const m = await baueUmsatzProJahrAusMacrotrends(ident)
    console.log('  umsatz', m.size, [...m.entries()].slice(-2))
    const roh = await ladeMacrotrendsFundamentaldaten(ident)
    console.log('  zeilen', roh?.zeilen.length)
  }
}

main().catch(console.error)

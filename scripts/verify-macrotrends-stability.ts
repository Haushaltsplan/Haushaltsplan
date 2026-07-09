/** Smoke-Test Macrotrends nach Stabilitäts-Optimierung. */
import {
  ladeMacrotrendsFundamentaldaten,
  loeseMacrotrendsIdent,
} from '../lib/portfolio-analyse/macrotrends-scraper-server'

const TICKER = [
  { t: 'MSFT', name: 'Microsoft' },
  { t: 'MA', name: 'Mastercard' },
  { t: 'HESAY', name: 'Hermès', slug: 'hermes-international' },
]

async function main() {
  for (const x of TICKER) {
    const t0 = Date.now()
    const ident =
      x.slug != null
        ? { ticker: x.t, slug: x.slug, firmenname: x.name }
        : await loeseMacrotrendsIdent(x.t, { erwarteterTicker: x.t, firmenname: x.name })
    if (!ident) {
      console.log('FAIL', x.t, 'kein Ident')
      continue
    }
    const roh = await ladeMacrotrendsFundamentaldaten(ident)
    const ms = Date.now() - t0
    const zeilen = roh?.zeilen.length ?? 0
    const perioden = roh?.perioden.length ?? 0
    const umsatz = roh?.zeilen.find((z) => z.id === 'umsatz')
    const kgv = roh?.zeilen.find((z) => z.id === 'kgv')
    const roe = roh?.zeilen.find((z) => z.id === 'roe')
    const fy = roh?.perioden.filter((p) => !p.istLtm).at(-1)?.iso
    console.log(
      zeilen >= 20 ? 'OK' : 'WARN',
      x.t,
      `${ms}ms`,
      `zeilen=${zeilen}`,
      `perioden=${perioden}`,
      `FY=${fy}`,
      `umsatz=${umsatz?.werte[fy ?? ''] ?? umsatz?.werte['ttm']}`,
      `kgv=${kgv?.werte['ttm'] ?? kgv?.werte[fy ?? '']}`,
      `roe=${roe?.werte[fy ?? '']}`,
    )
  }
}

main().catch(console.error)

/**
 * Prüft US: Produkt + Ländermix aus SEC, ≥10 Jahre wo möglich.
 *   npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/verify-us-sec-segment-first.ts
 */
import { ladeGescrapteSegmentStruktur } from '../lib/portfolio-analyse/segment-struktur-scraper-server'

async function main() {
  for (const t of [
    { ticker: 'MSFT', isin: 'US5949181045', name: 'Microsoft' },
    { ticker: 'V', isin: 'US92826C8394', name: 'Visa' },
  ] as const) {
    console.log(`\n=== ${t.ticker} ===`)
    const paket = await ladeGescrapteSegmentStruktur({
      ...t,
      symbolYahoo: t.ticker,
      refresh: true,
    })
    if (!paket) {
      console.log('NULL')
      continue
    }
    console.log('quelle=', paket.quelle, 'secErgaenzt=', paket.secErgaenzt ?? false)
    console.log(
      'produkt=',
      paket.produkt?.anzahlJahre,
      'J ·',
      paket.produkt?.segmentNamen?.slice(0, 4).join(' | '),
    )
    console.log(
      'geo=',
      paket.geo?.anzahlJahre,
      'J ·',
      paket.geo?.segmentNamen?.join(' | '),
    )
    const secOk =
      paket.quelle === 'sec_edgar' || (paket.quelle === 'mixed' && !paket.secErgaenzt)
    const beide =
      (paket.produkt?.anzahlJahre ?? 0) >= 2 && (paket.geo?.anzahlJahre ?? 0) >= 2
    console.log('secBeideAchsen=', secOk && beide && paket.quelle === 'sec_edgar')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

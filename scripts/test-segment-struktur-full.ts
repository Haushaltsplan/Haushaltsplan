/** npx tsx scripts/test-segment-struktur-full.ts */
import { ladeGescrapteSegmentStruktur } from '../lib/portfolio-analyse/segment-struktur-scraper-server'

async function test(label: string, opts: Parameters<typeof ladeGescrapteSegmentStruktur>[0]) {
  const paket = await ladeGescrapteSegmentStruktur({ ...opts, refresh: true })
  console.log('\n===', label, '===')
  if (!paket) {
    console.log('NULL')
    return
  }
  console.log('quelle', paket.quelle)
  console.log('produkt', paket.produkt?.anzahlJahre, paket.produkt?.segmentNamen?.join(', '))
  console.log('geo', paket.geo?.anzahlJahre, paket.geo?.segmentNamen?.slice(0, 3).join(', '))
  console.log('backlog', paket.backlog?.label, paket.backlog?.anzahlJahre, paket.backlog?.juengstesJahr)
}

async function main() {
  await test('MSFT', { isin: 'US5949181045', name: 'Microsoft', symbolYahoo: 'MSFT', ticker: 'MSFT' })
  await test('NOW', { isin: 'US81762P1021', name: 'ServiceNow', symbolYahoo: 'NOW', ticker: 'NOW' })
  await test('ANET', { isin: 'US0404132054', name: 'Arista Networks', symbolYahoo: 'ANET', ticker: 'ANET' })
}

main()

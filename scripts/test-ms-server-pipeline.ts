/** npx tsx scripts/test-ms-server-pipeline.ts */
import {
  extrahiereMsSegmentHistorien,
  htmlHatMsSegmentDaten,
} from '../lib/portfolio-analyse/marketscreener-segment-parser'
import { bekannterMarketscreenerSlug } from '../lib/portfolio-analyse/marketscreener-slug'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const TEST = [
  { isin: 'US02079K3059', name: 'Alphabet' },
  { isin: 'US5949181045', name: 'Microsoft' },
  { isin: 'NL0010273215', name: 'ASML' },
  { isin: 'US57636Q1040', name: 'Mastercard' },
  { isin: 'US92826C8394', name: 'Visa' },
  { isin: 'FR0000052292', name: 'Hermès' },
] as const

async function fetchHtml(slug: string): Promise<string | null> {
  const res = await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
  })
  if (!res.ok) return null
  const html = await res.text()
  return html.length > 8000 ? html : null
}

function uiWuerdeAnzeigen(produkt: ReturnType<typeof extrahiereMsSegmentHistorien>['produkt'], geo: typeof produkt) {
  const hatProdukt = (produkt?.segmentNamen.length ?? 0) >= 2
  const hatGeo = (geo?.segmentNamen.length ?? 0) >= 2
  return hatProdukt || hatGeo
}

async function main() {
  let ok = 0
  for (const t of TEST) {
    const slug = bekannterMarketscreenerSlug(t.isin)
    if (!slug) {
      console.log(`FAIL ${t.name.padEnd(12)} kein Slug`)
      continue
    }
    const html = await fetchHtml(slug)
    if (!html) {
      console.log(`FAIL ${t.name.padEnd(12)} HTML`)
      continue
    }
    const hatDaten = htmlHatMsSegmentDaten(html)
    const { produkt, geo } = extrahiereMsSegmentHistorien(html)
    const ui = uiWuerdeAnzeigen(produkt, geo)
    const line =
      `${hatDaten && ui ? 'OK' : 'FAIL'} ${t.name.padEnd(12)} ` +
      `p=${produkt?.segmentNamen.length ?? 0}seg/${produkt?.anzahlJahre ?? 0}J ` +
      `g=${geo?.segmentNamen.length ?? 0}seg/${geo?.anzahlJahre ?? 0}J ui=${ui}`
    console.log(line)
    if (hatDaten && ui) ok++
    await new Promise((r) => setTimeout(r, 350))
  }
  console.log(`\n${ok}/${TEST.length} würden in UI erscheinen`)
  process.exit(ok === TEST.length ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

/** npx tsx scripts/test-msci-segment.ts */
import { isinKenntnis } from '../lib/portfolio-analyse/isin-kenntnisse'
import { bekannterMarketscreenerSlug } from '../lib/portfolio-analyse/marketscreener-slug'
import {
  extrahiereMsSegmentHistorien,
  htmlHatMsSegmentDaten,
} from '../lib/portfolio-analyse/marketscreener-segment-parser'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function main() {
  const isin = 'US55354G1004'
  const k = isinKenntnis(isin)
  const slug = bekannterMarketscreenerSlug(isin)
  console.log('slug', slug, 'symbol', k?.symbolYahoo)

  const html = await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`, {
    headers: {
      'User-Agent': UA,
      Referer: 'https://www.marketscreener.com/',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  }).then((r) => r.text())

  console.log('html len', html.length, 'has data', htmlHatMsSegmentDaten(html))
  const { produkt, geo } = extrahiereMsSegmentHistorien(html)
  console.log('produkt', produkt?.anzahlJahre, produkt?.segmentNamen)
  console.log('geo', geo?.anzahlJahre, geo?.segmentNamen?.slice(0, 3))
  console.log('marge sample', produkt?.jahre.at(-1)?.segmente.map((s) => `${s.name}:${s.margePct}%`))
}

main()

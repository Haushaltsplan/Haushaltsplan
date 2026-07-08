/** npx tsx scripts/probe-visa-slug.ts */
import { extrahiereMsSegmentHistorien, htmlHatMsSegmentDaten } from '../lib/portfolio-analyse/marketscreener-segment-parser'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

async function probe(slug: string) {
  const html = await (
    await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`, {
      headers: { 'User-Agent': UA },
    })
  ).text()
  const { produkt, geo } = extrahiereMsSegmentHistorien(html)
  console.log(
    slug,
    html.length,
    htmlHatMsSegmentDaten(html),
    `p=${produkt?.anzahlJahre ?? 0}`,
    `g=${geo?.anzahlJahre ?? 0}`,
  )
}

async function main() {
  for (const slug of ['VISA-INC-6469', 'VISA-INC-4849', 'VISA-INC-14750', 'VISA-INC-10355']) {
    await probe(slug)
  }
  const search = await fetch('https://www.marketscreener.com/search/?q=US92826C8394', {
    headers: { 'User-Agent': UA },
  }).then((r) => r.text())
  const slugs = [...search.matchAll(/href="\/quote\/stock\/([A-Z0-9-]+-\d+)\//g)].map((m) => m[1])
  console.log('search slugs', [...new Set(slugs)].slice(0, 5))
}

main()

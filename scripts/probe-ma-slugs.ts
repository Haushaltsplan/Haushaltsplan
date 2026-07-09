/** Find correct MS slug for Mastercard with 2 product segments. */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const SLUGS = [
  'MASTERCARD-INC-17163',
  'MASTERCARD-INC-476382',
  'MASTERCARD-INC-476383',
  'MASTERCARD-INCORPORATED-12718521',
  'MASTERCARD-INC-19343939',
  'MASTERCARD-INCORPORATED-40202183',
  'MASTERCARD-INCORPORATED-43257833',
  'MASTERCARD-INC-50914952',
]

async function probe(slug: string) {
  const html = await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`, {
    headers: { 'User-Agent': UA, Referer: 'https://www.marketscreener.com/' },
  }).then((r) => r.text())
  const title = html.match(/<title>([^<]+)/)?.[1] ?? ''
  const { extrahiereMsSegmentHistorien } = await import('../lib/portfolio-analyse/marketscreener-segment-parser')
  const { produkt, geo } = extrahiereMsSegmentHistorien(html)
  const j = produkt?.jahre.at(-1)
  const sum = j?.segmente.reduce((a, s) => a + (s.umsatzMio ?? 0), 0) ?? 0
  console.log(
    slug.padEnd(35),
    title.slice(0, 45).padEnd(46),
    `prod:${produkt?.segmentNamen.length ?? 0}`,
    (sum / 1000).toFixed(1) + 'B',
    j?.segmente.map((s) => s.name).join(' | ') ?? '—',
  )
  if (geo?.segmentNamen.length) {
    console.log('  geo:', geo.segmentNamen.slice(0, 4).join(' | '))
  }
}

async function main() {
  for (const s of SLUGS) await probe(s)
}

main().catch(console.error)

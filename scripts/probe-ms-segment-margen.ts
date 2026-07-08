/** npx tsx scripts/probe-ms-segment-margen.ts */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function main() {
  const slug = 'ALPHABET-INC-24203373'
  const html = await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`, {
    headers: { 'User-Agent': UA, Referer: 'https://www.marketscreener.com/' },
  }).then((r) => r.text())

  const chartIds = [...html.matchAll(/id="(financialSegment[^"]+)"/g)].map((m) => m[1]!)
  console.log('chart ids', [...new Set(chartIds)])

  for (const id of [...new Set(chartIds)].slice(0, 12)) {
    const pos = html.indexOf(`id="${id}"`)
    const chunk = html.slice(pos, pos + 2000)
    const label = chunk.match(/<h\d[^>]*>([^<]{5,80})</)?.[1] ?? chunk.match(/title="([^"]{5,80})"/)?.[1]
    console.log('\n', id, label?.trim())
  }

  for (const kw of ['margin', 'operating income', 'ebit', 'profit', 'result', 'marge', 'operating']) {
    const hits = [...html.matchAll(new RegExp(`>([^<]{0,60}${kw}[^<]{0,40})<`, 'gi'))].map((m) => m[1]!.trim())
    if (hits.length) console.log('\nKW', kw, [...new Set(hits)].slice(0, 8))
  }
}

main()

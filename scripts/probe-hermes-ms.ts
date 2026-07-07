const UA = 'Mozilla/5.0'
const slug = 'HERMES-INTERNATIONAL-4657'
const isin = 'FR0000052292'

async function main() {
  for (const path of ['/', '/company/', '/finances/', '/finances-segments/']) {
    const html = await (
      await fetch(`https://www.marketscreener.com/quote/stock/${slug}${path}`, {
        headers: { 'User-Agent': UA },
      })
    ).text()
    console.log(
      path,
      'isin',
      html.includes(isin),
      'CA1',
      html.includes('financialSegmentCA1'),
      'CA2',
      html.includes('financialSegmentCA2'),
      'table',
      /Breakdown by Business Segment/i.test(html),
    )
  }
  const search = await (
    await fetch(`https://www.marketscreener.com/search/?q=${isin}`, { headers: { 'User-Agent': UA } })
  ).text()
  console.log('search isin', search.includes(isin))
  const slugs = [...search.matchAll(/href="\/quote\/stock\/([A-Z0-9-]+-\d+)\//g)].map((m) => m[1])
  console.log('slugs', [...new Set(slugs)].slice(0, 8))
}

main()

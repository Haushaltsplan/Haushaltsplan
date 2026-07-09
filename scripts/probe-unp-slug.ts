/** Einmal-Probe: korrekter Marketscreener-Slug für Union Pacific. */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://www.marketscreener.com/' } })
  return res.text()
}

async function probeSlug(slug: string) {
  const html = await fetchHtml(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`)
  const title = html.match(/<title>([^<]+)/)?.[1] ?? ''
  const sym = html.match(/"logoSymbol":"([^"]+)"/)?.[1] ?? ''
  const name = html.match(/"name":"([^"]+)"/)?.[1] ?? ''
  const { extrahiereMsSegmentHistorien } = await import(
    '../lib/portfolio-analyse/marketscreener-segment-parser'
  )
  const { produkt } = extrahiereMsSegmentHistorien(html)
  const sum = produkt?.jahre.at(-1)?.segmente.reduce((a, s) => a + (s.umsatzMio ?? 0), 0) ?? 0
  console.log(slug)
  console.log('  title:', title.slice(0, 70))
  console.log('  sym:', sym, 'name:', name)
  console.log('  prod B:', (sum / 1000).toFixed(1))
  console.log('  segs:', produkt?.jahre.at(-1)?.segmente.map((s) => s.name).join(' | '))
}

async function searchSlugs(q: string) {
  const html = await fetchHtml(`https://www.marketscreener.com/search/?q=${encodeURIComponent(q)}`)
  const slugs = [...new Set([...html.matchAll(/href="\/quote\/stock\/([A-Z0-9-]+-\d+)\//g)].map((m) => m[1]!))]
  console.log('\nsearch', q, '→', slugs.slice(0, 10))
  return slugs
}

async function main() {
  await probeSlug('UNION-PACIFIC-CORPORATION-14750')
  await probeSlug('UNION-PACIFIC-CORPORATION-14754')
  await probeSlug('UNITEDHEALTH-GROUP-INC-14750')
  const fromIsin = await searchSlugs('US9078181081')
  for (const s of fromIsin.filter((x) => x.includes('UNION-PACIFIC')).slice(0, 3)) {
    await probeSlug(s)
  }
}

main().catch(console.error)

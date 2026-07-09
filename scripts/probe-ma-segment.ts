/** Probe Mastercard segment data from MS + SA. */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function probeMs(slug: string) {
  const html = await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`, {
    headers: { 'User-Agent': UA, Referer: 'https://www.marketscreener.com/' },
  }).then((r) => r.text())
  const title = html.match(/<title>([^<]+)/)?.[1] ?? ''
  const { extrahiereMsSegmentHistorien } = await import('../lib/portfolio-analyse/marketscreener-segment-parser')
  const { produkt, geo } = extrahiereMsSegmentHistorien(html)
  const j = produkt?.jahre.at(-1)
  const sum = j?.segmente.reduce((a, s) => a + (s.umsatzMio ?? 0), 0) ?? 0
  console.log('\nMS', slug)
  console.log('  title:', title.slice(0, 70))
  console.log('  prod FY', j?.jahr, '~', (sum / 1000).toFixed(1), 'B')
  console.log('  segs:', j?.segmente.map((s) => `${s.name} ${s.anteilPct?.toFixed(0) ?? '?'}%`).join(' | '))
  const gj = geo?.jahre.at(-1)
  console.log('  geo:', gj?.segmente.map((s) => s.name).join(' | ') ?? '—')
}

async function probeSa() {
  const { ladeStockanalysisSegmentPaket } = await import('../lib/portfolio-analyse/stockanalysis-segment-server')
  const paket = await ladeStockanalysisSegmentPaket({
    isin: 'US57636Q1040',
    ticker: 'MA',
    symbolYahoo: 'MA',
    refresh: true,
  })
  const j = paket?.produkt?.jahre.at(-1)
  const sum = j?.segmente.reduce((a, s) => a + (s.umsatzMio ?? 0), 0) ?? 0
  console.log('\nSA produkt FY', j?.jahre, j?.jahr, '~', (sum / 1000).toFixed(1), 'B')
  console.log('  segs:', j?.segmente.map((s) => `${s.name} ${s.anteilPct?.toFixed(0) ?? '?'}%`).join(' | '))
}

async function searchSlugs() {
  const html = await fetch('https://www.marketscreener.com/search/?q=US57636Q1040', {
    headers: { 'User-Agent': UA },
  }).then((r) => r.text())
  const slugs = [...new Set([...html.matchAll(/href="\/quote\/stock\/([A-Z0-9-]+-\d+)\//g)].map((m) => m[1]!))]
  console.log('ISIN search slugs:', slugs.filter((s) => /MASTERCARD/i.test(s)))
}

async function main() {
  await probeMs('MASTERCARD-INC-17163')
  await searchSlugs()
  await probeSa()
}

main().catch(console.error)

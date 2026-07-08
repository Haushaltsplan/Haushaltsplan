/** npx tsx scripts/probe-ms-vs-sa-merge.ts */
import { bekannterMarketscreenerSlug } from '../lib/portfolio-analyse/marketscreener-slug'
import { extrahiereMsSegmentHistorien } from '../lib/portfolio-analyse/marketscreener-segment-parser'
import { extrahiereStockanalysisSegmentHistorieAusHtml } from '../lib/portfolio-analyse/stockanalysis-segment-parser'
import { saMetrikPfade } from '../lib/portfolio-analyse/stockanalysis-metrik-pfade'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

async function probe(isin: string, ticker: string, name: string) {
  const slug = bekannterMarketscreenerSlug(isin)
  const msHtml = await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`, {
    headers: { 'User-Agent': UA, Referer: 'https://www.marketscreener.com/' },
  }).then((r) => r.text())
  const ms = extrahiereMsSegmentHistorien(msHtml).produkt
  let sa = null
  for (const p of saMetrikPfade({ isin, symbolYahoo: ticker, ticker }, 'revenue-by-segment/')) {
    const html = await fetch(`https://stockanalysis.com${p}`, { headers: { 'User-Agent': UA } }).then((r) => r.text())
    sa = extrahiereStockanalysisSegmentHistorieAusHtml(html, 'produkt', ticker)
    if (sa) break
  }
  const sum = (h: typeof ms) => h?.jahre.at(-1)?.segmente.reduce((a, s) => a + (s.umsatzMio ?? 0), 0) ?? 0
  console.log(
    name.padEnd(12),
    'MS',
    ms?.juengstesJahr,
    (sum(ms) / 1000).toFixed(1) + 'B',
    'SA',
    sa?.juengstesJahr,
    (sum(sa) / 1000).toFixed(1) + 'B',
    'ratio',
    (sum(ms) / sum(sa)).toFixed(2),
  )
}

async function main() {
  await probe('US7611521078', 'RMD', 'ResMed')
  await probe('US5949181045', 'MSFT', 'Microsoft')
  await probe('NL0010273215', 'ASML', 'ASML')
  await probe('US81762P1021', 'NOW', 'ServiceNow')
  await probe('CH0418792922', 'SIKA', 'Sika')
}

main()

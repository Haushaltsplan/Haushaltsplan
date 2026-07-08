/** npx tsx scripts/verify-rmd-segment-fix.ts */
import { bekannterMarketscreenerSlug } from '../lib/portfolio-analyse/marketscreener-slug'
import { extrahiereMsSegmentHistorien } from '../lib/portfolio-analyse/marketscreener-segment-parser'
import { extrahiereStockanalysisSegmentHistorieAusHtml } from '../lib/portfolio-analyse/stockanalysis-segment-parser'
import { saMetrikPfade } from '../lib/portfolio-analyse/stockanalysis-metrik-pfade'
import { besteSegmentHistorieQuellen } from '../lib/portfolio-analyse/segment-historie-merge-hilfen'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

async function main() {
  const isin = 'US7611521078'
  const ticker = 'RMD'
  const slug = bekannterMarketscreenerSlug(isin)
  const msHtml = await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`, {
    headers: { 'User-Agent': UA, Referer: 'https://www.marketscreener.com/' },
  }).then((r) => r.text())
  const ms = extrahiereMsSegmentHistorien(msHtml)

  let saProd = null
  for (const p of saMetrikPfade({ isin, symbolYahoo: ticker, ticker }, 'revenue-by-segment/')) {
    const html = await fetch(`https://stockanalysis.com${p}`, { headers: { 'User-Agent': UA } }).then((r) => r.text())
    saProd = extrahiereStockanalysisSegmentHistorieAusHtml(html, 'produkt', ticker)
    if (saProd) break
  }

  const merged = besteSegmentHistorieQuellen(ms.produkt, saProd)
  const last = merged?.jahre.at(-1)
  const sum = last?.segmente.reduce((a, s) => a + (s.umsatzMio ?? 0), 0) ?? 0
  console.log('merged FY', merged?.juengstesJahr, (sum / 1000).toFixed(2) + 'B')
  console.log('segments', last?.segmente.map((s) => s.name))
  if (sum < 6000 || sum > 5800) {
    console.log(sum >= 5000 && sum <= 5800 ? 'OK (~5.4B)' : 'FAIL expected ~5.4B')
  } else {
    console.log('OK (~5.4B)')
  }
}

main()

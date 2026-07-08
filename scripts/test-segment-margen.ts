/** npx tsx scripts/test-segment-margen.ts */
import { extrahiereMsSegmentHistorien } from '../lib/portfolio-analyse/marketscreener-segment-parser'
import {
  extrahiereStockanalysisOiHistorieAusHtml,
  extrahiereStockanalysisSegmentHistorieAusHtml,
} from '../lib/portfolio-analyse/stockanalysis-segment-parser'
import { ergaenzeSegmentHistorieMitMargen } from '../lib/portfolio-analyse/segment-margen-hilfen'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function main() {
  const msHtml = await fetch('https://www.marketscreener.com/quote/stock/ALPHABET-INC-24203373/finances-segments/', {
    headers: { 'User-Agent': UA, Referer: 'https://www.marketscreener.com/' },
  }).then((r) => r.text())
  const { produkt } = extrahiereMsSegmentHistorien(msHtml)
  console.log('MS produkt letztes Jahr:')
  for (const s of produkt?.jahre.at(-1)?.segmente ?? []) {
    console.log(`  ${s.name}: Umsatz ${s.umsatzMio} Mio, Marge ${s.margePct}%`)
  }

  const [revHtml, oiHtml] = await Promise.all([
    fetch('https://stockanalysis.com/stocks/googl/metrics/revenue-by-segment/', { headers: { 'User-Agent': UA } }).then(
      (r) => r.text(),
    ),
    fetch('https://stockanalysis.com/stocks/googl/metrics/operating-income-by-segment/', {
      headers: { 'User-Agent': UA },
    }).then((r) => r.text()),
  ])
  const rev = extrahiereStockanalysisSegmentHistorieAusHtml(revHtml, 'produkt', 'GOOGL')
  const oi = extrahiereStockanalysisOiHistorieAusHtml(oiHtml, 'GOOGL')
  const merged = rev && oi ? ergaenzeSegmentHistorieMitMargen(rev, oi) : rev
  console.log('\nSA produkt letztes Jahr:')
  for (const s of merged?.jahre.at(-1)?.segmente ?? []) {
    console.log(`  ${s.name}: Umsatz ${s.umsatzMio} Mio, Marge ${s.margePct}%`)
  }
}

main()

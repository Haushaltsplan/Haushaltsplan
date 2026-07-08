/** npx tsx scripts/probe-rmd-sa.ts */
import { extrahiereStockanalysisSegmentHistorieAusHtml } from '../lib/portfolio-analyse/stockanalysis-segment-parser'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

async function main() {
  for (const path of ['/stocks/rmd/metrics/revenue-by-segment/', '/quote/RMD/metrics/revenue-by-segment/']) {
    const html = await fetch(`https://stockanalysis.com${path}`, { headers: { 'User-Agent': UA } }).then((r) =>
      r.text(),
    )
    const p = extrahiereStockanalysisSegmentHistorieAusHtml(html, 'produkt', 'RMD')
    console.log('path', path, 'ok', !!p)
    if (p) {
      for (const j of p.jahre.slice(-4)) {
        const sum = j.segmente.reduce((a, s) => a + (s.umsatzMio ?? 0), 0)
        console.log(' FY', j.jahr, (sum / 1000).toFixed(2), 'B', j.segmente.map((s) => s.name))
      }
    }
  }
}

main()

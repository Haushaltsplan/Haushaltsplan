/** npx tsx scripts/probe-ms-googl-charts.ts */
import {
  extrahiereMsSegmentHistorien,
  parseMsChart,
} from '../lib/portfolio-analyse/marketscreener-segment-parser'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function main() {
  const html = await fetch('https://www.marketscreener.com/quote/stock/ALPHABET-INC-24203373/finances-segments/', {
    headers: { 'User-Agent': UA, Referer: 'https://www.marketscreener.com/' },
  }).then((r) => r.text())

  for (const id of [
    'financialSegmentCA1',
    'financialSegmentCA2',
    'financialSegmentCA3',
    'financialSegmentCA4',
    'financialSegmentRevenueChar1',
    'financialSegmentRevenueChar2',
    'financialSegmentLastYearChar1',
    'financialSegmentLastYearChar2',
  ]) {
    const chart = parseMsChart(html, id)
    if (!chart) continue
    const pos = html.indexOf(`id="${id}"`)
    const ctx = html.slice(Math.max(0, pos - 1500), pos).replace(/<[^>]+>/g, ' ')
    const title = ctx.match(/(Sales|Revenue|Operating Income|EBIT)[^]{0,80}Segment/i)?.[0]?.trim()
    console.log('\n', id, 'start', chart.start, 'segs', chart.segmente.length, title)
    console.log('  names', chart.segmente.map((s) => s.name).slice(0, 4))
    console.log('  last year vals', chart.segmente.map((s) => s.werte[s.werte.length - 1]).slice(0, 4))
  }

  const { produkt, geo } = extrahiereMsSegmentHistorien(html)
  console.log('\nparser produkt', produkt?.segmentNamen, produkt?.jahre.at(-1)?.segmente.map((s) => `${s.name}:${s.umsatzMio}`))
}

main()

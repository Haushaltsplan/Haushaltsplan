/** npx tsx scripts/probe-rmd-segment-fy.ts */
import { bekannterMarketscreenerSlug } from '../lib/portfolio-analyse/marketscreener-slug'
import {
  extrahiereMsSegmentHistorien,
  parseMsChart,
  parseMsSegmentTabelle,
} from '../lib/portfolio-analyse/marketscreener-segment-parser'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function probeMs(isin: string, name: string) {
  const slug = bekannterMarketscreenerSlug(isin)
  console.log('\n===', name, slug, '===')
  const html = await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`, {
    headers: { 'User-Agent': UA, Referer: 'https://www.marketscreener.com/' },
  }).then((r) => r.text())

  const chart = parseMsChart(html, 'financialSegmentCA1')
  console.log('chart start', chart?.start, 'years', chart?.segmente[0]?.werte.length)
  if (chart) {
    const i = chart.segmente[0]!.werte.length - 1
    const yr = chart.start + i
    const rawSum = chart.segmente.reduce((a, s) => a + (s.werte[i] ?? 0), 0)
    console.log('chart latest label year', yr, 'raw sum', rawSum, 'as M if /1e6', rawSum / 1e6, 'as B if /1e9', rawSum / 1e9)
  }

  const table = parseMsSegmentTabelle(html, /Breakdown by Business Segment/i)
  console.log('table start', table?.start, 'years', table?.segmente[0]?.werte.length)
  if (table) {
    const i = table.segmente[0]!.werte.length - 1
    const yr = table.start + i
    const rawSum = table.segmente.reduce((a, s) => a + (s.werte[i] ?? 0), 0)
    console.log('table latest label year', yr, 'raw sum', rawSum, 'as M', rawSum / 1e6, 'as B', rawSum / 1e9)
  }

  const block = html.match(/Breakdown by Business Segment[\s\S]{0,12000}/i)?.[0] ?? ''
  const years = [...block.matchAll(/>\s*(\d{4})\s*</g)].map((m) => m[1])
  console.log('visible header years', years)

  const { produkt, geo } = extrahiereMsSegmentHistorien(html)
  for (const [label, hist] of [['produkt', produkt], ['geo', geo]] as const) {
    const j = hist?.jahre.at(-1)
    const sum = j?.segmente.reduce((a, s) => a + (s.umsatzMio ?? 0), 0) ?? 0
    console.log(
      label,
      'FY',
      j?.jahr,
      'sum Mio',
      sum,
      '(',
      (sum / 1000).toFixed(2),
      'B)',
      j?.segmente.map((s) => `${s.name}:${s.umsatzMio}`).join(', '),
    )
    if (label === 'produkt' && hist) {
      for (const row of hist.jahre) {
        const s = row.segmente.reduce((a, x) => a + (x.umsatzMio ?? 0), 0)
        console.log('  ', row.jahr, (s / 1000).toFixed(2), 'B')
      }
    }
  }
}

async function main() {
  await probeMs('US7611521078', 'ResMed')
}

main().catch(console.error)

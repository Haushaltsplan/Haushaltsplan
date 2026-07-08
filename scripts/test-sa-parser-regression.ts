/** npx tsx scripts/test-sa-parser-regression.ts */
import { extrahiereStockanalysisSegmentHistorieAusHtml } from '../lib/portfolio-analyse/stockanalysis-segment-parser'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

async function test(slug: string, kind: 'segment' | 'geo') {
  const path =
    kind === 'geo'
      ? `/stocks/${slug}/metrics/revenue-by-geography/`
      : `/stocks/${slug}/metrics/revenue-by-segment/`
  const html = await fetch(`https://stockanalysis.com${path}`, { headers: { 'User-Agent': UA } }).then((r) =>
    r.text(),
  )
  const art = kind === 'geo' ? 'geo' : 'produkt'
  const r = extrahiereStockanalysisSegmentHistorieAusHtml(html, art, slug.toUpperCase())
  console.log(slug, kind, r?.anzahlJahre, r?.segmentNamen?.slice(0, 3))
}

async function main() {
  await test('msft', 'segment')
  await test('googl', 'segment')
  await test('hd', 'geo')
  await test('asml', 'segment')
}

main()

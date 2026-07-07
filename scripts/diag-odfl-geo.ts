import { readFileSync } from 'fs'

const h = readFileSync('scripts/.cache-ODFL.html', 'utf8')

for (const m of h.matchAll(/<ix:nonFraction([^>]*)contextRef="([^"]+)"([^>]*)name="([^"]+)"([^>]*)>([\s\S]*?)<\/ix:nonFraction>/gi)) {
  const tag = m[4]!.replace(/^[^:]+:/, '')
  if (!/PercentageOfRevenue/i.test(tag)) continue
  const ctx = h.match(new RegExp(`<xbrli:context id="${m[2]}"[^>]*>([\\s\\S]*?)</xbrli:context>`))?.[1] ?? ''
  if (!/Geographical|Geographic/i.test(ctx)) continue
  const geo = ctx.match(/explicitMember[^>]*>([^<]+)</)?.[1]?.replace(/^[^:]+:/, '')
  const year = ctx.match(/endDate>(\d{4})/)?.[1]
  const scale = parseInt((m[1]+m[3]+m[5]).match(/scale="(-?\d+)"/)?.[1] ?? '0', 10)
  const val = parseFloat(m[6].replace(/<[^>]+>/g, '').replace(/,/g, '')) * Math.pow(10, scale)
  console.log(year, geo, val)
}

// total revenue per year from disagg
import { extrahiereIxbrlTextBlock, parseMehrjahresSegmenteDetail } from '../lib/portfolio-analyse/sec-edgar-segment-extraktion.ts'
const block = extrahiereIxbrlTextBlock(h, 'DisaggregatedRevenueTableTextBlock')
const det = parseMehrjahresSegmenteDetail(block, 'produkt')
for (const j of det) {
  const total = j.segmente.reduce((s, x) => s + (x.umsatzMio ?? 0), 0)
  console.log('total', j.jahr, total)
}

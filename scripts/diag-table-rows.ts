import { readFileSync } from 'fs'
import { extrahiereIxbrlTextBlock } from '../lib/portfolio-analyse/sec-edgar-segment-extraktion.ts'

const sym = process.argv[2] ?? 'ODFL'
const h = readFileSync(`scripts/.cache-${sym}.html`, 'utf8')

for (const tag of [
  'DisaggregatedRevenueTableTextBlock',
  'DisaggregationOfRevenueTableTextBlock',
  'ScheduleOfSegmentReportingInformationBySegmentTextBlock',
]) {
  const block = extrahiereIxbrlTextBlock(h, tag)
  if (block.length < 200) continue
  console.log(`\n=== ${sym} ${tag} ===`)
  const rows = [...block.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
  for (const r of rows) {
    const cells = [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((c) => c[1].replace(/<[^>]+>/g, ' ').replace(/&#\d+;/g, ' ').replace(/\s+/g, ' ').trim())
      .filter((z) => z && z !== '$' && z !== '&#160;')
    if (cells.length < 2) continue
    const line = cells.join(' | ')
    if (/revenue|premium|bulk|industrial|ltl|united|mexico|domestic|international|geograph|region|service|other/i.test(line)) {
      console.log(line.slice(0, 250))
    }
  }
}

// KNSL: find tables with Industrials
if (sym === 'KNSL') {
  const idx = h.indexOf('Industrials and other')
  if (idx > 0) {
    const chunk = h.slice(idx - 3000, idx + 8000)
    const rows = [...chunk.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    console.log('\n=== KNSL premiums table near Industrials ===')
    for (const r of rows) {
      const cells = [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map((c) => c[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
      if (cells.length >= 2) console.log(cells.join(' | ').slice(0, 200))
    }
  }
}

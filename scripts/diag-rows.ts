import { extrahiereIxbrlTextBlock, parseOperatingSegmente } from '@/lib/portfolio-analyse/sec-edgar-segment-extraktion'

const UA = 'Omnia test@example.com'
async function main() {
  const h = await (await fetch('https://www.sec.gov/Archives/edgar/data/789019/000095017025100235/msft-20250630.htm', { headers: { 'User-Agent': UA } })).text()
  const block = extrahiereIxbrlTextBlock(h, 'ScheduleOfSegmentReportingInformationBySegmentTextBlock')

  const rows = [...block.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
  for (let i = 0; i < Math.min(25, rows.length); i++) {
    const cells = [...rows[i]![1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim())
      .filter(c => c && c !== '$')
    if (cells.length) console.log(i, cells.length, cells.slice(0,4))
  }
  console.log('parseOperating', parseOperatingSegmente(block))
}
main()

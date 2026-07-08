/** npx tsx scripts/probe-sa-rpo-aligned.ts */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function probe(slug: string) {
  const html = await fetch(`https://stockanalysis.com/stocks/${slug}/metrics/`, { headers: { 'User-Agent': UA } }).then(
    (r) => r.text(),
  )

  const label =
    html.includes('Commercial Remaining Performance Obligations')
      ? 'Commercial Remaining Performance Obligations'
      : 'Remaining Performance Obligations'
  const periodIdx = html.indexOf('Period Ending')
  const labelIdx = html.indexOf(label)
  const tableStart = Math.min(periodIdx, labelIdx) - 500
  const tableEnd = labelIdx + 8000
  const chunk = html.slice(tableStart, tableEnd)

  const headerRow = chunk.match(/<thead>[\s\S]*?<\/thead>/)?.[0] ?? ''
  const dates = [...headerRow.matchAll(/>([A-Z][a-z]{2} \d{1,2}, \d{4})</g)].map((m) => m[1]!)

  const afterLabel = chunk.slice(chunk.indexOf(label))
  const row = afterLabel.match(/<tr[\s\S]*?<\/tr>/)?.[0] ?? ''
  const vals = [...row.matchAll(/<td[^>]*>([\d.]+[BMK])<\/td>/gi)].map((m) => m[1]!)

  console.log('\n===', slug, label, '===')
  for (let i = 0; i < Math.min(dates.length, vals.length); i++) {
    if (dates[i]!.startsWith('Dec 31') || dates[i]!.startsWith('Jun 30')) {
      console.log(dates[i], vals[i])
    }
  }
}

async function main() {
  for (const slug of ['googl', 'now', 'msft']) await probe(slug)
}

main()

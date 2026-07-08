/** npx tsx scripts/probe-sa-rpo-aligned2.ts */
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
  const headerBlock = html.slice(periodIdx, periodIdx + 6000)
  const dates = [...headerBlock.matchAll(/>([A-Z][a-z]{2} \d{1,2}, \d{4})</g)].map((m) => m[1]!)

  const labelIdx = html.indexOf(label)
  const rowBlock = html.slice(labelIdx, labelIdx + 12000)
  const vals = [...rowBlock.matchAll(/<td[^>]*>([\d.]+[BMK])<\/td>/gi)].map((m) => m[1]!)

  console.log('\n===', slug, '===')
  console.log('dates', dates.length, 'vals', vals.length)
  for (let i = 0; i < Math.min(dates.length, vals.length); i++) {
    const d = dates[i]!
    if (/Dec 31|Jun 30/.test(d)) console.log(d, '->', vals[i])
  }
}

async function main() {
  for (const slug of ['googl', 'now', 'msft']) await probe(slug)
}

main()

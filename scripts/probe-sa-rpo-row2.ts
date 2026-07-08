/** npx tsx scripts/probe-sa-rpo-row2.ts */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function probe(slug: string) {
  const html = await fetch(`https://stockanalysis.com/stocks/${slug}/metrics/`, { headers: { 'User-Agent': UA } }).then(
    (r) => r.text(),
  )

  const labels = [
    'Remaining Performance Obligations',
    'Commercial Remaining Performance Obligations',
    'Total Backlog',
  ]
  for (const label of labels) {
    const idx = html.indexOf(label)
    if (idx < 0) continue
    const after = html.slice(idx, idx + 6000)
    const vals = [...after.matchAll(/<td[^>]*>([\d.]+[BMK])<\/td>/gi)].map((m) => m[1])
    console.log(slug, label, 'vals', vals.slice(0, 12))
    break
  }

  const periodIdx = html.indexOf('Period Ending')
  const headerBlock = html.slice(periodIdx, periodIdx + 5000)
  const dates = [...headerBlock.matchAll(/>([A-Z][a-z]{2} \d{1,2}, \d{4})</g)].map((m) => m[1])
  const decDates = dates.filter((d) => d.startsWith('Dec 31'))
  console.log(slug, 'Dec dates', decDates.slice(0, 10))
}

async function main() {
  for (const slug of ['googl', 'now', 'msft']) await probe(slug)
}

main()

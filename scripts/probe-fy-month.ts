/** npx tsx scripts/probe-fy-month.ts */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function probe(slug: string) {
  const html = await fetch(`https://stockanalysis.com/stocks/${slug}/metrics/`, { headers: { 'User-Agent': UA } }).then(
    (r) => r.text(),
  )
  const periodIdx = html.indexOf('Period Ending')
  const dates = [...html.slice(periodIdx, periodIdx + 6000).matchAll(/>([A-Z][a-z]{2} \d{1,2}, \d{4})</g)].map(
    (m) => m[1]!,
  )
  for (const month of ['Dec 31', 'Jun 30', 'Sep 30', 'Mar 31']) {
    const filtered = dates.filter((d) => d.startsWith(month))
    console.log(slug, month, filtered.length, filtered.slice(-3))
  }
}

async function main() {
  for (const slug of ['googl', 'now', 'msft']) await probe(slug)
}

main()

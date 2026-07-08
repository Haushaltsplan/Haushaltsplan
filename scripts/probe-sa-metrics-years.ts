/** npx tsx scripts/probe-sa-metrics-years.ts */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

async function main() {
  const html = await fetch('https://stockanalysis.com/stocks/msft/metrics/', { headers: { 'User-Agent': UA } }).then(
    (r) => r.text(),
  )
  const idx = html.indexOf('Revenue by Segment')
  const block = html.slice(idx, idx + 15000)
  const years = [...block.matchAll(/>(20\d{2})</g)].map((m) => m[1])
  console.log('years near segment', years.slice(0, 20))
  const tables = [...block.matchAll(/<table[\s\S]*?<\/table>/gi)]
  console.log('tables', tables.length)
  if (tables[0]) {
    const rows = [...tables[0][0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].slice(0, 5)
    for (const r of rows) {
      const cells = [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
        c[1]!.replace(/<[^>]+>/g, '').trim(),
      )
      console.log(cells.join(' | ').slice(0, 150))
    }
  }
}

main()

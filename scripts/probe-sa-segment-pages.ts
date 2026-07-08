/** npx tsx scripts/probe-sa-segment-pages.ts */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

async function probe(path: string) {
  const html = await fetch(`https://stockanalysis.com${path}`, { headers: { 'User-Agent': UA } }).then((r) => r.text())
  console.log('\n===', path, html.length, '===')
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? []
  console.log('tables', tables.length)
  for (const t of tables.slice(0, 2)) {
    const rows = [...t.matchAll(/<tr[\s\S]*?<\/tr>/gi)].slice(0, 6)
    for (const r of rows) {
      const cells = [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map((c) => c[1]!.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
      if (cells.length) console.log(' ', cells.join(' | ').slice(0, 120))
    }
  }
}

async function main() {
  await probe('/stocks/msft/metrics/revenue-by-segment/')
  await probe('/stocks/msft/metrics/revenue-by-geography/')
  await probe('/stocks/now/metrics/revenue-by-segment/')
}

main()

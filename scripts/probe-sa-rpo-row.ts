/** npx tsx scripts/probe-sa-rpo-row.ts */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function main() {
  const html = await fetch('https://stockanalysis.com/stocks/googl/metrics/', { headers: { 'User-Agent': UA } }).then(
    (r) => r.text(),
  )
  const idx = html.indexOf('Remaining Performance Obligations</')
  const block = html.slice(idx, idx + 5000)
  const rowMatch = block.match(/<tr[\s\S]*?<\/tr>/)
  if (rowMatch) {
    const cells = [...rowMatch[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
      c[1]!.replace(/<[^>]+>/g, '').trim(),
    )
    console.log('RPO row cells:', cells.slice(0, 15))
  }

  const thead = html.slice(html.indexOf('Period Ending'), html.indexOf('Period Ending') + 4000)
  const dates = [...thead.matchAll(/<th[^>]*>([A-Z][a-z]{2} \d{1,2}, \d{4})<\/th>/g)].map((m) => m[1])
  console.log('dates count', dates.length, dates.slice(0, 5), '...', dates.slice(-5))
}

main()

/** npx tsx scripts/probe-sa-rpo-googl.ts */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function main() {
  const html = await fetch('https://stockanalysis.com/stocks/googl/metrics/', { headers: { 'User-Agent': UA } }).then(
    (r) => r.text(),
  )
  const idx = html.indexOf('Remaining Performance Obligations')
  const block = html.slice(idx - 3000, idx + 8000)
  console.log(block.replace(/></g, '>\n<'))

  const rows = [...block.matchAll(/<tr[\s\S]*?<\/tr>/gi)]
  for (const r of rows.slice(0, 8)) {
    const cells = [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      c[1]!.replace(/<[^>]+>/g, '').trim(),
    )
    if (cells.length) console.log('ROW:', cells.join(' | '))
  }
}

main()

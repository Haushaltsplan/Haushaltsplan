/** Debug SA HTML structure for MA revenue-by-segment. */
import { writeFileSync } from 'fs'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function main() {
  const url = 'https://stockanalysis.com/stocks/ma/metrics/revenue-by-segment/'
  const html = await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.text())
  writeFileSync('scripts/.cache-sa-ma-segment.html', html)

  const rows: string[][] = []
  for (const r of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const cells = [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      c[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    )
    if (cells.length >= 2) rows.push(cells)
  }
  console.log('rows', rows.length)
  for (const row of rows.slice(0, 20)) console.log(row.join(' | '))

  const headerIdx = rows.findIndex((row) => /^date$/i.test(row[0] ?? '') || /^period ending$/i.test(row[0] ?? ''))
  console.log('headerIdx', headerIdx, rows[headerIdx])
}

main().catch(console.error)

/** npx tsx scripts/probe-sa-rpo-values.ts */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function parseTable(html: string, label: string) {
  const idx = html.indexOf(label)
  if (idx < 0) return null
  const chunk = html.slice(Math.max(0, idx - 8000), idx + 4000)
  const tables = [...chunk.matchAll(/<table[\s\S]*?<\/table>/gi)]
  const table = tables[tables.length - 1]
  if (!table) return null

  const rows: string[][] = []
  for (const r of table[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const cells = [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      c[1]!.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    )
    if (cells.length) rows.push(cells)
  }
  return rows
}

async function main() {
  for (const slug of ['googl', 'now', 'msft']) {
    const html = await fetch(`https://stockanalysis.com/stocks/${slug}/metrics/`, { headers: { 'User-Agent': UA } }).then(
      (r) => r.text(),
    )
    console.log('\n===', slug.toUpperCase(), '===')
    for (const label of [
      'Remaining Performance Obligations',
      'Commercial Remaining Performance Obligations',
      'Total Backlog',
      'Deferred Revenue',
    ]) {
      const rows = parseTable(html, label)
      if (!rows || rows.length < 2) continue
      console.log('LABEL:', label)
      console.log('HEADER:', rows[0]?.slice(0, 8).join(' | '))
      const dataRow = rows.find((r) => r[0] === label || r[0]?.includes(label.slice(0, 20)))
      if (dataRow) {
        for (let i = 1; i < Math.min(dataRow.length, 12); i++) {
          console.log(`  ${rows[0]![i]}: ${dataRow[i]}`)
        }
      }
    }
  }
}

main()

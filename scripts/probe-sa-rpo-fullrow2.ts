/** npx tsx scripts/probe-sa-rpo-fullrow2.ts */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function main() {
  const html = await fetch('https://stockanalysis.com/stocks/googl/metrics/', { headers: { 'User-Agent': UA } }).then(
    (r) => r.text(),
  )
  const labelIdx = html.indexOf('Remaining Performance Obligations')
  const block = html.slice(labelIdx, labelIdx + 20000)
  const vals = [...block.matchAll(/>([\d.]+[BMK])</g)].map((m) => m[1])
  console.log('all B/M values after label:', vals.length, vals)

  const periodIdx = html.indexOf('Period Ending')
  const dates = [...html.slice(periodIdx, periodIdx + 6000).matchAll(/>([A-Z][a-z]{2} \d{1,2}, \d{4})</g)].map(
    (m) => m[1]!,
  )
  console.log('dates:', dates.length)

  // RPO row should be first row in tbody after Period Ending table
  const tableIdx = html.lastIndexOf('<table', labelIdx)
  const table = html.slice(tableIdx, tableIdx + 50000)
  const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)]
  console.log('rows in table', rows.length)
  for (const r of rows.slice(0, 4)) {
    const text = r[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
    console.log('ROW:', text)
  }
}

main()

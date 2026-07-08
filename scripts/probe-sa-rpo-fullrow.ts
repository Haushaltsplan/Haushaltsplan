/** npx tsx scripts/probe-sa-rpo-fullrow.ts */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function main() {
  const html = await fetch('https://stockanalysis.com/stocks/googl/metrics/', { headers: { 'User-Agent': UA } }).then(
    (r) => r.text(),
  )
  const labelIdx = html.indexOf('Remaining Performance Obligations</')
  const block = html.slice(labelIdx - 100, labelIdx + 15000)
  const rowStart = block.indexOf('<tr')
  const rowEnd = block.indexOf('</tr>', rowStart) + 5
  const row = block.slice(rowStart, rowEnd)
  console.log('row length', row.length)
  const vals = [...row.matchAll(/<td[^>]*>([\d.]+[BMK]|-)<\/td>/gi)].map((m) => m[1])
  console.log('value count', vals.length, vals)

  // maybe values in different format
  const allTd = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]!.replace(/<[^>]+>/g, '').trim())
  console.log('all td count', allTd.length)
  console.log(allTd.slice(0, 15))
}

main()

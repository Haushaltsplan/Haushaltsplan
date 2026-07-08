/** npx tsx scripts/probe-sa-fy-filter.ts */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

function parseTable(html: string) {
  const rows = [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)]
  const out: string[][] = []
  for (const r of rows) {
    const cells = [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      c[1]!.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    )
    if (cells.length) out.push(cells)
  }
  return out
}

async function test(slug: string) {
  const html = await fetch(`https://stockanalysis.com/stocks/${slug}/metrics/revenue-by-segment/`, {
    headers: { 'User-Agent': UA },
  }).then((r) => r.text())
  const rows = parseTable(html)
  const header = rows[0] ?? []
  const data = rows.slice(1)
  console.log('\n', slug, 'segments', header.slice(1).join(' | '))
  for (const month of ['Jun', 'Dec', 'Sep']) {
    const filtered = data.filter((r) => r[0]?.startsWith(month))
    console.log(month, 'rows', filtered.length, filtered.slice(0, 3).map((r) => r[0]).join(', '))
  }
}

async function main() {
  await test('msft')
  await test('now')
  await test('asml')
}

main()

/** npx tsx scripts/probe-sa-rpo-table.ts */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

function parseUsdB(s: string): number | null {
  const m = s.replace(/,/g, '').trim().match(/^([\d.]+)\s*([BMK])?$/i)
  if (!m) return null
  let n = Number(m[1])
  if (!Number.isFinite(n)) return null
  const u = (m[2] ?? '').toUpperCase()
  if (u === 'B') n *= 1e9
  else if (u === 'M') n *= 1e6
  else if (u === 'K') n *= 1e3
  return n
}

async function main() {
  const html = await fetch('https://stockanalysis.com/stocks/now/metrics/', { headers: { 'User-Agent': UA } }).then(
    (r) => r.text(),
  )
  const idx = html.indexOf('Remaining Performance Obligations')
  const block = html.slice(idx - 5000, idx + 4000)

  // find table with years in thead
  const tables = [...block.matchAll(/<table[\s\S]*?<\/table>/gi)]
  console.log('tables near RPO', tables.length)
  for (const t of tables) {
    if (!/Remaining Performance Obligations/i.test(t[0])) continue
    console.log(t[0].slice(0, 2000))
  }

  // Alternative: row-based regex
  const rowMatch = html.match(
    /Remaining Performance Obligations[\s\S]{0,8000}?(?:<td[^>]*>([\d.]+[BMK])<\/td>[\s\S]*?){3,}/i,
  )
  if (rowMatch) {
    const seg = rowMatch[0]
    const vals = [...seg.matchAll(/<td[^>]*>([\d.]+[BMK])<\/td>/gi)].map((m) => m[1])
    console.log('values', vals)
  }

  // Year row: look for FY labels
  const fy = [...html.matchAll(/FY\s*(20\d{2})/gi)].map((m) => Number(m[1]))
  console.log('FY labels count', fy.length, fy.slice(0, 15))
}

main()

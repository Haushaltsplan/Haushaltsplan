const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function parseMs(slug) {
  return fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-consensus/`, { headers: { 'User-Agent': UA } })
    .then((r) => r.text())
    .then((h) => {
      const rowStart = h.search(/<td[^>]*>\s*Net sales\s*<\/td>/i)
      if (rowStart < 0) return { slug, years: [], vals: [] }
      const tableStart = h.lastIndexOf('<table', rowStart)
      const tableEnd = h.indexOf('</table>', rowStart)
      const table = h.slice(tableStart, tableEnd + 8)
      const years = [...table.matchAll(/>(\d{4})\s*(\*)?<\/th>/g)].map((m) => m[1] + (m[2] ? '*' : ''))
      const pos = table.search(/<td[^>]*>\s*Net sales\s*<\/td>/i)
      const rowEnd = table.indexOf('</tr>', pos)
      const row = table.slice(pos, rowEnd > pos ? rowEnd : pos + 12000)
      const vals = [...row.matchAll(/<span class="efd_USD[^"]*"[^>]*>[\s\S]*?<span title="([^"]+)">/g)].map((m) => m[1])
      return { slug, years, vals }
    })
}

const slugs = [
  'ALPHABET-INC-24203373',
  'MICROSOFT-CORP-4835',
  'ASML-HOLDING-N-V-12002973',
  'APPLE-INC-4849',
  'NVIDIA-CORPORATION-57355629',
  'META-PLATFORMS-INC-10547141',
]

console.log('Marketscreener max estimate years:')
for (const slug of slugs) {
  const r = await parseMs(slug)
  const pairs = r.years.map((y, i) => `${y}=${r.vals[i] ?? '?'}`)
  const maxY = Math.max(0, ...r.years.map((y) => Number(y.replace('*', ''))))
  console.log(`  ${slug.split('-').slice(0, 2).join(' ')}: max ${maxY} | ${pairs.join(' ')}`)
}

// Onvista DE
async function onvista(wkn) {
  const h = await fetch(`https://www.onvista.de/aktien/${wkn}`, { headers: { 'User-Agent': UA } }).then((r) => r.text())
  console.log('\nOnvista', wkn, 'len', h.length, 'Schätzung', /schätz|prognose|estimate/i.test(h))
  const est = [...h.matchAll(/20(2[6-9])[^<]{0,40}/g)].map((m) => m[0]).slice(0, 10)
  console.log('  years', est)
}

await onvista('A14Y6F') // ASML
await onvista('A12CGC') // Alphabet

// Motley Fool estimates
const fool = await fetch('https://www.fool.com/quote/nasdaq/googl/', { headers: { 'User-Agent': UA } }).then((r) => r.text())
console.log('\nMotley Fool len', fool.length, '2028', fool.includes('2028'))

// YCharts public page
const yc = await fetch('https://ycharts.com/companies/GOOGL/estimates', { headers: { 'User-Agent': UA } }).then((r) => r.text())
console.log('YCharts estimates len', yc.length, 'blocked', yc.length < 5000)
if (yc.length > 10000) {
  for (const y of [2026, 2027, 2028]) {
    const c = (yc.match(new RegExp(`FY ${y}|${y} Estimate`, 'g')) ?? []).length
    if (c) console.log('  FY', y, 'mentions', c)
  }
}

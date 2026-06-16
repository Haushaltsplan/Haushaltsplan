const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function msFull(slug, name) {
  const h = await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-consensus/`, { headers: { 'User-Agent': UA } }).then((r) => r.text())
  const rowStart = h.search(/<td[^>]*>\s*Net sales\s*<\/td>/i)
  if (rowStart < 0) return console.log(name, 'no table')
  const tableStart = h.lastIndexOf('<table', rowStart)
  const tableEnd = h.indexOf('</table>', rowStart)
  const table = h.slice(tableStart, tableEnd + 8)
  const years = [...table.matchAll(/>(\d{4})\s*(\*)?<\/th>/g)].map((m) => m[1] + (m[2] ? '*' : ''))
  const pos = table.search(/<td[^>]*>\s*Net sales\s*<\/td>/i)
  const rowEnd = table.indexOf('</tr>', pos)
  const row = table.slice(pos, rowEnd > pos ? rowEnd : pos + 12000)
  const umsatz = [...row.matchAll(/<span class="efd_USD[^"]*"[^>]*>[\s\S]*?<span title="([^"]+)">/g)].map((m) => m[1])
  const niPos = table.search(/<td[^>]*>\s*Net income\s*<\/td>/i)
  const niRow = table.slice(niPos, table.indexOf('</tr>', niPos) + 5)
  const netIncome = [...niRow.matchAll(/<span class="efd_USD[^"]*"[^>]*>[\s\S]*?<span title="([^"]+)">/g)].map((m) => m[1])
  console.log(`\n${name}:`, years.map((y, i) => `${y} rev=${umsatz[i] ?? '?'} ni=${netIncome[i] ?? '?'}`).join(' | '))
}

await msFull('NVIDIA-CORPORATION-57355629', 'NVDA')
await msFull('ALPHABET-INC-24203373', 'GOOGL')
await msFull('ASML-HOLDING-N-V-12002973', 'ASML')

// Onvista ASML estimates table
const ov = await fetch('https://www.onvista.de/aktien-fundamentals/A14Y6F', { headers: { 'User-Agent': UA } }).then((r) => r.text())
console.log('\nOnvista fundamentals len', ov.length)
const tables = [...ov.matchAll(/<table[\s\S]*?<\/table>/gi)]
for (const t of tables) {
  const text = t[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (/202[6-9]e|Umsatz|Gewinn/i.test(text) && text.length < 2000) {
    console.log('  table:', text.slice(0, 500))
  }
}

// YCharts
const yc = await fetch('https://ycharts.com/companies/GOOGL/estimates', { headers: { 'User-Agent': UA } }).then((r) => r.text())
const rows = [...yc.matchAll(/<tr[\s\S]*?<\/tr>/gi)]
for (const r of rows) {
  const t = r[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (/202[6-9]/.test(t) && /revenue|eps|sales/i.test(t)) console.log('YCharts:', t.slice(0, 200))
}

// Motley Fool quote page estimates
const fool = await fetch('https://www.fool.com/quote/nasdaq/googl/', { headers: { 'User-Agent': UA } }).then((r) => r.text())
const foolEst = fool.match(/estimate[s]?[\s\S]{0,3000}/i)?.[0]
if (foolEst) console.log('\nFool estimate block', foolEst.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 600))

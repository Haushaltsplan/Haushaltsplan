const slug = 'HERMES-INTERNATIONAL-4635'
const h = await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances/`, {
  headers: { 'User-Agent': 'Mozilla/5.0' },
}).then((r) => r.text())

const thead = h.match(/<thead>[\s\S]*?<\/thead>/i)?.[0] ?? ''
const years = [...thead.matchAll(/>(\d{4})\s*(\*)?<\/th>/g)].map((m) => m[1])
console.log('years', years)

for (const label of ['Net sales', 'Operating profit', 'Net income', 'EBITDA', 'EPS']) {
  const pos = h.search(new RegExp(`<td[^>]*>\\s*${label}\\s*<`, 'i'))
  if (pos < 0) {
    console.log(label, 'not found')
    continue
  }
  const rowEnd = h.indexOf('</tr>', pos)
  const row = h.slice(pos, rowEnd > pos ? rowEnd : pos + 15_000)
  const nums = [...row.matchAll(/<span title="([^"]+)">/g)].map((m) => m[1])
  console.log(label, nums.slice(0, 20))
}

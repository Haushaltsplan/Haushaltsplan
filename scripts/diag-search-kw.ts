import { readFileSync } from 'fs'
const sym = process.argv[2] ?? 'ODFL'
const h = readFileSync(`scripts/.cache-${sym}.html`, 'utf8')
const kws = ['geographic', 'Geographic', 'region', 'United States', 'domestic', 'international', 'Disaggregat', 'revenue by', 'Revenues by', 'Segment', 'commodity', 'premium', 'LTL', 'Bulk', 'Industrial']
for (const kw of kws) {
  let idx = 0
  let count = 0
  while (count < 3) {
    idx = h.toLowerCase().indexOf(kw.toLowerCase(), idx)
    if (idx < 0) break
    const snippet = h.slice(Math.max(0, idx - 80), idx + 120).replace(/\s+/g, ' ')
    console.log(`[${kw}@${idx}]`, snippet)
    idx += kw.length
    count++
  }
}

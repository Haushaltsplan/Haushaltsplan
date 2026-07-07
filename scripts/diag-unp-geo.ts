import { readFileSync } from 'fs'

const h = readFileSync('scripts/.cache-UNP.html', 'utf8')
for (const kw of ['Mexico', 'mexico', 'geographic areas', 'United States', 'freight revenues from']) {
  let idx = 0
  let c = 0
  while (c < 2) {
    idx = h.toLowerCase().indexOf(kw.toLowerCase(), idx)
    if (idx < 0) break
    console.log(`[${kw}]`, h.slice(idx, idx + 250).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200))
    idx += kw.length
    c++
  }
}

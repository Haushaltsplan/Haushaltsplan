const r = await fetch('https://stockanalysis.com/list/sp-500-stocks/', {
  headers: { 'User-Agent': 'Mozilla/5.0' },
})
const html = await r.text()
const idx = html.indexOf('Apple')
console.log(html.slice(idx - 500, idx + 1500).replace(/\s+/g, ' '))

// find all /stocks/SYM/ links near percentage
const chunks = [...html.matchAll(/\/stocks\/([a-z0-9.-]+)\/[^]{0,400}?(\d+\.\d+)%/gi)]
console.log('chunks', chunks.length)
console.log(chunks.slice(0, 5).map((m) => ({ sym: m[1], pct: m[2] })))
console.log(chunks.slice(-3).map((m) => ({ sym: m[1], pct: m[2] })))

const sum = chunks.reduce((s, m) => s + parseFloat(m[2]), 0)
console.log('sum pct', sum.toFixed(2))

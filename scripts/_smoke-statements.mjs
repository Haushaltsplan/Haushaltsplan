/**
 * Smoke: SA Statements (D&A, Bilanz) + MS geo-Segmente Hermès.
 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function parseArrayLiteral(block, key) {
  const marker = `${key}:`
  const idx = block.indexOf(marker)
  if (idx < 0) return null
  const start = block.indexOf('[', idx)
  if (start < 0) return null
  let depth = 0,
    inStr = false,
    esc = false
  for (let i = start; i < block.length; i++) {
    const ch = block[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') {
      inStr = true
      continue
    }
    if (ch === '[') depth++
    if (ch === ']') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(block.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function scrape(path, keys) {
  return fetch(`https://stockanalysis.com${path}`, { headers: { 'User-Agent': UA } })
    .then((r) => r.text())
    .then((html) => {
      const idx = html.search(/fiscalYear:\[/)
      const block = html.slice(idx, idx + 40_000)
      const years = (parseArrayLiteral(block, 'fiscalYear') || []).map(String)
      const q = (parseArrayLiteral(block, 'fiscalQuarter') || []).map(String)
      const out = { path, rows: [] }
      for (const k of keys) {
        const arr = parseArrayLiteral(block, k) || []
        out[k] = []
        for (let i = 0; i < years.length; i++) {
          if (/^H1$|^Q[123]$/i.test(q[i] || '')) continue
          const n = Number(arr[i])
          if (!Number.isFinite(n)) continue
          out[k].push({ jahr: Number(years[i]), mio: Math.round(n / 1e6) })
        }
        out[k] = out[k].slice(0, 4)
      }
      return out
    })
}

const sa = await Promise.all([
  scrape('/quote/epa/RMS/financials/income-statement/', ['depAmorEbitda', 'sgna']),
  scrape('/quote/epa/RMS/financials/balance-sheet/', ['receivables', 'assets', 'debt', 'cashneq']),
  scrape('/stocks/now/financials/cash-flow-statement/', ['totalDepAmorCF', 'sbcomp', 'ncfo']),
])
console.log(JSON.stringify({ sa }, null, 2))

const ms = await (
  await fetch(
    'https://www.marketscreener.com/quote/stock/HERMES-INTERNATIONAL-4657/company/',
    { headers: { 'User-Agent': UA, Referer: 'https://www.marketscreener.com/' } },
  )
).text()
const pos = ms.search(/Sales by Activity/i)
const table = ms.slice(pos, pos + 100_000).match(/<table[\s\S]*?<\/table>/i)?.[0] || ''
const jahre = [...table.matchAll(/\b(20[12]\d)\b/g)].map((m) => m[1])
const labels = [...table.matchAll(/title="([^"]+)"/g)]
  .map((m) => m[1].trim())
  .filter((t) => /Asia|America|Europe|Japan|France|Other|Middle/i.test(t) && !/,/.test(t))
console.log(JSON.stringify({ msJahre: [...new Set(jahre)].slice(0, 8), msLabels: [...new Set(labels)] }, null, 2))

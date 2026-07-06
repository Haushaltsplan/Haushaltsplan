/**
 * Standalone-Verifikation (ohne server-only Imports).
 * node scripts/verify-forecast-scraper.mjs
 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const TICKERS = [
  { sym: 'MSFT', slug: 'MICROSOFT-CORP-4835' },
  { sym: 'GOOGL', slug: 'ALPHABET-INC-24203373' },
  { sym: 'MA', slug: 'MASTERCARD-INC-17163' },
  { sym: 'SPGI', slug: 'S-P-GLOBAL-INC-27377753' },
  { sym: 'NVDA', slug: 'NVIDIA-CORPORATION-57355629' },
]

function parseTriple(html, key) {
  const m = html.match(new RegExp(`${key}:\\{last:([\\d.]+),this:([\\d.]+),growth:([\\d.]+)\\}`))
  if (!m) return null
  return { this: Number(m[2]), growth: Number(m[3]) }
}

function parseMsAnnual(html) {
  const rowStart = html.search(/<td[^>]*>\s*Net sales\s*<\/td>/i)
  if (rowStart < 0) return []
  const tableStart = html.lastIndexOf('<table', rowStart)
  const tableEnd = html.indexOf('</table>', rowStart)
  const table = html.slice(tableStart, tableEnd + 8)
  const years = [...table.matchAll(/>(\d{4})\s*\*?<\/th>/g)].map((m) => ({
    jahr: Number(m[1]),
    est: m[0].includes('*'),
  }))
  const pos = table.search(/Net sales/i)
  const row = table.slice(pos, table.indexOf('</tr>', pos))
  const vals = [...row.matchAll(/<span class="efd_USD[^"]*"[^>]*>[\s\S]*?<span title="([^"]+)">/g)].map((m) =>
    Number(m[1].replace(/,/g, '')),
  )
  return years.filter((y) => y.est).map((y, i) => ({ jahr: y.jahr, umsatz: vals[i] }))
}

async function verify(t) {
  const [consensus, sa] = await Promise.all([
    fetch(`https://www.marketscreener.com/quote/stock/${t.slug}/finances-consensus/`, {
      headers: { 'User-Agent': UA },
    }).then((r) => r.text()),
    fetch(`https://stockanalysis.com/stocks/${t.sym.toLowerCase()}/forecast/`, {
      headers: { 'User-Agent': UA },
    }).then((r) => r.text()),
  ])

  const ms = parseMsAnnual(consensus)
  const revNext = parseTriple(sa, 'revenueNext')
  const epsNext = parseTriple(sa, 'epsNext')
  const maxJahr = Math.max(0, ...ms.map((x) => x.jahr), revNext ? new Date().getUTCFullYear() + 1 : 0)

  console.log(`\n${t.sym}:`)
  console.log('  MS annual:', ms.map((x) => `${x.jahr}=${(x.umsatz / 1e9).toFixed(1)}B`).join(' | ') || '—')
  console.log('  SA Next:', revNext ? `rev=${(revNext.this / 1e9).toFixed(1)}B eps=${epsNext?.this}` : '—')
  console.log('  Max Jahr:', maxJahr, maxJahr >= 2028 ? '✓' : maxJahr >= 2027 ? '~' : '✗')
  return maxJahr >= 2027
}

let ok = 0
for (const t of TICKERS) {
  if (await verify(t)) ok++
}
console.log(`\n${ok}/${TICKERS.length} Titel mit Schätzungen bis mindestens 2027`)
process.exit(ok < TICKERS.length - 1 ? 1 : 0)

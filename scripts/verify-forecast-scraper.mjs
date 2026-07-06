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
  if (rowStart < 0) return { consensus: [], guv: [] }

  // Konsens (*-Spalten)
  const tableStart = html.lastIndexOf('<table', rowStart)
  const tableEnd = html.indexOf('</table>', rowStart)
  const table = html.slice(tableStart, tableEnd + 8)
  const years = [...table.matchAll(/>(\d{4})\s*(\*)?<\/th>/g)].map((m) => ({
    jahr: Number(m[1]),
    est: m[2] === '*',
  }))
  const pos = table.search(/Net sales/i)
  const row = table.slice(pos, table.indexOf('</tr>', pos))
  const vals = [...row.matchAll(/<span class="efd_USD[^"]*"[^>]*>[\s\S]*?<span title="([^"]+)">/g)].map((m) =>
    Number(m[1].replace(/,/g, '')),
  )
  const consensus = years
    .filter((y) => y.est && y.jahr >= 2026)
    .map((y, i) => ({ jahr: y.jahr, umsatz: vals[i] }))

  // Jahres-GuV (income-statement-annual)
  const idx = html.indexOf('income-statement-annual')
  const block = html.slice(idx, idx + 280_000)
  const guvTable = [...block.matchAll(/<table[\s\S]*?<\/table>/gi)].find((t) => /Net sales/i.test(t[0]))?.[0]
  const guv = []
  if (guvTable) {
    const hdrs = [...guvTable.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
      .map((m) => Number(/^(\d{4})/.exec(m[1].replace(/<[^>]+>/g, '').trim())?.[1]))
      .filter((y) => y >= 2026)
    for (const tr of guvTable.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const tds = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      if (tds.length < 2) continue
      const label = tds[0][1].replace(/<[^>]+>/g, '').trim()
      if (!/^Net sales/i.test(label)) continue
      const rowVals = tds.slice(1).map((td) => {
        const t = td[1].replace(/<[^>]+>/g, '').replace(/,/g, '').trim()
        const n = Number(t)
        return Number.isFinite(n) ? n * 1e6 : null
      })
      hdrs.forEach((jahr, i) => {
        const u = rowVals[i]
        if (u != null) guv.push({ jahr, umsatz: u })
      })
      break
    }
  }

  return { consensus, guv }
}

async function verify(t) {
  const [consensusHtml, financesHtml, sa] = await Promise.all([
    fetch(`https://www.marketscreener.com/quote/stock/${t.slug}/finances-consensus/`, {
      headers: { 'User-Agent': UA },
    }).then((r) => r.text()),
    fetch(`https://www.marketscreener.com/quote/stock/${t.slug}/finances/`, {
      headers: { 'User-Agent': UA },
    }).then((r) => r.text()),
    fetch(`https://stockanalysis.com/stocks/${t.sym.toLowerCase()}/forecast/`, {
      headers: { 'User-Agent': UA },
    }).then((r) => r.text()),
  ])

  const ms = parseMsAnnual(consensusHtml)
  const msGuv = parseMsAnnual(financesHtml).guv
  const revNext = parseTriple(sa, 'revenueNext')
  const epsNext = parseTriple(sa, 'epsNext')
  const epsThis = parseTriple(sa, 'epsThis')
  const allYears = [
    ...ms.consensus.map((x) => x.jahr),
    ...msGuv.map((x) => x.jahr),
    revNext ? new Date().getUTCFullYear() + 1 : 0,
  ]
  const maxJahr = Math.max(0, ...allYears)

  console.log(`\n${t.sym}:`)
  console.log(
    '  MS Konsens:',
    ms.consensus.map((x) => `${x.jahr}=${(x.umsatz / 1e9).toFixed(1)}B`).join(' | ') || '—',
  )
  console.log(
    '  MS GuV:',
    [...new Map(msGuv.map((x) => [x.jahr, x])).values()]
      .map((x) => `${x.jahr}=${(x.umsatz / 1e9).toFixed(1)}B`)
      .join(' | ') || '—',
  )
  console.log(
    '  SA:',
    revNext ? `revNext=${(revNext.this / 1e9).toFixed(1)}B epsNext=${epsNext?.this}` : '—',
    epsThis ? `epsFY0=${epsThis.this}` : '',
  )
  console.log('  Max Jahr:', maxJahr, maxJahr >= 2028 ? '✓' : maxJahr >= 2027 ? '~' : '✗')
  return maxJahr >= 2027
}

let ok = 0
for (const t of TICKERS) {
  if (await verify(t)) ok++
}
console.log(`\n${ok}/${TICKERS.length} Titel mit Schätzungen bis mindestens 2027`)
process.exit(ok < TICKERS.length - 1 ? 1 : 0)

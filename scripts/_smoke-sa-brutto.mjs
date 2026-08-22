/**
 * Smoke: SA GuV (Brutto+EBITDA) + MS Chart Gross Profit.
 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function parseArrayLiteral(block, key) {
  const marker = `${key}:`
  const idx = block.indexOf(marker)
  if (idx < 0) return null
  const start = block.indexOf('[', idx)
  if (start < 0) return null
  let depth = 0
  let inStr = false
  let esc = false
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

function parseZahl(v) {
  if (v == null || v === '' || v === '[PRO]') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

async function scrapeSa(path) {
  const html = await (await fetch(`https://stockanalysis.com${path}`, { headers: { 'User-Agent': UA } })).text()
  const idx = html.search(/fiscalYear:\[/)
  const block = html.slice(Math.max(0, idx - 20), idx + 30_000)
  const years = (parseArrayLiteral(block, 'fiscalYear') || []).map((y) => Number(String(y).replace(/"/g, '')))
  const quarters = (parseArrayLiteral(block, 'fiscalQuarter') || []).map((q) => String(q).replace(/"/g, ''))
  const revenue = parseArrayLiteral(block, 'revenue') || []
  const gp = parseArrayLiteral(block, 'gp') || []
  const ebitda = parseArrayLiteral(block, 'ebitda') || []
  const rows = []
  for (let i = 0; i < years.length; i++) {
    const q = (quarters[i] || '').toUpperCase()
    if (/^H1$|^Q[123]$/i.test(q)) continue
    const umsatz = parseZahl(revenue[i])
    const brutto = parseZahl(gp[i])
    const eb = parseZahl(ebitda[i])
    if (umsatz == null && brutto == null && eb == null) continue
    rows.push({
      jahr: years[i],
      umsatzMio: umsatz != null ? Math.round(umsatz / 1e6) : null,
      bruttoMio: brutto != null ? Math.round(brutto / 1e6) : null,
      ebitdaMio: eb != null ? Math.round(eb / 1e6) : null,
    })
  }
  return { path, rows: rows.slice(0, 5) }
}

function decodeHtmlEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

function parseMsChart(html, titelRe) {
  const out = []
  for (const m of html.matchAll(/data-fct-attr="([^"]+)"/gi)) {
    const raw = decodeHtmlEntities(m[1])
    if (!titelRe.test(raw)) continue
    const cats = raw.match(/"categories"\s*:\s*\[([^\]]+)\]/)?.[1]
    const data = raw.match(/"data"\s*:\s*\[([^\]]+)\]/)?.[1]
    if (!cats || !data) continue
    const jahre = cats.split(',').map((x) => Number(x.trim())).filter((n) => n > 2000)
    const werte = data.split(',').map((x) => {
      const t = x.trim()
      if (t === 'null') return null
      const n = Number(t)
      return Number.isFinite(n) ? n : null
    })
    for (let i = 0; i < jahre.length; i++) {
      if (werte[i] == null) continue
      out.push({ jahr: jahre[i], mio: Math.round(werte[i] / 1e6) })
    }
    break
  }
  return out
}

const sa = await Promise.all([
  scrapeSa('/quote/epa/RMS/financials/income-statement/'),
  scrapeSa('/stocks/now/financials/income-statement/'),
  scrapeSa('/stocks/tmo/financials/income-statement/'),
])
console.log(JSON.stringify({ sa }, null, 2))

const msHtml = await (
  await fetch(
    'https://www.marketscreener.com/quote/stock/HERMES-INTERNATIONAL-4657/finances-income-statement/',
    { headers: { 'User-Agent': UA, Referer: 'https://www.marketscreener.com/' } },
  )
).text()
console.log(
  JSON.stringify(
    {
      msHermesBrutto: parseMsChart(msHtml, /Gross Profit/i).slice(-5),
      msHermesEbitda: parseMsChart(msHtml, /"serieName":"EBITDA"/i).slice(-5),
    },
    null,
    2,
  ),
)

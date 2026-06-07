const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

function parseOrig(html) {
  const marker = 'var originalData = '
  const i = html.indexOf(marker)
  if (i < 0) return null
  const start = i + marker.length
  let depth = 0
  let inStr = false
  let esc = false
  for (let j = start; j < html.length; j++) {
    const c = html[j]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') {
      inStr = true
      continue
    }
    if (c === '[') depth++
    if (c === ']') {
      depth--
      if (depth === 0) return JSON.parse(html.slice(start, j + 1))
    }
  }
  return null
}

function parseChart(html) {
  const marker = 'var chartData = '
  const i = html.indexOf(marker)
  if (i < 0) return null
  const start = i + marker.length
  let depth = 0
  let inStr = false
  let esc = false
  for (let j = start; j < html.length; j++) {
    const c = html[j]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') {
      inStr = true
      continue
    }
    if (c === '[') depth++
    if (c === ']') {
      depth--
      if (depth === 0) return JSON.parse(html.slice(start, j + 1))
    }
  }
  return null
}

function slug(field) {
  const m = String(field).match(/\/stocks\/charts\/[^/]+\/[^/]+\/([^'"]+)/)
  return m?.[1]
}

function werteAusChart(chart, perioden, feld = 'v3') {
  const byDate = new Map(chart.map((p) => [p.date, p]))
  const out = {}
  for (const iso of perioden) {
    const exakt = byDate.get(iso)
    if (exakt) {
      out[iso] = exakt[feld] ?? exakt.v3 ?? exakt.v1
      continue
    }
    const ziel = new Date(`${iso}T12:00:00Z`).getTime()
    let best = null
    let bestDiff = Infinity
    for (const p of chart) {
      const diff = Math.abs(new Date(`${p.date}T12:00:00Z`).getTime() - ziel)
      if (diff < bestDiff && diff <= 45 * 86400000) {
        bestDiff = diff
        best = p
      }
    }
    out[iso] = best ? (best[feld] ?? best.v3) : null
  }
  return out
}

async function main() {
  const fr = await (await fetch('https://www.macrotrends.net/stocks/charts/AAPL/apple/financial-ratios', { headers: { 'User-Agent': UA } })).text()
  const roh = parseOrig(fr)
  const perioden = [...new Set(roh.flatMap((z) => Object.keys(z).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))))].sort()
  console.log('Periods:', perioden.slice(-3))

  const roe = roh.find((z) => slug(z.field_name) === 'roe')
  console.log('ROE 2024:', roe['2024-09-30'])

  const is = await (await fetch('https://www.macrotrends.net/stocks/charts/AAPL/apple/income-statement', { headers: { 'User-Agent': UA } })).text()
  const isRoh = parseOrig(is)
  const rev = isRoh.find((z) => slug(z.field_name) === 'revenue')
  console.log('Revenue 2024 (raw millions):', rev['2024-09-30'])
  const eps = isRoh.find((z) => slug(z.field_name)?.includes('eps'))
  console.log('EPS slug:', slug(eps?.field_name), '2024:', eps?.['2024-09-30'])

  const iframe = await (await fetch('https://www.macrotrends.net/production/stocks/desktop/PRODUCTION/fundamental_iframe.php?t=AAPL&type=pe-ratio&statement=price-ratios&freq=A&sub=&yb=15', { headers: { 'User-Agent': UA } })).text()
  const chart = parseChart(iframe)
  const fyEnds = chart.filter((p) => p.date.endsWith('-09-30'))
  console.log('PE FY exact:', fyEnds.slice(-3))

  const mapped = werteAusChart(chart, perioden.slice(-3))
  console.log('PE mapped (fuzzy):', mapped)

  const pePage = await (await fetch('https://www.macrotrends.net/stocks/charts/AAPL/apple/pe-ratio', { headers: { 'User-Agent': UA } })).text()
  const rows = [...pePage.matchAll(/<td style="text-align:center;">(\d{4}-\d{2}-\d{2})<\/td>\s*<td[^>]*>([\d.]+)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([\d.]+)<\/td>/g)]
  console.log('PE HTML table last 3:', rows.slice(0, 3).map((m) => ({ date: m[1], pe: m[4] })))

  console.log('\n--- Income statement rows ---')
  for (const z of isRoh) {
    console.log(slug(z.field_name), '2024:', z['2024-09-30'])
  }

  const divIframe = await (await fetch('https://www.macrotrends.net/production/stocks/desktop/PRODUCTION/fundamental_iframe.php?t=AAPL&type=dividend-yield-history&statement=price-ratios&freq=A&sub=&yb=15', { headers: { 'User-Agent': UA } })).text()
  const divChart = parseChart(divIframe)
  console.log('\nDividend yield chart sample:', divChart?.slice(-5))
  console.log('Fields:', divChart?.[0] ? Object.keys(divChart[0]) : null)

  const cf = await (await fetch('https://www.macrotrends.net/stocks/charts/AAPL/apple/cash-flow-statement', { headers: { 'User-Agent': UA } })).text()
  const cfRoh = parseOrig(cf)
  console.log('\n--- Cash flow rows ---')
  for (const z of cfRoh ?? []) {
    console.log(slug(z.field_name), '2024:', z['2024-09-30'])
  }
}

main().catch(console.error)

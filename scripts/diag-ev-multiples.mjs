/** Validiert EV-Formel gegen Macrotrends. node scripts/diag-ev-multiples.mjs MSFT microsoft */
const IFRAME =
  'https://www.macrotrends.net/production/stocks/desktop/PRODUCTION/fundamental_iframe.php'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function parseJsonArray(html, marker) {
  const idx = html.indexOf(marker)
  if (idx < 0) return null
  const start = idx + marker.length
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < html.length; i++) {
    const ch = html[i]
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
          return JSON.parse(html.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

async function lade(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*' } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.text()
}

function slugOf(fieldName) {
  const m = String(fieldName).match(/\/stocks\/charts\/[^/]+\/[^/]+\/([^'">?]+)/i)
  return m?.[1] ?? null
}

function num(v) {
  if (v == null || v === '' || v === '-') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function rowVal(row, iso) {
  return row ? num(row[iso]) : null
}

function chartNear(chart, iso) {
  const ex = chart.find((p) => p.date === iso)
  if (ex) return ex
  const ziel = new Date(`${iso}T12:00:00Z`).getTime()
  let best = null
  let bestDiff = Infinity
  for (const p of chart) {
    const d = Math.abs(new Date(`${p.date}T12:00:00Z`).getTime() - ziel)
    if (d < bestDiff && d <= 45 * 86400000) {
      bestDiff = d
      best = p
    }
  }
  return best
}

/** Spiegel der App-Logik */
function appEv(mc, debt, cash, rev, ebitda) {
  if (mc == null || !(mc > 0)) return { evS: null, evE: null }
  const nd = debt != null || cash != null ? (debt ?? 0) - (cash ?? 0) : 0
  const ev = mc + nd
  return {
    evS: rev != null && rev > 0 ? ev / rev : null,
    evE: ebitda != null && ebitda > 0 ? ev / ebitda : null,
  }
}

const ticker = (process.argv[2] ?? 'MSFT').toUpperCase()
const slug = (process.argv[3] ?? ticker.toLowerCase()).toLowerCase()
console.log('Ticker', ticker, slug)

const [mcHtml, incHtml, bsHtml] = await Promise.all([
  lade(`${IFRAME}?t=${ticker}&type=market-cap&statement=price-ratios&freq=A&sub=&yb=15`),
  lade(`https://www.macrotrends.net/stocks/charts/${ticker}/${slug}/income-statement`),
  lade(`https://www.macrotrends.net/stocks/charts/${ticker}/${slug}/balance-sheet`),
])

const mcChart = parseJsonArray(mcHtml, 'var chartData = ') ?? []
const income = parseJsonArray(incHtml, 'var originalData = ') ?? []
const bs = parseJsonArray(bsHtml, 'var originalData = ') ?? []
const bySlug = (rows, s) => rows.find((r) => slugOf(r.field_name) === s)
const rev = bySlug(income, 'revenue')
const ebitda = bySlug(income, 'ebitda')
const ltd = bySlug(bs, 'long-term-debt')
const cash = bySlug(bs, 'cash-on-hand')

console.log('chart points', mcChart.length, 'income rows', income.length, 'bs rows', bs.length)

const years = Object.keys(rev ?? {})
  .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
  .sort()
  .slice(-6)

console.log('\nFY | MC | LTD | Cash | EV | Rev | EBITDA | EV/S | EV/EBITDA | appOK')
const results = {}
let appFail = false
for (const iso of years) {
  const pt = chartNear(mcChart, iso)
  const mcMio = pt?.v3 != null ? pt.v3 * 1000 : null
  const d = rowVal(ltd, iso)
  const c = rowVal(cash, iso)
  const r = rowVal(rev, iso)
  const e = rowVal(ebitda, iso)
  if (mcMio == null || r == null || e == null) {
    console.log(iso, 'unvollständig', { mcMio, r, e, d, c })
    continue
  }
  const ev = mcMio + (d ?? 0) - (c ?? 0)
  const evS = ev / r
  const evE = ev / e
  results[iso] = { evS, evE }
  const app = appEv(mcMio, d, c, r, e)
  const ok =
    app.evS != null &&
    app.evE != null &&
    Math.abs(app.evS - evS) < 1e-9 &&
    Math.abs(app.evE - evE) < 1e-9
  if (!ok) appFail = true
  console.log(
    [iso, mcMio.toFixed(0), (d ?? 0).toFixed(0), (c ?? 0).toFixed(0), ev.toFixed(0), r.toFixed(0), e.toFixed(0), evS.toFixed(2), evE.toFixed(2), ok ? 'OK' : 'BAD'].join(' | '),
  )
}

if (ticker === 'MSFT') {
  const ref = {
    '2024-06-30': { evS: 13.27, evE: 24.95 },
    '2025-06-30': { evS: 12.88, evE: 22.98 },
  }
  let max = 0
  console.log('\nVs Referenz:')
  for (const [iso, r] of Object.entries(ref)) {
    const got = results[iso]
    if (!got) {
      console.error('fehlt', iso)
      process.exit(2)
    }
    const dS = Math.abs(got.evS - r.evS)
    const dE = Math.abs(got.evE - r.evE)
    max = Math.max(max, dS, dE)
    console.log(`${iso}: EV/S ${got.evS.toFixed(2)} (Δ${dS.toFixed(3)}) · EV/EBITDA ${got.evE.toFixed(2)} (Δ${dE.toFixed(3)})`)
  }
  if (max > 0.05 || appFail) {
    console.error('FAIL', { max, appFail })
    process.exit(2)
  }
  console.log('PASS')
}

/**
 * End-to-End: Yahoo Total Debt Overlay + EV-Formel (App-Spiegel).
 * node scripts/diag-ev-pipeline.mjs MSFT microsoft
 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const IFRAME =
  'https://www.macrotrends.net/production/stocks/desktop/PRODUCTION/fundamental_iframe.php'

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
      if (depth === 0) return JSON.parse(html.slice(start, i + 1))
    }
  }
  return null
}

async function lade(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(String(res.status))
  return res.text()
}

async function yahooAuth() {
  let res = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA }, redirect: 'manual' })
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
  res = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, Cookie: cookie },
  })
  return { crumb: (await res.text()).trim(), cookie }
}

function slugOf(fn) {
  return String(fn).match(/\/stocks\/charts\/[^/]+\/[^/]+\/([^'">?]+)/i)?.[1] ?? null
}
function num(v) {
  if (v == null || v === '' || v === '-') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Spiegel: enterpriseValueMioFuerKey + EV multiples */
function appEvMultiples(mc, debt, cash, rev, ebitda) {
  if (mc == null || !(mc > 0)) return { evS: null, evE: null }
  const nd = (debt ?? 0) - (cash ?? 0)
  const ev = mc + nd
  return {
    evS: rev != null && rev > 0 ? ev / rev : null,
    evE: ebitda != null && ebitda > 0 ? ev / ebitda : null,
  }
}

const ticker = (process.argv[2] ?? 'MSFT').toUpperCase()
const slug = (process.argv[3] ?? ticker.toLowerCase()).toLowerCase()

const auth = await yahooAuth()
const u = new URL(
  `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${ticker}`,
)
u.searchParams.set('symbol', ticker)
u.searchParams.set(
  'type',
  'annualTotalDebt,annualCurrentDebtAndCapitalLeaseObligation,annualLongTermDebtAndCapitalLeaseObligation,annualCashCashEquivalentsAndShortTermInvestments',
)
u.searchParams.set('period1', String(Math.floor(new Date('2015-01-01') / 1000)))
u.searchParams.set('period2', String(Math.floor(Date.now() / 1000)))
u.searchParams.set('crumb', auth.crumb)

const [yj, mcHtml, incHtml, bsHtml] = await Promise.all([
  fetch(u, { headers: { 'User-Agent': UA, Cookie: auth.cookie } }).then((r) => r.json()),
  lade(`${IFRAME}?t=${ticker}&type=market-cap&statement=price-ratios&freq=A&sub=&yb=15`),
  lade(`https://www.macrotrends.net/stocks/charts/${ticker}/${slug}/income-statement`),
  lade(`https://www.macrotrends.net/stocks/charts/${ticker}/${slug}/balance-sheet`),
])

function yMap(typ) {
  const m = new Map()
  const b = (yj.timeseries?.result ?? []).find((x) => x.meta?.type?.[0] === typ)
  const t = b?.meta?.type?.[0]
  if (!t || !Array.isArray(b[t])) return m
  for (const p of b[t]) {
    if (p.asOfDate && p.reportedValue?.raw != null) m.set(p.asOfDate.slice(0, 10), p.reportedValue.raw / 1e6)
  }
  return m
}

const totalDebt = yMap('annualTotalDebt')
const curDebt = yMap('annualCurrentDebtAndCapitalLeaseObligation')
const ltDebt = yMap('annualLongTermDebtAndCapitalLeaseObligation')
const cashSti = yMap('annualCashCashEquivalentsAndShortTermInvestments')
const mcChart = parseJsonArray(mcHtml, 'var chartData = ') ?? []
const income = parseJsonArray(incHtml, 'var originalData = ') ?? []
const bs = parseJsonArray(bsHtml, 'var originalData = ') ?? []
const rev = income.find((r) => slugOf(r.field_name) === 'revenue')
const ebitda = income.find((r) => slugOf(r.field_name) === 'ebitda')
const mtLtd = bs.find((r) => slugOf(r.field_name) === 'long-term-debt')

console.log('Ticker', ticker)
console.log('Quelle: Yahoo Total Debt (= Current+LT inkl. Leases) + Macrotrends Marktkap')
console.log('\nFY | MC | Total | Current | LT | Cash+STI | EV/S | EV/EBITDA | TeileOK | vsLTD')

let fail = false
let yearsWithSt = 0
for (const iso of [...totalDebt.keys()].sort()) {
  const pt = mcChart.find((p) => p.date === iso)
  if (!pt?.v3) continue
  const mc = pt.v3 * 1000
  const td = totalDebt.get(iso)
  const cd = curDebt.get(iso) ?? 0
  const ld = ltDebt.get(iso) ?? 0
  const cash = cashSti.get(iso)
  const r = num(rev?.[iso])
  const e = num(ebitda?.[iso])
  if (td == null || cash == null || !r || !e) continue

  const partsOk = Math.abs(cd + ld - td) / td < 0.02
  if (!partsOk) fail = true
  if (cd > 0) yearsWithSt++

  const { evS, evE } = appEvMultiples(mc, td, cash, r, e)
  const ltdOnly = num(mtLtd?.[iso])
  const oldEvS = ltdOnly != null ? appEvMultiples(mc, ltdOnly, cash, r, e).evS : null

  console.log(
    [
      iso,
      mc.toFixed(0),
      td.toFixed(0),
      cd.toFixed(0),
      ld.toFixed(0),
      cash.toFixed(0),
      evS.toFixed(2),
      evE.toFixed(2),
      partsOk ? 'OK' : 'BAD',
      oldEvS != null ? `Δ${(evS - oldEvS).toFixed(2)}` : '–',
    ].join(' | '),
  )
}

if (yearsWithSt === 0) {
  console.error('FAIL: keine kurzfristigen Schulden gefunden')
  fail = true
}

// Spot-Check: letztes Jahr mit Total + Current
const lastIso = [...totalDebt.keys()].sort().at(-1)
const zDebt = lastIso ? totalDebt.get(lastIso) : null
const zCur = lastIso ? curDebt.get(lastIso) : null
if (zDebt == null || zCur == null) {
  console.error('FAIL: fehlende Yahoo-Jahre')
  fail = true
} else {
  console.log(`\n${lastIso}: Kurzfristig ${((zCur / zDebt) * 100).toFixed(1)} % der Gesamtverschuldung`)
}

if (fail) {
  console.error('\nFAIL')
  process.exit(2)
}
console.log('\nPASS — Yahoo Total Debt inkl. kurzfristiger Schulden ist konsistent und in der EV-Formel nutzbar')

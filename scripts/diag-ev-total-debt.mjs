/**
 * Validiert EV mit Yahoo Total Debt (inkl. kurzfristig + Leases) + Macrotrends Marktkap.
 * node scripts/diag-ev-total-debt.mjs MSFT microsoft
 */
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

async function yahooAuth() {
  let res = await fetch('https://fc.yahoo.com', {
    headers: { 'User-Agent': UA },
    redirect: 'manual',
  })
  const setCookie = res.headers.getSetCookie?.() ?? []
  let cookie = setCookie.map((c) => c.split(';')[0]).join('; ')
  res = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, Cookie: cookie },
  })
  return { crumb: (await res.text()).trim(), cookie }
}

function punkteMap(blocks, typ) {
  const out = new Map()
  const b = blocks.find((x) => x.meta?.type?.[0] === typ)
  const t = b?.meta?.type?.[0]
  if (!t || !Array.isArray(b[t])) return out
  for (const p of b[t]) {
    const iso = p.asOfDate?.slice(0, 10)
    const raw = p.reportedValue?.raw
    if (iso && raw != null) out.set(iso, raw / 1e6)
  }
  return out
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

const ticker = (process.argv[2] ?? 'MSFT').toUpperCase()
const slug = (process.argv[3] ?? ticker.toLowerCase()).toLowerCase()

const auth = await yahooAuth()
const period1 = Math.floor(new Date('2015-01-01').getTime() / 1000)
const period2 = Math.floor(Date.now() / 1000)
const yu = new URL(
  `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${ticker}`,
)
yu.searchParams.set('symbol', ticker)
yu.searchParams.set(
  'type',
  [
    'annualTotalDebt',
    'annualCurrentDebtAndCapitalLeaseObligation',
    'annualLongTermDebtAndCapitalLeaseObligation',
    'annualCashCashEquivalentsAndShortTermInvestments',
  ].join(','),
)
yu.searchParams.set('period1', String(period1))
yu.searchParams.set('period2', String(period2))
yu.searchParams.set('crumb', auth.crumb)

const [yRes, mcHtml, incHtml] = await Promise.all([
  fetch(yu.toString(), {
    headers: { 'User-Agent': UA, Cookie: auth.cookie, Accept: 'application/json' },
  }),
  lade(`${IFRAME}?t=${ticker}&type=market-cap&statement=price-ratios&freq=A&sub=&yb=15`),
  lade(`https://www.macrotrends.net/stocks/charts/${ticker}/${slug}/income-statement`),
])

const blocks = (await yRes.json()).timeseries?.result ?? []
const totalDebt = punkteMap(blocks, 'annualTotalDebt')
const curDebt = punkteMap(blocks, 'annualCurrentDebtAndCapitalLeaseObligation')
const ltDebt = punkteMap(blocks, 'annualLongTermDebtAndCapitalLeaseObligation')
const cashSti = punkteMap(blocks, 'annualCashCashEquivalentsAndShortTermInvestments')

const mcChart = parseJsonArray(mcHtml, 'var chartData = ') ?? []
const income = parseJsonArray(incHtml, 'var originalData = ') ?? []
const rev = income.find((r) => slugOf(r.field_name) === 'revenue')
const ebitda = income.find((r) => slugOf(r.field_name) === 'ebitda')

console.log('Ticker', ticker)
console.log('\nFY | MC | TotalDebt | Current | LT+Lease | Cash+STI | EV | EV/S | EV/EBITDA | STShare%')
let fail = false
for (const iso of [...totalDebt.keys()].sort().slice(-6)) {
  const pt = mcChart.find((p) => p.date === iso)
  if (!pt?.v3) {
    console.log(iso, 'kein Marktkap')
    continue
  }
  const mc = pt.v3 * 1000
  const td = totalDebt.get(iso)
  const cd = curDebt.get(iso) ?? 0
  const ld = ltDebt.get(iso) ?? 0
  const cash = cashSti.get(iso)
  const r = num(rev?.[iso])
  const e = num(ebitda?.[iso])
  if (td == null || cash == null || r == null || e == null) {
    console.log(iso, 'unvollständig')
    continue
  }
  // Konsistenz: Total ≈ Current + LT
  const sumParts = cd + ld
  const partsOk = Math.abs(sumParts - td) / td < 0.02
  if (!partsOk) {
    console.error('FAIL Teile≠Total', iso, { td, sumParts })
    fail = true
  }
  const ev = mc + td - cash
  const evS = ev / r
  const evE = ev / e
  const stShare = (cd / td) * 100
  console.log(
    [
      iso,
      mc.toFixed(0),
      td.toFixed(0),
      cd.toFixed(0),
      ld.toFixed(0),
      cash.toFixed(0),
      ev.toFixed(0),
      evS.toFixed(2),
      evE.toFixed(2),
      stShare.toFixed(1) + '%',
      partsOk ? 'OK' : 'BAD',
    ].join(' | '),
  )
}

// App-Logik-Spiegel: usd/1e6 + mc + debt - cash
function appEv(mc, debt, cash, r, e) {
  const ev = mc + debt - cash
  return { evS: ev / r, evE: ev / e }
}

if (ticker === 'MSFT') {
  // Referenz manuell aus Live-Daten (Total Debt Yahoo)
  const iso = '2024-06-30'
  const pt = mcChart.find((p) => p.date === iso)
  const mc = pt.v3 * 1000
  const td = totalDebt.get(iso)
  const cash = cashSti.get(iso)
  const r = num(rev[iso])
  const e = num(ebitda[iso])
  const got = appEv(mc, td, cash, r, e)
  console.log('\nMSFT 2024 App-Formel:', got)
  console.log('Kurzfristig Anteil:', ((curDebt.get(iso) / td) * 100).toFixed(1) + '%')
  // Alte (nur LTD) vs neu
  const ltdOnly = 42688
  const oldEvS = (mc + ltdOnly - cash) / r
  console.log('Alt (nur LTD) EV/S:', oldEvS.toFixed(2), '→ Neu:', got.evS.toFixed(2))
  if (!(got.evS > oldEvS)) {
    console.error('FAIL: Total-Debt-EV sollte höher sein als LTD-only')
    fail = true
  }
}

if (fail) process.exit(2)
console.log('\nPASS')

/** node scripts/diag-yahoo-debt.mjs MSFT */
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

// Plain fetch via Yahoo crumb like the app
async function yahooAuth() {
  let res = await fetch('https://fc.yahoo.com', {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: '*/*' },
    redirect: 'manual',
  })
  const setCookie = res.headers.getSetCookie?.() ?? []
  let cookie = setCookie.map((c) => c.split(';')[0]).join('; ')
  if (!cookie) {
    const raw = res.headers.get('set-cookie')
    if (raw) cookie = raw.split(',').map((p) => p.split(';')[0].trim()).filter(Boolean).join('; ')
  }
  res = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': 'Mozilla/5.0', Cookie: cookie, Accept: '*/*' },
  })
  const crumb = (await res.text()).trim()
  return { crumb, cookie }
}

const symbol = (process.argv[2] ?? 'MSFT').toUpperCase()
const types = [
  'annualTotalDebt',
  'annualLongTermDebt',
  'annualCurrentDebt',
  'annualCurrentDebtAndCapitalLeaseObligation',
  'annualLongTermDebtAndCapitalLeaseObligation',
  'annualCashAndCashEquivalents',
  'annualCashCashEquivalentsAndShortTermInvestments',
  'annualTotalCash',
].join(',')

const auth = await yahooAuth()
console.log('auth', Boolean(auth.crumb), auth.crumb.slice(0, 8))

const period1 = Math.floor(new Date('2015-01-01').getTime() / 1000)
const period2 = Math.floor(Date.now() / 1000)
const u = new URL(
  `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${symbol}`,
)
u.searchParams.set('symbol', symbol)
u.searchParams.set('type', types)
u.searchParams.set('period1', String(period1))
u.searchParams.set('period2', String(period2))
u.searchParams.set('crumb', auth.crumb)

const res = await fetch(u.toString(), {
  headers: {
    'User-Agent': 'Mozilla/5.0',
    Cookie: auth.cookie,
    Accept: 'application/json',
  },
})
console.log('status', res.status)
const j = await res.json()
const blocks = j.timeseries?.result ?? []
for (const b of blocks) {
  const typ = b.meta?.type?.[0]
  const pts = typ && Array.isArray(b[typ]) ? b[typ] : []
  console.log('\n==', typ, 'n=', pts.length)
  for (const p of pts.slice(-8)) {
    const v = p.reportedValue?.raw
    console.log(p.asOfDate, v != null ? (v / 1e6).toFixed(0) + ' Mio' : null)
  }
}

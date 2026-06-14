// Finnhub ETF holdings - read key from env if present
import { readFileSync } from 'fs'
let key = process.env.FINNHUB_API_KEY ?? ''
try {
  const env = readFileSync('.env.local', 'utf8')
  const m = env.match(/^FINNHUB_API_KEY=(.+)$/m)
  if (m) key = m[1].trim()
} catch {}

if (!key) {
  console.log('no finnhub key')
  process.exit(0)
}

for (const sym of ['QQQ', 'SPY', 'XDEW.L', '500.PA', 'ANX.PA']) {
  const u = new URL('https://finnhub.io/api/v1/etf/holdings')
  u.searchParams.set('symbol', sym)
  u.searchParams.set('token', key)
  const r = await fetch(u.toString())
  const j = await r.json()
  console.log(sym, r.status, Array.isArray(j) ? j.length : j?.holdings?.length ?? JSON.stringify(j).slice(0, 120))
}

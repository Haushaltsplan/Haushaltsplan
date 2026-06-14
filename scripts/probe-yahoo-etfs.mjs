import { holeYahooFinanceAuth, YAHOO_FINANCE_FETCH_HEADERS } from './lib/portfolio-analyse/yahoo-finance-auth-server.ts'

const auth = await holeYahooFinanceAuth()
console.log('auth', !!auth)
for (const sym of ['XDEW.L', '500.PA', 'ANX.PA']) {
  const u = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}`)
  u.searchParams.set('modules', 'topHoldings,fundSectorWeightings,fundProfile')
  u.searchParams.set('crumb', auth?.crumb ?? '')
  const r = await fetch(u.toString(), {
    headers: { ...YAHOO_FINANCE_FETCH_HEADERS, Cookie: auth?.cookie ?? '' },
  })
  const j = await r.json()
  const th = j.quoteSummary?.result?.[0]?.topHoldings?.holdings
  console.log(sym, r.status, 'holdings', th?.length ?? 0, th?.slice(0, 2))
}

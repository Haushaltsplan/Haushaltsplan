const UA = 'Mozilla/5.0'
async function auth() {
  let r = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA } })
  let jar = ''
  for (const c of r.headers.getSetCookie?.() || []) jar += c.split(';')[0] + '; '
  r = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, Cookie: jar },
  })
  return { cookie: jar, crumb: await r.text() }
}

const types = [
  'annualTotalRevenue',
  'annualGrossProfit',
  'annualOperatingIncome',
  'annualNetIncome',
  'annualEBITDA',
  'annualDilutedEPS',
]
const { cookie, crumb } = await auth()
for (const sym of ['RMS.PA', 'HESAY']) {
  const u = new URL(
    `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${sym}`,
  )
  u.searchParams.set('type', types.join(','))
  u.searchParams.set('period1', '946684800')
  u.searchParams.set('period2', String(Math.floor(Date.now() / 1000)))
  u.searchParams.set('crumb', crumb)
  const j = await fetch(u, { headers: { 'User-Agent': UA, Cookie: cookie } }).then((r) => r.json())
  console.log('\n===', sym, '===')
  for (const typ of types) {
    const b = j.timeseries?.result?.find((x) => x.meta?.type?.[0] === typ)
    const arr = b?.[typ] || []
    console.log(typ, arr.length, arr.map((p) => p.asOfDate).join(', '))
  }
}

const sym = process.argv[2] ?? 'AAPL'

async function main() {
  let res = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'manual' })
  const jar = new Map()
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [kv] = c.split(';')
    const eq = kv.indexOf('=')
    if (eq > 0) jar.set(kv.slice(0, eq), kv.slice(eq + 1))
  }
  const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  res = await fetch(`https://query1.finance.yahoo.com/v1/test/getcrumb`, { headers: { 'User-Agent': 'Mozilla/5.0', Cookie: cookie } })
  const crumb = await res.text()

  const u = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${sym}`)
  u.searchParams.set('modules', 'earningsTrend')
  u.searchParams.set('crumb', crumb)
  res = await fetch(u.toString(), { headers: { 'User-Agent': 'Mozilla/5.0', Cookie: cookie } })
  const trend = (await res.json()).quoteSummary?.result?.[0]?.earningsTrend?.trend ?? []
  for (const t of trend) {
    console.log(
      t.period,
      t.endDate?.fmt ?? t.endDate,
      'rev avg:', t.revenueEstimate?.avg?.raw,
      'eps avg:', t.earningsEstimate?.avg?.raw,
      'rev gr:', t.revenueEstimate?.growth?.raw,
      'eps gr:', t.earningsEstimate?.growth?.raw,
    )
  }
}

main().catch(console.error)

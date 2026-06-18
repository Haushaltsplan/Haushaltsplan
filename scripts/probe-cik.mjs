const tickers = ['ATD', 'ATD.TO', 'HLMA', 'H11', 'H11.SG', 'MUM', 'MUM.DE', 'SIKA', 'SIKA.SW']
for (const t of tickers) {
  const res = await fetch(`https://www.sec.gov/files/company_tickers.json`, {
    headers: { 'User-Agent': 'Omnia test contact@example.com' },
  })
  const raw = await res.json()
  let cik = null
  for (const row of Object.values(raw)) {
    if (row.ticker?.toUpperCase() === t.toUpperCase()) cik = row.cik_str
  }
  console.log(t, cik ?? 'no cik')
}

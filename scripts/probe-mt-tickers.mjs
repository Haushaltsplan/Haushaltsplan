const UA = 'Mozilla/5.0'
for (const [ticker, slug] of [
  ['RMS', 'hermes-international'],
  ['HESAY', 'hermes-international'],
  ['RMS.PA', 'hermes-international'],
]) {
  const h = await fetch(`https://www.macrotrends.net/stocks/charts/${ticker}/${slug}/income-statement`, {
    headers: { 'User-Agent': UA },
  }).then((r) => r.text())
  const m = h.match(/var originalData = (\[[\s\S]*?\]);/)
  if (!m) {
    console.log(ticker, 'no data')
    continue
  }
  const d = JSON.parse(m[1])
  const rev = d.find((r) => String(r.field_name).includes('revenue'))
  const years = Object.keys(rev).filter((k) => /^\d{4}/.test(k)).sort()
  console.log(ticker, years.length, years[0], years[years.length - 1])
}

const UA = 'Mozilla/5.0'
const url = 'https://www.macrotrends.net/stocks/charts/HESAY/hermes-international/revenue'
const h = await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.text())

for (const key of ['originalData', 'chartData', 'data_date']) {
  const m = h.match(new RegExp(`var ${key} = ([\\s\\S]*?);`))
  if (!m) {
    console.log(key, 'missing')
    continue
  }
  try {
    const d = JSON.parse(m[1])
    if (Array.isArray(d)) {
      console.log(key, 'array len', d.length)
      if (d[0]?.date) console.log('  first/last date', d[0].date, d[d.length - 1].date)
      if (d[0]?.field_name) {
        const years = Object.keys(d[0]).filter((k) => /^\d{4}/.test(k)).sort()
        console.log('  year cols', years.length, years[0], years[years.length - 1])
      }
    } else console.log(key, typeof d)
  } catch (e) {
    console.log(key, 'parse err', String(e).slice(0, 80))
  }
}

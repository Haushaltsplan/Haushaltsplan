const h = await fetch('https://stockanalysis.com/quote/epa/RMS/financials/', {
  headers: { 'User-Agent': 'Mozilla/5.0' },
}).then((r) => r.text())

for (const y of ['2020', '2019', '2018', '2017', '2016', '2015', '2014', '2013', '2012']) {
  console.log(y, h.includes(`"${y}"`))
}

// forecast page
const f = await fetch('https://stockanalysis.com/quote/epa/RMS/forecast/', {
  headers: { 'User-Agent': 'Mozilla/5.0' },
}).then((r) => r.text())
const idx = f.indexOf('fiscalYear:["')
console.log('\nforecast fiscalYear', f.slice(idx, idx + 400))

const h = await fetch('https://stockanalysis.com/quote/epa/RMS/financials/', {
  headers: { 'User-Agent': 'Mozilla/5.0' },
}).then((r) => r.text())

const idx = h.indexOf('fiscalYear:["')
console.log('has fiscalYear', idx >= 0)
if (idx >= 0) {
  console.log(h.slice(idx, idx + 800))
}

const annualStart = h.indexOf('annual:{')
console.log('annual block', annualStart >= 0)

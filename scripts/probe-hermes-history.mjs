const UA = 'Mozilla/5.0'

// Macrotrends chart iframe for revenue
const iframe = await fetch(
  'https://www.macrotrends.net/production/stocks/desktop/PRODUCTION/fundamental_iframe.php?t=HESAY&type=revenue&statement=income-statement&freq=A&sub=&yb=15',
  { headers: { 'User-Agent': UA } },
).then((r) => r.text())
const cm = iframe.match(/var chartData = (\[[\s\S]*?\]);/)
if (cm) {
  const d = JSON.parse(cm[1])
  console.log('chartData points', d.length, d[0]?.date, d[d.length - 1]?.date)
}

// StockAnalysis Hermes
for (const path of [
  'https://stockanalysis.com/quote/epa/RMS/financials/',
  'https://stockanalysis.com/quote/epa/RMS/financials/?p=annual',
  'https://stockanalysis.com/quote/otc/HESAY/financials/',
]) {
  const h = await fetch(path, { headers: { 'User-Agent': UA } }).then((r) => r.text())
  console.log(path, h.length, '2012', h.includes('2012'), '2015', h.includes('2015'))
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const cases = [
  ['HLMA', 'GB0004052071', 'H11.SG', 'https://stockanalysis.com/quote/lon/HLMA/financials/', 'https://stockanalysis.com/quote/etr/H11/financials/'],
  ['SIKA', 'CH0418792922', 'SIKA.SW', 'https://stockanalysis.com/quote/swx/SIKA/financials/'],
  ['ATD', 'CA01626P1484', 'ATD.TO', 'https://stockanalysis.com/quote/tsx/ATD/financials/'],
  ['MUM', 'DE0006580806', 'MUM.DE', 'https://stockanalysis.com/quote/etr/MUM/financials/'],
]

for (const row of cases) {
  const [name, isin, sym, ...saUrls] = row
  console.log('\n===', name, isin, sym, '===')
  for (const sa of saUrls) {
    const res = await fetch(sa, { headers: { 'User-Agent': UA } })
    const h = await res.text()
    const fy = h.match(/fiscalYear:\s*\[([^\]]+)\]/)
    console.log('SA', sa.split('/').slice(-3, -1).join('/'), res.status, fy ? fy[1].slice(0, 50) : 'NO DATA')
  }
  const mt = `https://www.macrotrends.net/stocks/charts/${name}/${name.toLowerCase()}/financial-ratios`
  const mtSlug = {
    HLMA: 'halma',
    SIKA: 'sika',
    ATD: 'alimentation-couche-tard',
    MUM: 'mensch-und-maschine',
  }[name]
  const mtUrl = `https://www.macrotrends.net/stocks/charts/${name === 'HLMA' ? 'HLMA' : name}/${mtSlug}/financial-ratios`
  const mtr = await fetch(mtUrl, { headers: { 'User-Agent': UA } })
  const mth = await mtr.text()
  console.log('MT', mtUrl.split('/').slice(-2).join('/'), mtr.status, /originalData/.test(mth), mth.includes('Oops'))
}

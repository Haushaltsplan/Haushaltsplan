import { writeFileSync } from 'fs'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function main() {
  for (const path of [
    'https://stockanalysis.com/quote/epa/RMS/financials/income-statement/',
    'https://stockanalysis.com/stocks/now/financials/income-statement/',
  ]) {
    const html = await (await fetch(path, { headers: { 'User-Agent': UA } })).text()
    console.log('\n===', path)
    console.log('annual:{', html.includes('annual:{'), 'fiscalYear', html.includes('fiscalYear:["'))
    console.log('grossProfit array', /grossProfit:\s*\[/.test(html), 'gp:', /gp:\s*\[/.test(html))
    const i = html.indexOf('fiscalYear:[')
    console.log('snip', html.slice(i, i + 400).replace(/\s+/g, ' '))
    if (path.includes('RMS')) writeFileSync('scripts/_sa-rms-is.txt', html.slice(Math.max(0, i - 200), i + 8000))
  }
}

main().catch(console.error)

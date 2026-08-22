const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const html = await (
  await fetch(
    'https://www.marketscreener.com/quote/stock/HERMES-INTERNATIONAL-4657/finances-income-statement/',
    { headers: { 'User-Agent': UA, Referer: 'https://www.marketscreener.com/' } },
  )
).text()

console.log('len', html.length)
for (const p of ['Gross Profit', 'Gross profit', 'Marge brute', 'income-statement', 'data-field', 'financials']) {
  console.log(p, html.includes(p), html.toLowerCase().includes(p.toLowerCase()))
}
const i = html.toLowerCase().indexOf('gross profit')
console.log('snip', html.slice(Math.max(0, i - 100), i + 300).replace(/\s+/g, ' '))

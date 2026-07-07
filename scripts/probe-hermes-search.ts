const UA = 'Mozilla/5.0'
const isin = 'FR0000052292'

async function main() {
  const html = await (
    await fetch(`https://www.marketscreener.com/search/?q=${isin}`, { headers: { 'User-Agent': UA } })
  ).text()
  const idx = html.indexOf(isin)
  console.log('idx', idx)
  console.log(html.slice(Math.max(0, idx - 400), idx + 400))
}

main()

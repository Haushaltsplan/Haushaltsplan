/**
 * npx tsx scripts/probe-ms-search-html.ts
 */
async function main() {
  const html = await (
    await fetch('https://www.marketscreener.com/search/?q=MSFT', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
  ).text()
  const idx = html.indexOf('Instruments')
  console.log(html.slice(idx, idx + 4000))
}

main()

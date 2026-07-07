/**
 * npx tsx scripts/probe-ms-search-table.ts
 */
async function main() {
  const html = await (
    await fetch('https://www.marketscreener.com/search/?q=MSFT', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
  ).text()
  const markers = ['MICROSOFT CORPORATION', 'instruments', 'table--search', 'search-results', 'js-instrument']
  for (const m of markers) {
    const i = html.indexOf(m)
    console.log(m, i)
    if (i >= 0) console.log(html.slice(i, i + 600), '\n---')
  }
}

main()

const isins = ['LU1681038243', 'IE00BLNMYC90', 'IE00BJXRZJ40']
for (const isin of isins) {
  const r = await fetch(`https://extraetf.com/de/etf-profile/${isin}?tab=components`, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'de-DE' },
  })
  const html = await r.text()
  const tableIdx = html.indexOf('<table class="table table-hover table-top-holdings"')
  console.log('\n', isin, 'table at', tableIdx)
  if (tableIdx >= 0) {
    const chunk = html.slice(tableIdx, tableIdx + 5000)
    const rows = [...chunk.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    console.log('rows', rows.length)
    for (const row of rows.slice(1, 6)) {
      const text = row[1].replace(/<[^>]+>/g, '|').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
      console.log(' ', text.slice(0, 200))
    }
  }
  console.log('blurred', html.includes('auth-offer'), 'lock-icon', html.includes('lock-icon'))
}

// Yahoo for XDEW.L
const yahoo = await fetch('https://query2.finance.yahoo.com/v10/finance/quoteSummary/XDEW.L?modules=topHoldings,fundSectorWeightings,fundProfile')
console.log('\nYahoo direct', yahoo.status)

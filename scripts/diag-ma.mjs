const UA = 'Omnia test@example.com'
const h = await (await fetch('https://www.sec.gov/Archives/edgar/data/1141391/000114139126000013/ma-20251231.htm', { headers: { 'User-Agent': UA } })).text()
const re = /name="(?:us-gaap:)?ScheduleOfRevenuesFromExternalCustomersAndLongLivedAssetsByGeographicalAreasTableTextBlock"/i
const idx = h.search(re)
const start = h.lastIndexOf('<ix:nonNumeric', idx)
const end = h.indexOf('</ix:nonNumeric>', start)
const block = h.slice(start, end)
for (const row of block.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
  const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
    .map(m => m[1].replace(/<[^>]+>/g,' ').replace(/&#160;/g,'').replace(/\s+/g,' ').trim())
    .filter(c => c && c !== '$')
  const ix = [...row[1].matchAll(/<ix:nonfraction[^>]*>([\s\S]*?)<\/ix:nonfraction>/gi)].map(m => m[1].replace(/,/g,''))
  if (cells.length || ix.length) console.log({ cells, ix: ix.slice(0,3) })
}

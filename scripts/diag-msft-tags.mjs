const UA = 'Omnia test@example.com'
const url = 'https://www.sec.gov/Archives/edgar/data/789019/000095017025100235/msft-20250630.htm'
const h = await (await fetch(url, { headers: { 'User-Agent': UA } })).text()
const idx = h.indexOf('ScheduleOfSegmentReportingInformationBySegmentTextBlock')
const start = h.lastIndexOf('<ix:nonNumeric', idx)
const end = h.indexOf('</ix:nonNumeric>', start) + 16
const block = h.slice(start, end)

function zellenText(td) {
  return td.replace(/<ix:nonfraction[^>]*>([\s\S]*?)<\/ix:nonfraction>/gi, '$1')
    .replace(/<[^>]+>/g, ' ').replace(/&#160;/g,'').replace(/\s+/g,' ').trim()
}

let n = 0
for (const row of block.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
  const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => zellenText(m[1])).filter(Boolean)
  if (cells.length) { console.log(n++, cells.slice(0,4)); if (n > 25) break }
}

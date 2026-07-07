const UA = 'Mozilla/5.0'
for (const [sym, slug] of [
  ['ODFL', 'OLD-DOMINION-FREIGHT-LINE-10317'],
  ['KNSL', 'KINSALE-CAPITAL-GROUP-INC-30379189'],
] as const) {
  const html = await (
    await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`, {
      headers: { 'User-Agent': UA },
    })
  ).text()
  const ca1 = html.match(/id="financialSegmentCA1"[\s\S]*?data-fct-attr="(\{[^"]+\})"/)
  const ca2 = html.match(/id="financialSegmentCA2"[\s\S]*?data-fct-attr="(\{[^"]+\})"/)
  function decode(s: string) {
    return s.replace(/&quot;/g, '"')
  }
  for (const [id, m] of [
    ['CA1', ca1],
    ['CA2', ca2],
  ] as const) {
    if (!m?.[1]) {
      console.log(sym, id, 'none')
      continue
    }
    const p = JSON.parse(decode(m[1])) as { data?: Record<string, unknown> }
    console.log(sym, id, Object.keys(p.data ?? {}))
  }
  const hasGeoTable = /Geographical breakdown of sales/i.test(html)
  const hasProdTable = /Breakdown by Business Segment/i.test(html)
  console.log(sym, 'tables', hasProdTable, hasGeoTable)
}

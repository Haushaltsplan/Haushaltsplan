async function main() {
const slug = 'ASML-HOLDING-N-V-12002973'
const html = await (
  await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
).text()
const ids = [...html.matchAll(/id="(financial[^"]+)"/g)].map((m) => m[1])
console.log('chart ids:', [...new Set(ids)])
const h2 = [...html.matchAll(/card-title[^>]*>\s*([^<]{5,80})/g)].map((m) => m[1].trim())
console.log('sections:', h2.slice(0, 20))

function decodeAttr(s: string) {
  return s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

for (const id of ['financialSegmentCA1', 'financialSegmentCA2', 'financialSegmentLastYearChar1']) {
  const m = html.match(new RegExp(`id="${id}"[\\s\\S]*?data-fct-attr="(\\{[^"]+\\})"`))
  if (!m?.[1]) continue
  try {
    const p = JSON.parse(decodeAttr(m[1])) as { start?: number; currency?: string; data?: Record<string, { data: number[] }> }
    const names = Object.keys(p.data ?? {})
    console.log(id, 'start', p.start, 'cur', p.currency, 'segs', names.length, names.slice(0, 3))
  } catch (e) {
    console.log(id, 'parse err')
  }
}
}

main()

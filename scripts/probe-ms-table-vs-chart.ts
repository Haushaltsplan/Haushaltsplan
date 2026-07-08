/** npx tsx scripts/probe-ms-table-vs-chart.ts */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function decodeAttr(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

function bereinigeSegmentname(raw: string): string {
  return raw.replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').replace(/\s*\([^)]*\)\s*$/g, '').trim()
}

function istIgnoriertSegment(name: string): boolean {
  const n = name.toLowerCase()
  return !n || n === 'total' || n.includes('unallocated') || n.includes('elimination') || n.includes('intersegment') || n === 'corporate'
}

function parseWertAusZelle(cellHtml: string): number | null {
  const title = cellHtml.match(/title="([^"]+)"/)?.[1]
  if (title) {
    const n = Number(title.replace(/,/g, ''))
    if (Number.isFinite(n)) return n
  }
  const txt = cellHtml.replace(/<[^>]+>/g, '').trim()
  if (!txt || txt === '-') return null
  const m = txt.match(/^([\d,.]+)\s*([BMK])?$/i)
  if (!m) return null
  let n = Number(m[1]!.replace(/,/g, ''))
  if (!Number.isFinite(n)) return null
  const unit = (m[2] ?? '').toUpperCase()
  if (unit === 'B') n *= 1_000_000_000
  else if (unit === 'M') n *= 1_000_000
  else if (unit === 'K') n *= 1_000
  return n
}

function parseSegmentTabelle(html: string, marker: RegExp) {
  const pos = html.search(marker)
  if (pos < 0) return null
  const block = html.slice(pos, pos + 120_000)
  const table = block.match(/<table[\s\S]*?<\/table>/i)?.[0]
  if (!table) return null
  const jahre: number[] = []
  const thead = table.match(/<thead[\s\S]*?<\/thead>/i)?.[0] ?? ''
  for (const m of thead.matchAll(/>\s*(\d{4})\s*</g)) {
    const j = Number(m[1])
    if (Number.isFinite(j) && !jahre.includes(j)) jahre.push(j)
  }
  console.log('table years', jahre.length, jahre)
  return jahre.length
}

async function main() {
  const html = await (
    await fetch('https://www.marketscreener.com/quote/stock/ALPHABET-INC-24203373/finances-segments/', {
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
    })
  ).text()
  parseSegmentTabelle(html, /Breakdown by Business Segment/i)
  parseSegmentTabelle(html, /Geographical breakdown of sales/i)
}

main()

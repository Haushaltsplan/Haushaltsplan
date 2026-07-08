/** Simuliert vollständige Extraktion nach Fix — npx tsx scripts/probe-ms-parser-sim.ts */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const MAX_JAHRE = 10

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

type ChartRoh = { start: number; segmente: { name: string; werte: number[] }[] }

function parseChart(html: string, chartId: string): ChartRoh | null {
  const m = html.match(new RegExp(`id="${chartId}"[\\s\\S]*?data-fct-attr="(\\{[^"]+\\})"`))
  if (!m?.[1]) return null
  const parsed = JSON.parse(decodeAttr(m[1])) as { start?: number; data?: Record<string, { data?: number[] }> }
  if (parsed.start == null || !parsed.data) return null
  const segmente = Object.entries(parsed.data)
    .map(([name, row]) => ({ name: bereinigeSegmentname(name), werte: row.data ?? [] }))
    .filter((s) => !istIgnoriertSegment(s.name) && s.werte.some((v) => Math.abs(v) > 0))
  if (segmente.length === 0) return null
  const len = Math.max(...segmente.map((s) => s.werte.length))
  return { start: parsed.start, segmente: segmente.map((s) => ({ ...s, werte: s.werte.slice(0, len) })) }
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

function parseSegmentTabelle(html: string, marker: RegExp): ChartRoh | null {
  const pos = html.search(marker)
  if (pos < 0) return null
  const table = html.slice(pos, pos + 120_000).match(/<table[\s\S]*?<\/table>/i)?.[0]
  if (!table) return null
  const jahre: number[] = []
  const thead = table.match(/<thead[\s\S]*?<\/thead>/i)?.[0] ?? ''
  for (const m of thead.matchAll(/>\s*(\d{4})\s*</g)) {
    const j = Number(m[1])
    if (Number.isFinite(j) && !jahre.includes(j)) jahre.push(j)
  }
  if (jahre.length < 2) return null
  const offset = Math.max(0, jahre.length - MAX_JAHRE)
  const jahreBegrenzt = jahre.slice(offset)
  const segmente: ChartRoh['segmente'] = []
  for (const tr of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
    if (cells.length < jahre.length + 1) continue
    const label = bereinigeSegmentname(cells[0]![1].replace(/<[^>]+>/g, ' '))
    if (!label || istIgnoriertSegment(label)) continue
    const werte: number[] = []
    for (let i = 0; i < jahreBegrenzt.length; i++) {
      werte.push(parseWertAusZelle(cells[offset + i + 1]![1]) ?? 0)
    }
    if (werte.some((v) => v > 0)) segmente.push({ name: label, werte })
  }
  if (segmente.length < 2) return null
  return { start: jahreBegrenzt[0]!, segmente }
}

function begrenzeChartRoh(chart: ChartRoh): ChartRoh {
  const len = Math.max(...chart.segmente.map((s) => s.werte.length))
  if (len <= MAX_JAHRE) return chart
  const offset = len - MAX_JAHRE
  return { start: chart.start + offset, segmente: chart.segmente.map((s) => ({ ...s, werte: s.werte.slice(offset) })) }
}

function chartZuHistorie(chartRoh: ChartRoh) {
  const chart = begrenzeChartRoh(chartRoh)
  const jahre: { jahr: number; n: number }[] = []
  const jahrAnzahl = Math.max(...chart.segmente.map((s) => s.werte.length))
  const minSeg = chart.segmente.length === 1 ? 1 : 2
  for (let i = 0; i < jahrAnzahl; i++) {
    let n = 0
    for (const s of chart.segmente) {
      const v = s.werte[i]
      if (v != null && v > 0) n++
    }
    if (n >= minSeg) jahre.push({ jahr: chart.start + i, n })
  }
  return jahre.length
}

function waehle(a: number | null, b: number | null) {
  if (a == null) return b
  if (b == null) return a
  return Math.max(a, b)
}

async function main() {
  const html = await (
    await fetch('https://www.marketscreener.com/quote/stock/ALPHABET-INC-24203373/finances-segments/', {
      headers: { 'User-Agent': UA },
    })
  ).text()
  const pc = parseChart(html, 'financialSegmentCA1')
  const pt = parseSegmentTabelle(html, /Breakdown by Business Segment/i)
  const gc = parseChart(html, 'financialSegmentCA2')
  const gt = parseSegmentTabelle(html, /Geographical breakdown of sales/i)
  console.log('produkt chart years', pc ? chartZuHistorie(pc) : null)
  console.log('produkt table years', pt ? chartZuHistorie(pt) : null)
  console.log('geo chart years', gc ? chartZuHistorie(gc) : null)
  console.log('geo table years', gt ? chartZuHistorie(gt) : null)
  console.log('produkt final', waehle(pc ? chartZuHistorie(pc) : null, pt ? chartZuHistorie(pt) : null))
  console.log('geo final', waehle(gc ? chartZuHistorie(gc) : null, gt ? chartZuHistorie(gt) : null))
}

main()

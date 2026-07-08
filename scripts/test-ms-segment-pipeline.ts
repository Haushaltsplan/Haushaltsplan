/**
 * Test Marketscreener segment pipeline (ohne server-only)
 * npx tsx scripts/test-ms-segment-pipeline.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'

// Parser direkt aus Server-Datei laden via eval-ähnlichem Import — stattdessen Kopie der Kernlogik
const SLUGS: Record<string, string> = JSON.parse(
  readFileSync(join(process.cwd(), 'lib/portfolio-analyse/marketscreener-slug.ts'), 'utf8').match(
    /const SLUGS: Record<string, string> = (\{[\s\S]*?\n\})/,
  )?.[1]?.replace(/(\w+):/g, '"$1":').replace(/'/g, '"') ?? '{}',
) as Record<string, string>

// Fallback: hardcoded test slugs
const TEST = [
  { isin: 'US02079K3059', name: 'Alphabet', slug: 'ALPHABET-INC-24203373' },
  { isin: 'US5949181045', name: 'Microsoft', slug: 'MICROSOFT-CORPORATION-4835' },
  { isin: 'NL0010273215', name: 'ASML', slug: 'ASML-HOLDING-N-V-12002973' },
  { isin: 'US57636Q1040', name: 'Mastercard', slug: 'MASTERCARD-INC-17163' },
]

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

type ChartRoh = { start: number; segmente: { name: string; werte: number[] }[] }

function parseChart(html: string, chartId: string): ChartRoh | null {
  const m = html.match(new RegExp(`id="${chartId}"[\\s\\S]*?data-fct-attr="(\\{[^"]+\\})"`))
  if (!m?.[1]) return null
  try {
    const parsed = JSON.parse(decodeAttr(m[1])) as { start?: number; data?: Record<string, { data?: number[] }> }
    if (parsed.start == null || !parsed.data) return null
    const segmente = Object.entries(parsed.data)
      .map(([name, row]) => ({ name: bereinigeSegmentname(name), werte: row.data ?? [] }))
      .filter((s) => !istIgnoriertSegment(s.name) && s.werte.some((v) => Math.abs(v) > 0))
    if (segmente.length === 0) return null
    const len = Math.max(...segmente.map((s) => s.werte.length))
    return { start: parsed.start, segmente: segmente.map((s) => ({ ...s, werte: s.werte.slice(0, len) })) }
  } catch {
    return null
  }
}

function chartZuHistorie(chartRoh: ChartRoh): number {
  const jahre: number[] = []
  const jahrAnzahl = Math.max(...chartRoh.segmente.map((s) => s.werte.length))
  const minSeg = chartRoh.segmente.length === 1 ? 1 : 2
  for (let i = 0; i < jahrAnzahl; i++) {
    let n = 0
    for (const s of chartRoh.segmente) {
      const v = s.werte[i]
      if (v != null && v > 0) n++
    }
    if (n >= minSeg) jahre.push(chartRoh.start + i)
  }
  return jahre.length
}

async function testSlug(slug: string, label: string) {
  const url = `https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } })
  const html = await res.text()
  const pc = parseChart(html, 'financialSegmentCA1')
  const gc = parseChart(html, 'financialSegmentCA2')
  const pJ = pc ? chartZuHistorie(pc) : 0
  const gJ = gc ? chartZuHistorie(gc) : 0
  const ok = pJ >= 2 || gJ >= 2
  console.log(
    `${ok ? 'OK' : 'FAIL'} ${label.padEnd(12)} status=${res.status} len=${html.length} produkt=${pJ}J geo=${gJ}J slug=${slug}`,
  )
  if (!ok && html.length > 1000) {
    const ids = [...html.matchAll(/id="(financialSegment[^"]+)"/g)].map((m) => m[1])
    console.log('   chart ids:', [...new Set(ids)].slice(0, 6))
  }
  return ok
}

async function main() {
  let ok = 0
  for (const t of TEST) {
    if (await testSlug(t.slug, t.name)) ok++
    await new Promise((r) => setTimeout(r, 400))
  }
  console.log(`\n${ok}/${TEST.length} OK`)
  process.exit(ok === TEST.length ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
